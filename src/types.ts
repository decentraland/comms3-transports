/**
 * Position
 * @public
 */
export type Position3D = [number, number, number]

/**
 * Logger config
 * @public
 */
export type ILogger = {
  error(message: string | Error, ...args: any[]): void
  log(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  info(message: string, ...args: any[]): void
  trace(message: string, ...args: any[]): void
}

export type TopicListener = any

export type BFFConnection = {
  publishToTopic(topic: string, payload: Uint8Array): Promise<void>
  addPeerTopicListener(topic: string, handler: (data: Uint8Array, peerId: string) => void): Promise<TopicListener>

  addSystemTopicListener(topic: string, handler: (data: Uint8Array) => void): Promise<TopicListener>

  removePeerTopicListener(l: TopicListener): Promise<void>
  removeSystemTopicListener(l: TopicListener): Promise<void>
}
