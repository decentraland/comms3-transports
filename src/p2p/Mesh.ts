import { ILogger, BFFConnection, TopicListener } from '../types'

export const defaultIceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:coturn-raw.decentraland.services:3478',
    credential: 'passworddcl',
    username: 'usernamedcl'
  }
]

type Config = {
  logger: ILogger
  packetHandler: (data: Uint8Array, peerId: string) => void
  isKnownPeer(peerId: string): boolean
  debugWebRtcEnabled: boolean
}

type Connection = {
  instance: RTCPeerConnection
  createTimestamp: number
  dc?: RTCDataChannel
}

const PEER_CONNECT_TIMEOUT = 3500

export class Mesh {
  private logger: ILogger
  private debugWebRtcEnabled: boolean
  private packetHandler: (data: Uint8Array, peerId: string) => void
  private isKnownPeer: (peerId: string) => boolean
  private initiatedConnections = new Map<string, Connection>()
  private receivedConnections = new Map<string, Connection>()
  private candidatesListener: TopicListener | null = null
  private answerListener: TopicListener | null = null
  private offerListener: TopicListener | null = null
  private encoder = new TextEncoder()
  private decoder = new TextDecoder()

  constructor(
    private bff: BFFConnection,
    private peerId: string,
    { logger, packetHandler, isKnownPeer, debugWebRtcEnabled }: Config
  ) {
    this.logger = logger
    this.packetHandler = packetHandler
    this.isKnownPeer = isKnownPeer
    this.debugWebRtcEnabled = debugWebRtcEnabled
  }

  public async registerSubscriptions() {
    this.candidatesListener = await this.bff.addPeerTopicListener(
      `${this.peerId}.candidate`,
      this.onCandidateMessage.bind(this)
    )
    this.offerListener = await this.bff.addPeerTopicListener(`${this.peerId}.offer`, this.onOfferMessage.bind(this))
    this.answerListener = await this.bff.addPeerTopicListener(`${this.peerId}.answer`, this.onAnswerListener.bind(this))
  }

