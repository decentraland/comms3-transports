import { Observable } from 'mz-observable'
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Participant,
  DataPacket_Kind
} from 'livekit-client'

import { ILogger, SendOpts, TransportMessage, Position3D } from '../types'
import { StatisticsCollector } from '../statistics'

export type LivekitConfig = {
  logger: ILogger
  url: string
  token: string
  peerId: string
  islandId: string
  verbose: boolean
  onRoomConnected?: (room: Room) => void
}
export class LivekitTransport {
  public readonly name = 'livekit'
  public readonly peerId: string
  public readonly islandId: string
  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<TransportMessage>()
  public onRoomConnected?: (room: Room) => void
  private disconnected = false
  private room: Room
  private logger: ILogger
  private url: string
  private token: string
  private statisticsCollector: StatisticsCollector

  constructor({ logger, url, token, peerId, islandId, verbose, onRoomConnected }: LivekitConfig) {
    this.logger = logger
    this.url = url
    this.token = token
    this.room = new Room()
    this.peerId = peerId
    this.islandId = islandId
    this.statisticsCollector = new StatisticsCollector()
    this.onRoomConnected = onRoomConnected

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

  startStatistics() {
    this.statisticsCollector.start()
  }

  stopStatistics() {
    this.statisticsCollector.stop()
  }

  collectStatistics() {
    return this.statisticsCollector.collectStatistics()
  }

  onPeerPositionChange(_: string, __: Position3D) {}

  async connect(): Promise<void> {
    await this.room.connect(this.url, this.token, { autoSubscribe: true })
    this.logger.log(`Connected to livekit room ${this.room.name}`)
    if (this.onRoomConnected) this.onRoomConnected(this.room)
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
