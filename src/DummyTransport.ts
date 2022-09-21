import mitt from 'mitt'
import { Position3D, CommsV3Transport, MinimumTransport } from './types'

/**
 * DummyTransport, does nothing
 * @public
 */
export class DummyTransport implements CommsV3Transport {
  public readonly events = mitt<MinimumTransport.Events>()
  public readonly name = 'dummy'
  public readonly peerId = 'none'
  public readonly islandId = 'none'

  async connect(): Promise<void> {}
  async send(): Promise<void> {}
  async disconnect(): Promise<void> {}
  onPeerPositionChange(_: string, __: Position3D) {}
}
