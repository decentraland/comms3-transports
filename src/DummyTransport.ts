import { Transport } from './Transport'

/**
 * DummyTransport, does nothing
 * @public
 */
export class DummyTransport extends Transport {
  async connect(): Promise<void> {}
  async send(): Promise<void> {}
  async disconnect(): Promise<void> {}
  collectStatistics() {
    return {
      time: Date.now(),
      transport: 'dummy',
      peerId: 'none',
      islandId: 'none',
      bytesSent: 0,
      bytesRecv: 0
    }
  }
}
