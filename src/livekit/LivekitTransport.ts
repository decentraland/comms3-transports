import { ILogger } from '../types'
import { SendOpts, Transport } from '../Transport'
import { StatisticsCollector } from '../statistics'

import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Participant,
  DataPacket_Kind,
  ConnectionState
} from 'livekit-client'

export type LivekitConfig = {
  logger: ILogger
  url: string
  token: string
  peerId: string
  islandId: string
  verbose: boolean
}

export class LivekitTransport extends Transport {
  private disconnected = false
  private room: Room
  private logger: ILogger
  private url: string
  private token: string
  private statisticsCollector: StatisticsCollector

  constructor({ logger, url, token, peerId, islandId, verbose }: LivekitConfig) {
    super()
    this.logger = logger
    this.url = url
    this.token = token
    this.room = new Room()
    this.statisticsCollector = new StatisticsCollector('livekit', peerId, islandId)

    this.room
      .on(RoomEvent.TrackSubscribed, (_: RemoteTrack, __: RemoteTrackPublication, ___: RemoteParticipant) => {
        if (verbose) {
          this.logger.log('track subscribed')
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (_: RemoteTrack, __: RemoteTrackPublication, ___: RemoteParticipant) => {
        if (verbose) {
          this.logger.log('track unsubscribed')
        }
      })
      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (verbose) {
          this.logger.log(`Connection State has changed ${state}`)
        }
      })
      .on(RoomEvent.Disconnected, () => {
        if (verbose) {
          this.logger.log('disconnected from room')
        }
        this.disconnect().catch((err) => {
          this.logger.error(`error during disconnection ${err.toString()}`)
        })
      })
      .on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: Participant, _?: DataPacket_Kind) => {
        if (participant) {
          this.handleMessage(participant.identity, payload)
        }
      })
  }

  collectStatistics() {
    return this.statisticsCollector.collectStatistics()
  }

  async connect(): Promise<void> {
    await this.room.connect(this.url, this.token, { autoSubscribe: true })
    this.logger.log(`Connected to livekit room ${this.room.name}`)
  }

  send(data: Uint8Array, { reliable }: SendOpts): Promise<void> {
    this.statisticsCollector.onBytesSent(data.length)
    return this.room.localParticipant.publishData(data, reliable ? DataPacket_Kind.RELIABLE : DataPacket_Kind.LOSSY)
  }

  async disconnect() {
    if (this.disconnected) {
      return
    }

    this.disconnected = true
    this.room.disconnect()
    this.onDisconnectObservable.notifyObservers()
  }

  handleMessage(peerId: string, data: Uint8Array) {
    this.statisticsCollector.onBytesRecv(data.length)
    this.onMessageObservable.notifyObservers({
      peer: peerId,
      payload: data
    })
  }
}
