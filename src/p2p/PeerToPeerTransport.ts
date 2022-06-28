import { Reader } from 'protobufjs/minimal'
import { Observable } from 'mz-observable'
import { future } from 'fp-future'

import {
  TransportStatistics,
  TransportMessage,
  BFFConnection,
  TopicListener,
  Position3D,
  ILogger,
  SendOpts
} from '../types'
import { StatisticsCollector } from '../statistics'
import { JoinIslandMessage, LeftIslandMessage } from '../proto/archipelago'
import { SuspendRelayData, PingData, PongData, Packet, MessageData } from '../proto/p2p'
import { Mesh } from './Mesh'
import { pickBy, randomUint32, discretizedPositionDistanceXZ } from './utils'
import { PeerMessageType, PongMessageType, PingMessageType, PeerMessageTypes, SuspendRelayType } from './messageTypes'
import {
  P2PLogConfig,
  PeerRelayData,
  PingResult,
  MinPeerData,
  NetworkOperation,
  KnownPeerData,
  ActivePing
} from './types'

export type RelaySuspensionConfig = {
  relaySuspensionInterval: number
  relaySuspensionDuration: number
}

export type P2PConfig = {
  selfPosition: () => Position3D | undefined
  relaySuspensionConfig?: RelaySuspensionConfig
  islandId: string
  peerId: string
  logger: ILogger
  bff: BFFConnection
  logConfig: P2PLogConfig
}

type PacketData = {
  messageData?: MessageData
  pingData?: PingData
  pongData?: PongData
  suspendRelayData?: SuspendRelayData
}

const MAX_CONNECTION_DISTANCE = 4
const DISCONNECT_DISTANCE = 5
const EXPIRATION_LOOP_INTERVAL = 2000
const KNOWN_PEERS_EXPIRE_TIME = 90000
const KNOWN_PEER_RELAY_EXPIRE_TIME = 30000
const UPDATE_NETWORK_INTERVAL = 30000
const DEFAULT_TTL = 10
const DEFAULT_PING_TIMEOUT = 7000
const DEFAULT_TARGET_CONNECTIONS = 4
const DEFAULT_MAX_CONNECTIONS = 6
const DEFAULT_MESSAGE_EXPIRATION_TIME = 10000

export class P2PTransport {
  public readonly name = 'p2p'
  public readonly peerId: string
  public readonly islandId: string
  public readonly mesh: Mesh
  public logConfig: P2PLogConfig
  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<TransportMessage>()

  private selfPosition: () => Position3D | undefined
  private relaySuspensionConfig?: RelaySuspensionConfig
  private statisticsCollector: StatisticsCollector
  private logger: ILogger
  private bffConnection: BFFConnection
  private distance: (l1: Position3D, l2: Position3D) => number
  private peerRelayData: Record<string, PeerRelayData> = {}
  private knownPeers: Record<string, KnownPeerData> = {}
  private receivedPackets: Record<string, { timestamp: number; expirationTime: number }> = {}
  private updatingNetwork: boolean = false
  private currentMessageId: number = 0
  private instanceId: number
  private expireTimeoutId: NodeJS.Timeout | number
  private updateNetworkTimeoutId: NodeJS.Timeout | number | null = null
  private pingTimeoutId?: NodeJS.Timeout | number
  private disposed: boolean = false
  private activePings: Record<string, ActivePing> = {}

  private onPeerJoinedListener: TopicListener | null = null
  private onPeerLeftListener: TopicListener | null = null

