import { Observable } from 'mz-observable'
import { TransportMessage } from './types'

/**
 * DummyTransport, does nothing
 * @public
 */
export class DummyTransport {
  public readonly name = 'dummy'
  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<TransportMessage>()

  async connect(): Promise<void> {}
  async send(): Promise<void> {}
  async disconnect(): Promise<void> {}
  collectStatistics() {
    return {
      time: Date.now(),
      peerId: 'none',
      islandId: 'none',
      bytesSent: 0,
      bytesRecv: 0
    }
  }
}
