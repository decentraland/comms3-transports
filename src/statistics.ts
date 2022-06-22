import { TransportStatistics, P2POnlyStatistics, P2PStatistics } from './types'

export class StatisticsCollector {
  private bytesSent = 0
  private bytesRecv = 0

  constructor(private peerId: string, private islandId: string) {}

  collectStatistics(): TransportStatistics {
    return {
      time: Date.now(),
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

export class P2pStatisticsCollector extends StatisticsCollector {
  constructor(peerId: string, islandId: string) {
    super(peerId, islandId)
  }

  collectP2PStatistics(o: P2POnlyStatistics): P2PStatistics {
    const s = super.collectStatistics()
    return {
      ...s,
      ...o
    }
  }
}