  constructor(config: P2PConfig, peers: Map<string, Position3D>) {
    this.distance = discretizedPositionDistanceXZ()
    this.instanceId = randomUint32()
    this.logger = config.logger
    this.peerId = config.peerId
    this.islandId = config.islandId
    this.bffConnection = config.bff
    this.statisticsCollector = new StatisticsCollector()
    this.relaySuspensionConfig = config.relaySuspensionConfig
    this.selfPosition = config.selfPosition
    this.logConfig = config.logConfig

    this.mesh = new Mesh(this.bffConnection, this.peerId, {
      logger: this.logger,
      packetHandler: this.handlePeerPacket.bind(this),
      shouldAcceptOffer: (peerId: string) => {
        if (this.disposed) {
          return false
        }

        if (!this.isKnownPeer(peerId)) {
          if (this.logConfig.verbose) {
            this.logger.log('Rejecting offer from unknown peer')
          }
          return false
        }

        if (this.mesh.connectedCount() >= DEFAULT_TARGET_CONNECTIONS) {
          if (this.logConfig.verbose) {
            this.logger.log('Rejecting offer, already enough connections')
          }
          return false
        }

        return true
      },
      logConfig: this.logConfig
    })

    const scheduleExpiration = () =>
      setTimeout(() => {
        try {
          const currentTimestamp = Date.now()

          Object.keys(this.receivedPackets).forEach((id) => {
            const received = this.receivedPackets[id]
            if (currentTimestamp - received.timestamp > received.expirationTime) {
              delete this.receivedPackets[id]
            }
          })

          this.expireKnownPeers(currentTimestamp)
          this.expirePeerRelayData(currentTimestamp)
        } catch (e) {
          this.logger.error(`Couldn't expire messages ${e}`)
        } finally {
          this.expireTimeoutId = scheduleExpiration()
        }
      }, EXPIRATION_LOOP_INTERVAL)

    this.expireTimeoutId = scheduleExpiration()
    this.scheduleUpdateNetwork()
    // if (this.config.pingInterval) {
    //   const schedulePing = () =>
    //     setTimeout(async () => {
    //       try {
    //         await this.ping()
    //       } finally {
    //         this.pingTimeoutId = schedulePing()
    //       }
    //     }, this.config.pingInterval)

    //   this.pingTimeoutId = schedulePing()
    // }

    peers.forEach((p: Position3D, peerId: string) => {
      if (peerId !== this.peerId) {
        this.addKnownPeerIfNotExists({ id: peerId, position: p })
        if (p) {
          this.knownPeers[peerId].position = p
        }
      }
    })
  }

  startStatistics() {
    this.statisticsCollector.start()
  }

  stopStatistics() {
    this.statisticsCollector.stop()
  }

  collectStatistics(): TransportStatistics | undefined {
    const s = this.statisticsCollector.collectStatistics()
    if (s) {
      let knownPeers = 0
      Object.keys(this.knownPeers).forEach((_) => {
        knownPeers++
      })

      s.custom = {
        knownPeers
      }
    }

    return s
  }

  onPeerPositionChange(peerId: string, p: Position3D) {
    const peer = this.knownPeers[peerId]
    if (peer) {
      peer.position = p
    }
  }

  private onPeerJoined(data: Uint8Array) {
    let peerJoinMessage: JoinIslandMessage
    try {
      peerJoinMessage = JoinIslandMessage.decode(Reader.create(data))
    } catch (e) {
      this.logger.error('cannot process peer join message', e)
      return
    }

    const peerId = peerJoinMessage.peerId
    if (peerId === this.peerId) {
      return
    }

    if (peerJoinMessage.islandId === this.islandId) {
      this.logger.log(`${peerId} joined ${this.islandId}`)

      this.addKnownPeerIfNotExists({ id: peerId })
      this.triggerUpdateNetwork(`peer ${peerId} joined island`)
    } else {
      this.logger.warn(`peer ${peerId} join ${peerJoinMessage.islandId}, but our current island is ${this.islandId}`)
    }
  }

  private onPeerLeft(data: Uint8Array) {
    let peerLeftMessage: LeftIslandMessage
    try {
      peerLeftMessage = LeftIslandMessage.decode(Reader.create(data))
    } catch (e) {
      this.logger.error('cannot process peer left message', e)
      return
    }

    const peerId = peerLeftMessage.peerId

    if (peerLeftMessage.islandId === this.islandId) {
      this.logger.log(`peer ${peerId} left ${this.islandId}`)
      this.disconnectFrom(peerId)
      delete this.knownPeers[peerId]
      this.triggerUpdateNetwork(`peer ${peerId} left island`)
    } else {
      this.logger.warn(`peer ${peerId} left ${peerLeftMessage.islandId}, but our current island is ${this.islandId}`)
    }
  }