  public async connectTo(peerId: string): Promise<void> {
    if (this.initiatedConnections.has(peerId) || this.receivedConnections.has(peerId)) {
      return
    }

    this.logger.log(`Connecting to ${peerId}`)

    const instance = this.createConnection(peerId)
    const conn: Connection = { instance, createTimestamp: Date.now() }
    conn.instance.addEventListener('connectionstatechange', (_) => {
      if (conn.instance.connectionState === 'new') {
        conn.createTimestamp = Date.now()
      }
    })

    this.debugWebRtc(`Opening dc for ${peerId}`)
    const dc = instance.createDataChannel('data')
    dc.addEventListener('open', () => {
      conn.dc = dc
    })
    dc.addEventListener('message', (event) => {
      this.packetHandler(event.data, peerId)
    })

    const offer = await instance.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    })
    await instance.setLocalDescription(offer)
    this.debugWebRtc(`Set local description for ${peerId}`)
    this.debugWebRtc(`Sending offer to ${peerId}`)
    await this.bff.publishToTopic(`${peerId}.offer`, this.encoder.encode(JSON.stringify(offer)))

    this.initiatedConnections.set(peerId, conn)
  }

  public connectedCount(): number {
    let count = 0
    this.initiatedConnections.forEach(({ instance }: Connection) => {
      if (instance.connectionState === 'connected') {
        count++
      }
    })
    this.receivedConnections.forEach(({ instance }: Connection) => {
      if (instance.connectionState === 'connected') {
        count++
      }
    })
    return count
  }

  public disconnectFrom(peerId: string): void {
    this.logger.log(`Disconnecting from ${peerId}`)
    let conn = this.initiatedConnections.get(peerId)
    if (conn) {
      conn.instance.close()
    }

    conn = this.receivedConnections.get(peerId)
    if (conn) {
      conn.instance.close()
    }

    this.initiatedConnections.delete(peerId)
    this.receivedConnections.delete(peerId)
  }

  public hasConnectionsFor(peerId: string): boolean {
    return !!(this.initiatedConnections.get(peerId) || this.receivedConnections.get(peerId))
  }

  public isConnectedTo(peerId: string): boolean {
    let conn = this.initiatedConnections.get(peerId)
    if (conn && conn.instance.connectionState === 'connected') {
      return true
    }
    conn = this.receivedConnections.get(peerId)
    if (conn && conn.instance.connectionState === 'connected') {
      return true
    }

    return false
  }

  public connectedPeerIds(): string[] {
    const peerIds = new Set(this.initiatedConnections.keys())
    this.receivedConnections.forEach((_, peerId) => peerIds.add(peerId))
    return Array.from(peerIds)
  }

  public fullyConnectedPeerIds(): string[] {
    const peers: string[] = []

    this.initiatedConnections.forEach(({ instance }: Connection, peerId: string) => {
      if (instance.connectionState === 'connected') {
        peers.push(peerId)
      }
    })

    this.receivedConnections.forEach(({ instance }: Connection, peerId: string) => {
      if (instance.connectionState === 'connected') {
        peers.push(peerId)
      }
    })

    return peers
  }

  public checkConnectionsSanity(): void {
    this.initiatedConnections.forEach((conn: Connection, peerId: string) => {
      const state = conn.instance.connectionState
      if (state !== 'connected' && Date.now() - conn.createTimestamp > PEER_CONNECT_TIMEOUT) {
        this.logger.warn(`The connection ->${peerId} is not in a sane state ${state}. Discarding it.`)
        conn.instance.close()
        this.initiatedConnections.delete(peerId)
      }
    })
    this.receivedConnections.forEach((conn: Connection, peerId: string) => {
      const state = conn.instance.connectionState
      if (state !== 'connected' && Date.now() - conn.createTimestamp > PEER_CONNECT_TIMEOUT) {
        this.logger.warn(`The connection <-${peerId} is not in a sane state ${state}. Discarding it.`)
        conn.instance.close()
        this.receivedConnections.delete(peerId)
      }
    })
  }

  public sendPacketToPeer(peerId: string, data: Uint8Array): void {
    let conn = this.initiatedConnections.get(peerId)
    if (conn && conn.dc) {
      conn.dc.send(data)
    }
    conn = this.receivedConnections.get(peerId)
    if (conn && conn.dc) {
      conn.dc.send(data)
    }
  }

  async dispose(): Promise<void> {
    if (this.candidatesListener) {
      await this.bff.removePeerTopicListener(this.candidatesListener)
    }

    if (this.answerListener) {
      await this.bff.removePeerTopicListener(this.answerListener)
    }

    if (this.offerListener) {
      await this.bff.removePeerTopicListener(this.offerListener)
    }

    this.initiatedConnections.forEach(({ instance }: Connection) => {
      instance.close()
    })
    this.receivedConnections.forEach(({ instance }: Connection) => {
      instance.close()
    })

    this.initiatedConnections.clear()
    this.receivedConnections.clear()
  }

  private createConnection(peerId: string) {
    const instance = new RTCPeerConnection({
      iceServers: defaultIceServers
    })

    instance.addEventListener('icecandidate', async (event) => {
      if (event.candidate) {
        try {
          const msg = { candidate: event.candidate, initiator: this.peerId }
          await this.bff.publishToTopic(`${peerId}.candidate`, this.encoder.encode(JSON.stringify(msg)))
        } catch (err: any) {
          this.logger.error(`cannot publish ice candidate: ${err.toString()}`)
        }
      }
    })

    instance.addEventListener('iceconnectionstatechange', () => {
      this.debugWebRtc(`Connection with ${peerId}, ice status changed: ${instance.iceConnectionState}`)
    })
    return instance
  }

  private async onCandidateMessage(data: Uint8Array, peerId: string) {
    try {
      const { candidate, initiator } = JSON.parse(this.decoder.decode(data))

      const conn = (initiator === this.peerId ? this.initiatedConnections : this.receivedConnections).get(peerId)
      if (!conn) {
        return
      }

      await conn.instance.addIceCandidate(candidate)
    } catch (e: any) {
      this.logger.error(`Failed to add ice candidate: ${e.toString()}`)
    }
  }

  private async onOfferMessage(data: Uint8Array, peerId: string) {
    if (!this.isKnownPeer(peerId)) {
      this.logger.log(`Reject offer from unkown peer ${peerId}`)
      return
    }

    this.debugWebRtc(`Got offer message from ${peerId}`)

    const existentConnection = this.initiatedConnections.get(peerId)
    if (existentConnection) {
      if (this.peerId < peerId) {
        this.logger.warn(`Both peers try to establish connection with each other ${peerId}, closing old connection`)
        existentConnection.instance.close()
        this.initiatedConnections.delete(peerId)
        return
      }
      this.logger.warn(`Both peers try to establish connection with each other ${peerId}, keeping this offer`)
    }

    const offer = JSON.parse(this.decoder.decode(data))
    const instance = this.createConnection(peerId)
    const conn: Connection = { instance, createTimestamp: Date.now() }

    instance.addEventListener('connectionstatechange', () => {
      if (instance.connectionState === 'new') {
        conn.createTimestamp = Date.now()
      }
    })

    this.receivedConnections.set(peerId, conn)

    instance.addEventListener('datachannel', (event) => {
      this.debugWebRtc(`Got data channel from ${peerId}`)
      const dc = event.channel
      dc.addEventListener('open', () => {
        conn.dc = dc
      })

      dc.addEventListener('message', (event) => {
        this.packetHandler(event.data, peerId)
      })
    })

    try {
      this.debugWebRtc(`Setting remote description for ${peerId}`)
      await instance.setRemoteDescription(offer)

      this.debugWebRtc(`Creating answer for ${peerId}`)
      const answer = await instance.createAnswer()

      this.debugWebRtc(`Setting local description for ${peerId}`)
      await instance.setLocalDescription(answer)

      this.debugWebRtc(`Sending answer to ${peerId}`)
      await this.bff.publishToTopic(`${peerId}.answer`, this.encoder.encode(JSON.stringify(answer)))
    } catch (e: any) {
      this.logger.error(`Failed to create answer: ${e.toString()}`)
    }
  }

  private async onAnswerListener(data: Uint8Array, peerId: string) {
    this.debugWebRtc(`Got answer message from ${peerId}`)
    const conn = this.initiatedConnections.get(peerId)
    if (!conn) {
      return
    }

    try {
      const answer = JSON.parse(this.decoder.decode(data))
      this.debugWebRtc(`Setting remote description for ${peerId}`)
      await conn.instance.setRemoteDescription(answer)
    } catch (e: any) {
      this.logger.error(`Failed to set remote description: ${e.toString()}`)
    }
  }

  private debugWebRtc(message: string) {
    if (this.debugWebRtcEnabled) {
      this.logger.log(message)
    }
  }
}
