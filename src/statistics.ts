import { TransportStatistics } from './types'

export class StatisticsCollector {
  private bytesSent = 0
  private bytesRecv = 0

  constructor(private transportName: string, private peerId: string, private islandId: string) {}

  collectStatistics(): TransportStatistics {
    return {
      time: Date.now(),
      transport: this.transportName,
      peerId: this.peerId,
      islandId: this.islandId,
      bytesSent: this.bytesSent,
      bytesRecv: this.bytesRecv
    }
  }

  onBytesSent(n: number) {
    this.bytesSent += n
  }

  onBytesRecv(n: number) {
    this.bytesRecv += n
  }
}