  async connect() {
    this.onPeerJoinedListener = await this.bffConnection.addSystemTopicListener(
      `island.${this.islandId}.peer_join`,
      this.onPeerJoined.bind(this)
    )
    this.onPeerLeftListener = await this.bffConnection.addSystemTopicListener(
      `island.${this.islandId}.peer_left`,
      this.onPeerLeft.bind(this)
    )
    await this.mesh.registerSubscriptions()

    this.triggerUpdateNetwork(`changed to island ${this.islandId}`)
  }

  async disconnect() {
    if (this.disposed) return

    this.disposed = true
    if (this.updateNetworkTimeoutId) {
      clearTimeout(this.updateNetworkTimeoutId as any)
    }
    clearTimeout(this.expireTimeoutId as any)
    clearTimeout(this.pingTimeoutId as any)

    if (this.onPeerJoinedListener) {
      await this.bffConnection.removeSystemTopicListener(this.onPeerJoinedListener)
    }
    if (this.onPeerLeftListener) {
      await this.bffConnection.removeSystemTopicListener(this.onPeerLeftListener)
    }

    this.knownPeers = {}
    await this.mesh.dispose()
    this.onDisconnectObservable.notifyObservers()
  }

  async send(payload: Uint8Array, { reliable }: SendOpts): Promise<void> {
    if (this.disposed) {
      return
    }

    const subtype = 'data'
    const t = reliable ? PeerMessageTypes.reliable(subtype) : PeerMessageTypes.unreliable(subtype)

    const messageData = { room: this.islandId, payload, dst: [] }
    const packet = this.buildPacketWithData(t, { messageData })
    this.sendPacket(packet)
  }

  isKnownPeer(peerId: string): boolean {
    return !!this.knownPeers[peerId]
  }

  private handlePeerPacket(data: Uint8Array, peerId: string) {
    if (this.disposed) return
    data = new Uint8Array(data)
    this.statisticsCollector.onBytesRecv(data.length)
    try {
      const packet = Packet.decode(Reader.create(data))
      const now = Date.now()
      const packetKey = `${packet.src}_${packet.instanceId}_${packet.sequenceId}`
      const alreadyReceived = !!this.receivedPackets[packetKey]

      this.addKnownPeerIfNotExists({ id: packet.src })

      this.knownPeers[packet.src].reachableThrough[peerId] = {
        id: peerId,
        hops: packet.hops + 1,
        timestamp: now
      }

      const expirationTime = this.getExpireTime(packet)
      let expired = now - packet.timestamp > expirationTime

      if (!expired && packet.discardOlderThan >= 0 && packet.subtype) {
        const subtypeData = this.knownPeers[packet.src]?.subtypeData[packet.subtype]
        expired =
          subtypeData &&
          subtypeData.lastTimestamp - packet.timestamp > packet.discardOlderThan &&
          subtypeData.lastSequenceId >= packet.sequenceId
      }

      if (!expired && packet.discardOlderThan !== 0) {
        // If discardOlderThan is zero, then we don't need to store the package.
        // Same or older packages will be instantly discarded
        this.receivedPackets[packetKey] = {
          timestamp: now,
          expirationTime
        }
      }

      if (packet.hops >= 1) {
        this.countRelay(peerId, packet, expired, alreadyReceived)
      }

      if (!alreadyReceived && !expired) {
        this.processPacket(packet)
      } else {
        if (peerId === packet.src) {
          // NOTE(hugo): not part of the original implementation
          if (this.logConfig.verbose) {
            this.logger.log(
              `Skip requesting relay suspension for direct packet, already received: ${alreadyReceived}, expired: ${expired}`
            )
          }
          return
        }

        this.requestRelaySuspension(packet, peerId)
      }
    } catch (e: any) {
      this.logger.warn(`Failed to process message from: ${peerId} ${e.toString()}`)
    }
  }

