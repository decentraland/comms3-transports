import { TransportStatistics } from './types'

/**
 * @public
 */
export class StatisticsCollector {
  private startTime = 0
  private bytesSent = 0
  private bytesRecv = 0
  private messagesSent = 0
  private messagesRecv = 0

  start() {
    this.startTime = Date.now()
  }

  stop() {
    this.startTime = 0
  }

  collectStatistics(): TransportStatistics | undefined {
    if (!this.startTime) return

    const now = Date.now()
    const s = {
      beginTime: this.startTime,
      endTime: now,
      bytesSent: this.bytesSent,
      bytesRecv: this.bytesRecv,
      messagesSent: this.messagesSent,
      messagesRecv: this.messagesRecv
    }

    this.startTime = now
    return s
  }

  onBytesSent(n: number) {
    if (!this.startTime) return

    this.messagesSent += 1
    this.bytesSent += n
  }

  onBytesRecv(n: number) {
    if (!this.startTime) return

    this.messagesRecv += 1
    this.bytesRecv += n
  }
}
