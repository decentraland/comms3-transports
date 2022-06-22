import { TransportStatistics } from './types'

export class StatisticsCollector {
  private bytesSent = 0
  private bytesRecv = 0

  collectStatistics(): TransportStatistics {
    return {
      time: Date.now(),
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