  private processPacket(packet: Packet) {
    const knownPeer = this.knownPeers[packet.src]
    knownPeer.lastUpdated = Date.now()
    knownPeer.timestamp = Math.max(knownPeer.timestamp ?? Number.MIN_SAFE_INTEGER, packet.timestamp)
    if (packet.subtype) {
      const lastData = knownPeer.subtypeData[packet.subtype]
      knownPeer.subtypeData[packet.subtype] = {
        lastTimestamp: Math.max(lastData?.lastTimestamp ?? Number.MIN_SAFE_INTEGER, packet.timestamp),
        lastSequenceId: Math.max(lastData?.lastSequenceId ?? Number.MIN_SAFE_INTEGER, packet.sequenceId)
      }
    }

    packet.hops += 1

    this.knownPeers[packet.src].hops = packet.hops

    if (packet.hops < packet.ttl) {
      this.sendPacket(packet)
    }

    switch (packet.data?.$case) {
      case 'messageData': {
        const { messageData } = packet.data
        if (messageData.room === this.islandId) {
          this.onMessageObservable.notifyObservers({
            peer: packet.src,
            payload: messageData.payload
          })
        }
        break
      }
      case 'pingData': {
        const { pingId } = packet.data.pingData

        // TODO: Maybe we should add a destination and handle this message as unicast
        const pongPacket = this.buildPacketWithData(PongMessageType, { pongData: { pingId } })
        pongPacket.expireTime = DEFAULT_PING_TIMEOUT
        this.sendPacket(pongPacket)
        break
      }
      case 'pongData': {
        const { pingId } = packet.data.pongData
        const now = performance.now()
        const activePing = this.activePings[pingId]
        if (activePing && activePing.startTime) {
          const elapsed = now - activePing.startTime

          const knownPeer = this.addKnownPeerIfNotExists({ id: packet.src })
          knownPeer.latency = elapsed

          activePing.results.push({ peerId: packet.src, latency: elapsed })
        }
        break
      }
      case 'suspendRelayData': {
        const { suspendRelayData } = packet.data
        if (this.mesh.hasConnectionsFor(packet.src)) {
          const relayData = this.getPeerRelayData(packet.src)
          suspendRelayData.relayedPeers.forEach((it) => {
            relayData.ownSuspendedRelays[it] = Date.now() + suspendRelayData.durationMillis
          })
        }
      }
    }
  }

  private expirePeerRelayData(currentTimestamp: number) {
    Object.keys(this.peerRelayData).forEach((id) => {
      const connected = this.peerRelayData[id]
      // We expire peers suspensions
      Object.keys(connected.ownSuspendedRelays).forEach((srcId) => {
        if (connected.ownSuspendedRelays[srcId] <= currentTimestamp) {
          delete connected.ownSuspendedRelays[srcId]
        }
      })

      Object.keys(connected.theirSuspendedRelays).forEach((srcId) => {
        if (connected.theirSuspendedRelays[srcId] <= currentTimestamp) {
          delete connected.theirSuspendedRelays[srcId]
        }
      })
    })
  }

  private expireKnownPeers(currentTimestamp: number) {
    Object.keys(this.knownPeers).forEach((id) => {
      const lastUpdate = this.knownPeers[id].lastUpdated
      if (lastUpdate && currentTimestamp - lastUpdate > KNOWN_PEERS_EXPIRE_TIME) {
        if (this.mesh.isConnectedTo(id)) {
          this.disconnectFrom(id)
        }
        delete this.knownPeers[id]
      } else {
        // We expire reachable through data
        Object.keys(this.knownPeers[id].reachableThrough).forEach((relayId) => {
          if (
            currentTimestamp - this.knownPeers[id].reachableThrough[relayId].timestamp >
            KNOWN_PEER_RELAY_EXPIRE_TIME
          ) {
            delete this.knownPeers[id].reachableThrough[relayId]
          }
        })
      }
    })
  }

