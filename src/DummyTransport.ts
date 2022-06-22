import { Observable } from 'mz-observable'
import { Position3D, TransportMessage } from './types'

/**
 * DummyTransport, does nothing
 * @public
 */
export class DummyTransport {
  public readonly name = 'dummy'
  public readonly peerId = 'none'
  public readonly islandId = 'none'
  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<TransportMessage>()

  async connect(): Promise<void> {}
  async send(): Promise<void> {}
  async disconnect(): Promise<void> {}
  onPeerPositionChange(_: string, __: Position3D) {}

  collectStatistics() {
    return {
      time: Date.now(),
      bytesSent: 0,
      bytesRecv: 0
    }
  }
}
