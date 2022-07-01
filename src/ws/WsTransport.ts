import { Reader } from 'protobufjs/minimal'
import { Observable } from 'mz-observable'

import { ILogger, SendOpts, TransportMessage, Position3D } from '../types'
import { StatisticsCollector } from '../statistics'
import { WsMessage } from '../proto/ws'

export type LogConfig = {
  verbose: boolean
}

export type WsConfig = {
  logger: ILogger
  url: string
  peerId: string
  islandId: string
  logConfig: LogConfig
}

export class WsTransport {
  public readonly name = 'ws'
  public readonly peerId: string
  public readonly islandId: string
  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<TransportMessage>()
  private aliases: Record<number, string> = {}
  private ws: WebSocket | null = null
  private logger: ILogger
  private url: string
  private statisticsCollector: StatisticsCollector
  public logConfig: LogConfig

  constructor({ logger, url, peerId, islandId, logConfig }: WsConfig) {
    this.peerId = peerId
    this.islandId = islandId
    this.logger = logger
    this.url = url
    this.logConfig = logConfig
    this.statisticsCollector = new StatisticsCollector()
  }

  onPeerPositionChange(_: string, __: Position3D) {}

  startStatistics() {
    this.statisticsCollector.start()
  }

  stopStatistics() {
    this.statisticsCollector.stop()
  }

  collectStatistics() {
    return this.statisticsCollector.collectStatistics()
  }

  async connect(): Promise<void> {
    if (this.ws) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url, 'comms')
        this.ws.binaryType = 'arraybuffer'
      } catch (err) {
        return reject(err)
      }

      this.ws.onerror = (event) => {
        this.logger.error('socket error', event)
        this.disconnect().catch(this.logger.error)
        reject(event)
      }

      this.ws.onclose = () => {
        this.logger.log('socket close')
        this.disconnect().catch(this.logger.error)
      }

      this.ws.onmessage = (event) => {
        this.onWsMessage(event).catch(this.logger.error)
      }

      this.ws.onopen = () => {
        if (this.logConfig.verbose) {
          this.logger.log('Connected')
        }
        resolve()
      }
    })
  }

  async send(body: Uint8Array, { identity }: SendOpts): Promise<void> {
    if (!this.ws) throw new Error('This transport is closed')

    const message: WsMessage = { data: undefined }

    const fromAlias = 0 // NOTE: this will be overriden by the server
    if (identity) {
      message.data = { $case: 'identityMessage', identityMessage: { body, fromAlias, identity: '' } }
    } else {
      message.data = { $case: 'systemMessage', systemMessage: { body, fromAlias } }
    }

    const d = WsMessage.encode(message).finish()
    this.ws.send(d)
  }

  async disconnect() {
    if (this.ws) {
      const ws = this.ws
      this.ws = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      ws.close()
      this.onDisconnectObservable.notifyObservers()
    }
  }

  async onWsMessage(event: MessageEvent) {
    let message: WsMessage
    try {
      message = WsMessage.decode(Reader.create(new Uint8Array(event.data)))
    } catch (e: any) {
      this.logger.error(`cannot process message ${e.toString()}`)
      return
    }

    if (!message.data) {
      return
    }

    const { $case } = message.data

    switch ($case) {
      case 'systemMessage': {
        const { systemMessage } = message.data
        const userId = this.aliases[systemMessage.fromAlias]
        if (!userId) {
          if (this.logConfig.verbose) {
            this.logger.log('Ignoring system message from unkown peer')
          }
          return
        }

        this.onMessageObservable.notifyObservers({
          peer: userId,
          payload: systemMessage.body
        })
        break
      }
      case 'identityMessage': {
        const { identityMessage } = message.data
        const userId = identityMessage.identity
        this.aliases[identityMessage.fromAlias] = userId

        this.onMessageObservable.notifyObservers({
          peer: userId,
          payload: identityMessage.body
        })
        break
      }
      default: {
        this.logger.log(`ignoring msg ${$case}`)
        break
      }
    }
  }
}