  private getPeerRelayData(peerId: string) {
    if (!this.peerRelayData[peerId]) {
      this.peerRelayData[peerId] = {
        receivedRelayData: {},
        ownSuspendedRelays: {},
        theirSuspendedRelays: {},
        pendingSuspensionRequests: []
      }
    }

    return this.peerRelayData[peerId]
  }

  private requestRelaySuspension(packet: Packet, peerId: string) {
    if (!this.relaySuspensionConfig) {
      return
    }

    const { relaySuspensionDuration } = this.relaySuspensionConfig

    // First we update pending suspensions requests, adding the new one if needed
    this.consolidateSuspensionRequest(packet, peerId)

    const now = Date.now()

    const relayData = this.getPeerRelayData(peerId)

    const lastSuspension = relayData.lastRelaySuspensionTimestamp

    // We only send suspensions requests if more time than the configured interval has passed since last time
    if (lastSuspension && now - lastSuspension > this.relaySuspensionConfig.relaySuspensionInterval) {
      const suspendRelayData = {
        relayedPeers: relayData.pendingSuspensionRequests,
        durationMillis: relaySuspensionDuration
      }

      if (this.logConfig.verbose) {
        this.logger.log(`Requesting relay suspension to ${peerId} ${JSON.stringify(suspendRelayData)}`)
      }

      const packet = this.buildPacketWithData(SuspendRelayType, {
        suspendRelayData
      })

      this.sendPacketToPeer(peerId, Packet.encode(packet).finish())

      suspendRelayData.relayedPeers.forEach((relayedPeerId) => {
        relayData.theirSuspendedRelays[relayedPeerId] = Date.now() + relaySuspensionDuration
      })

      relayData.pendingSuspensionRequests = []
      relayData.lastRelaySuspensionTimestamp = now
    } else if (!lastSuspension) {
      // We skip the first suspension to give time to populate the structures
      relayData.lastRelaySuspensionTimestamp = now
    }
  }

  private consolidateSuspensionRequest(packet: Packet, connectedPeerId: string) {
    const relayData = this.getPeerRelayData(connectedPeerId)
    if (relayData.pendingSuspensionRequests.includes(packet.src)) {
      // If there is already a pending suspension for this src through this connection, we don't do anything
      return
    }

    if (this.logConfig.verbose) {
      this.logger.log(`Consolidating suspension for ${packet.src}->${connectedPeerId}`)
    }

    const now = Date.now()

    // We get a list of through which connected peers is this src reachable and are not suspended
    const reachableThrough = Object.values(this.knownPeers[packet.src].reachableThrough).filter(
      (it) =>
        this.mesh.isConnectedTo(it.id) &&
        now - it.timestamp < KNOWN_PEER_RELAY_EXPIRE_TIME &&
        !this.isRelayFromConnectionSuspended(it.id, packet.src, now)
    )

    if (this.logConfig.verbose) {
      this.logger.log(`${packet.src} is reachable through ${JSON.stringify(reachableThrough)}`)
    }

    // We only suspend if we will have at least 1 path of connection for this peer after suspensions
    if (reachableThrough.length > 1 || (reachableThrough.length === 1 && reachableThrough[0].id !== connectedPeerId)) {
      if (this.logConfig.verbose) {
        this.logger.log(`Will add suspension for ${packet.src} -> ${connectedPeerId}`)
      }
      relayData.pendingSuspensionRequests.push(packet.src)
    }
  }

  private isRelayFromConnectionSuspended(connectedPeerId: string, srcId: string, now: number = Date.now()): boolean {
    const relayData = this.getPeerRelayData(connectedPeerId)
    return !!(
      relayData.pendingSuspensionRequests.includes(srcId) ||
      // Relays are suspended only if they are not expired
      (relayData.theirSuspendedRelays[srcId] && now < relayData.theirSuspendedRelays[srcId])
    )
  }

  private isRelayToConnectionSuspended(connectedPeerId: string, srcId: string, now: number = Date.now()): boolean {
    const relayData = this.getPeerRelayData(connectedPeerId)
    return !!relayData.ownSuspendedRelays[srcId] && now < relayData.ownSuspendedRelays[srcId]
  }

