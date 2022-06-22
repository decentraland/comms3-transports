/**
 * Transport Enum
 * @public
 */
export type TransportName = 'livekit' | 'ws' | 'p2p' | 'dummy'

/**
 * Transport
 * @public
 */
export type Transport = {
  name: TransportName

  connect(): Promise<void>
  send(msg: Uint8Array, opts: SendOpts): Promise<void>
  disconnect(): Promise<void>

  onPeerPositionChange(peerId: string, position: Position3D): void
}

/**
 * A message from a transport
 * @public
 */
export type TransportMessage = {
  payload: Uint8Array
  peer: string
}

/**
 * A message from a transport
 * NOTE: identity is a hint to the transport, the transport may choose to augment
 * the message with peer identity data if the protocol itself doesn't have its
 * own way of identifying the peer
 * @public
 */
export type SendOpts = {
  reliable: boolean
  identity?: boolean
}

/**
 * Transport Statistics
 * @public
 */
export type TransportStatistics = {
  time: number

  peerId: string
  islandId: string

  bytesSent: number
  bytesRecv: number
}

export type P2POnlyStatistics = TransportStatistics & {
  knownPeersCount: number
}

export type P2PStatistics = P2POnlyStatistics & TransportStatistics

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