  private countRelay(peerId: string, packet: Packet, expired: boolean, alreadyReceived: boolean) {
    const relayData = this.getPeerRelayData(peerId)
    let receivedRelayData = relayData.receivedRelayData[packet.src]
    if (!receivedRelayData) {
      receivedRelayData = relayData.receivedRelayData[packet.src] = {
        hops: packet.hops,
        discarded: 0,
        total: 0
      }
    } else {
      receivedRelayData.hops = packet.hops
    }

    receivedRelayData.total += 1

    if (expired || alreadyReceived) {
      receivedRelayData.discarded += 1
    }
  }

  private buildPacketWithData(type: PeerMessageType, data: PacketData): Packet {
    this.currentMessageId += 1
    const sequenceId = this.currentMessageId

    const ttl =
      typeof type.ttl !== 'undefined'
        ? typeof type.ttl === 'number'
          ? type.ttl
          : type.ttl(sequenceId, type)
        : DEFAULT_TTL
    const optimistic = typeof type.optimistic === 'boolean' ? type.optimistic : type.optimistic(sequenceId, type)

    const packet: Packet = {
      sequenceId: sequenceId,
      instanceId: this.instanceId,
      subtype: type.name,
      expireTime: type.expirationTime ?? -1,
      discardOlderThan: type.discardOlderThan ?? -1,
      timestamp: Date.now(),
      src: this.peerId,
      hops: 0,
      ttl: ttl,
      receivedBy: [],
      optimistic: optimistic
    }

    const { messageData, pingData, pongData, suspendRelayData } = data
    if (messageData) {
      packet.data = { $case: 'messageData', messageData }
    } else if (pingData) {
      packet.data = { $case: 'pingData', pingData }
    } else if (pongData) {
      packet.data = { $case: 'pongData', pongData }
    } else if (suspendRelayData) {
      packet.data = { $case: 'suspendRelayData', suspendRelayData }
    }
    return packet
  }

  async ping() {
    if (this.peerId) {
      const pingId = randomUint32()
      const pingFuture = future<PingResult[]>()
      this.activePings[pingId] = {
        results: [],
        future: pingFuture
      }

      const pingData = { pingId }
      const packet = this.buildPacketWithData(PingMessageType, { pingData })
      packet.expireTime = DEFAULT_PING_TIMEOUT
      this.sendPacket(packet)

      setTimeout(() => {
        const activePing = this.activePings[pingId]
        if (activePing) {
          activePing.future.resolve(activePing.results)
          delete this.activePings[pingId]
        }
      }, DEFAULT_PING_TIMEOUT)

      return await pingFuture
    }
  }

  private sendPacket(packet: Packet) {
    const receivedBy = packet.receivedBy
    if (!receivedBy.includes(this.peerId)) {
      receivedBy.push(this.peerId)
      packet.receivedBy = receivedBy
    }

    const peersToSend = this.mesh
      .fullyConnectedPeerIds()
      .filter(
        (it) =>
          !packet.receivedBy.includes(it) && (packet.hops === 0 || !this.isRelayToConnectionSuspended(it, packet.src))
      )

    if (packet.optimistic) {
      packet.receivedBy = [...packet.receivedBy, ...peersToSend]
    }

    // This is a little specific also, but is here in order to make the measurement as accurate as possible
    if (packet.data && packet.data.$case === 'pingData') {
      const pingData = packet.data.pingData
      if (pingData && packet.src === this.peerId) {
        const activePing = this.activePings[pingData.pingId]
        if (activePing) {
          activePing.startTime = performance.now()
        }
      }
    }

    const d = Packet.encode(packet).finish()
    peersToSend.forEach((peer) => this.sendPacketToPeer(peer, d))
  }

  private sendPacketToPeer(peer: string, payload: Uint8Array) {
    try {
      if (this.mesh.sendPacketToPeer(peer, payload)) {
        this.statisticsCollector.onBytesSent(payload.length)
      }
    } catch (e: any) {
      this.logger.warn(`Error sending data to peer ${peer} ${e.toString()}`)
    }
  }

  private scheduleUpdateNetwork() {
    if (this.disposed) {
      return
    }
    if (this.updateNetworkTimeoutId) {
      clearTimeout(this.updateNetworkTimeoutId)
    }
    this.updateNetworkTimeoutId = setTimeout(() => {
      this.triggerUpdateNetwork('scheduled network update')
    }, UPDATE_NETWORK_INTERVAL)
  }

  private triggerUpdateNetwork(event: string) {
    this.updateNetwork(event).catch((e) => {
      this.logger.warn(`Error updating network after ${event}, ${e} `)
    })
    this.scheduleUpdateNetwork()
  }

  private getWorstConnectedPeerByDistance(): [number, string] | undefined {
    return this.mesh.connectedPeerIds().reduce<[number, string] | undefined>((currentWorst, peer) => {
      const currentDistance = this.distanceTo(peer)
      if (typeof currentDistance !== 'undefined') {
        return typeof currentWorst !== 'undefined' && currentWorst[0] >= currentDistance
          ? currentWorst
          : [currentDistance, peer]
      }
    }, undefined)
  }

  private async updateNetwork(event: string) {
    if (this.updatingNetwork || this.disposed) {
      return
    }

    try {
      this.updatingNetwork = true

      if (this.logConfig.debugUpdateNetwork) {
        this.logger.log(`Updating network because of event "${event}"...`)
      }

      this.mesh.checkConnectionsSanity()

      // NOTE(hugo): this operation used to be part of calculateNextNetworkOperation
      // but that was wrong, since no new connected peers will be added after a given iteration
      const neededConnections = DEFAULT_TARGET_CONNECTIONS - this.mesh.connectedCount()
      // If we need to establish new connections because we are below the target, we do that
      if (neededConnections > 0 && this.mesh.connectionsCount() < DEFAULT_MAX_CONNECTIONS) {
        if (this.logConfig.debugUpdateNetwork) {
          this.logger.log(`Establishing connections to reach target. I need ${neededConnections} more connections`)
        }

        const candidates = pickBy(
          Object.values(this.knownPeers).filter((peer) => {
            if (this.mesh.hasConnectionsFor(peer.id)) {
              return false
            }

            const distance = this.distanceTo(peer.id)
            return typeof distance !== 'undefined' && distance <= MAX_CONNECTION_DISTANCE
          }),
          neededConnections,
          this.peerSortCriteria()
        )

        if (this.logConfig.verbose) {
          this.logger.log(`Picked connection candidates ${JSON.stringify(candidates)} `)
        }

        const reason = 'I need more connections.'
        await Promise.all(candidates.map((candidate) => this.mesh.connectTo(candidate.id, reason)))
      }

      let connectionCandidates = Object.values(this.knownPeers).filter((it) => {
        if (this.mesh.isConnectedTo(it.id)) {
          return false
        }

        const distance = this.distanceTo(it.id)
        return typeof distance !== 'undefined' && distance <= MAX_CONNECTION_DISTANCE
      })

      let operation: NetworkOperation | undefined
      while ((operation = this.calculateNextNetworkOperation(connectionCandidates))) {
        try {
          connectionCandidates = await operation()
        } catch (e) {
          // We may want to invalidate the operation or something to avoid repeating the same mistake
          this.logger.log(`Error performing operation ${operation} ${e}`)
        }
      }
    } finally {
      if (this.logConfig.debugUpdateNetwork) {
        this.logger.log('Network update finished')
      }

      this.updatingNetwork = false
    }
  }

  private peerSortCriteria() {
    // We are going to be calculating the distance to each of the candidates. This could be costly, but since the state could have changed after every operation,
    // we need to ensure that the value is updated. If known peers is kept under maybe 2k elements, it should be no problem.
    return (peer1: KnownPeerData, peer2: KnownPeerData) => {
      // We prefer those peers that have position over those that don't
      if (peer1.position && !peer2.position) return -1
      if (peer2.position && !peer1.position) return 1

      if (peer1.position && peer2.position) {
        const distanceDiff = this.distanceTo(peer1.id)! - this.distanceTo(peer2.id)!
        // If the distance is the same, we randomize
        return distanceDiff === 0 ? 0.5 - Math.random() : distanceDiff
      }

      // If none has position or if we don't, we randomize
      return 0.5 - Math.random()
    }
  }

  private calculateNextNetworkOperation(connectionCandidates: KnownPeerData[]): NetworkOperation | undefined {
    if (this.logConfig.verbose) {
      this.logger.log(`Calculating network operation with candidates ${JSON.stringify(connectionCandidates)}`)
    }

    const peerSortCriteria = this.peerSortCriteria()

    // If we are over the max amount of connections, we discard the "worst"
    const toDisconnect = this.mesh.connectedCount() - DEFAULT_MAX_CONNECTIONS
    if (toDisconnect > 0) {
      this.logger.log(`Too many connections. Need to disconnect from: ${toDisconnect}`)
      return async () => {
        Object.values(this.knownPeers)
          .filter((peer) => this.mesh.isConnectedTo(peer.id))
          // We sort the connected peer by the opposite criteria
          .sort((peer1, peer2) => -peerSortCriteria(peer1, peer2))
          .slice(0, toDisconnect)
          .forEach((peer) => this.disconnectFrom(peer.id))
        return connectionCandidates
      }
    }

    if (connectionCandidates.length > 0) {
      // We find the worst distance of the current connections
      const worstPeer = this.getWorstConnectedPeerByDistance()
      const sortedCandidates = connectionCandidates.sort(peerSortCriteria)
      // We find the best candidate
      const bestCandidate = sortedCandidates.splice(0, 1)[0]

      if (worstPeer && bestCandidate) {
        const bestCandidateDistance = this.distanceTo(bestCandidate.id)

        if (typeof bestCandidateDistance !== 'undefined' && bestCandidateDistance < worstPeer[0]) {
          // If the best candidate is better than the worst connection, we connect to that candidate.
          // The next operation should handle the disconnection of the worst
          this.logger.log(
            `Found a better candidate for connection, replacing ${worstPeer[1]} (${worstPeer[0]}) with ${bestCandidate} (${bestCandidateDistance})`
          )
          return async () => {
            await this.mesh.connectTo(bestCandidate.id, 'There is a better candidate')
            return sortedCandidates
          }
        }
      }
    }

    // We drop those connections too far away
    const connectionsToDrop = this.mesh.connectedPeerIds().filter((it) => {
      const distance = this.distanceTo(it)
      // We need to check that we are actually connected to the peer, and also only disconnect to it if we know we are far away and we don't have any rooms in common
      return distance && distance >= DISCONNECT_DISTANCE
    })

    if (connectionsToDrop.length > 0) {
      this.logger.log(`Dropping connections because they are too far away: ${JSON.stringify(connectionsToDrop)}`)
      return async () => {
        connectionsToDrop.forEach((it) => this.disconnectFrom(it))
        return connectionCandidates
      }
    }
  }

  private distanceTo(peerId: string) {
    const position = this.selfPosition()
    if (this.knownPeers[peerId]?.position && position) {
      return this.distance(position, this.knownPeers[peerId].position!)
    }
  }

  private getExpireTime(packet: Packet): number {
    return packet.expireTime > 0 ? packet.expireTime : DEFAULT_MESSAGE_EXPIRATION_TIME
  }

  private disconnectFrom(peerId: string) {
    this.mesh.disconnectFrom(peerId)
    delete this.peerRelayData[peerId]
  }

  private addKnownPeerIfNotExists(peer: MinPeerData) {
    if (!this.knownPeers[peer.id]) {
      this.knownPeers[peer.id] = {
        ...peer,
        subtypeData: {},
        reachableThrough: {}
      }
    }

    return this.knownPeers[peer.id]
  }
}
