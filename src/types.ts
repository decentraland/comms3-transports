import { Emitter } from 'mitt'

/**
 * Transport Enum
 * @public
 */
export type TransportName = 'livekit' | 'ws' | 'p2p' | 'dummy'

/**
 * Minimum transport interface
 * @public
 */
export type MinimumTransport = {
  events: Emitter<MinimumTransport.Events>
  send(data: Uint8Array, hints: MinimumTransport.SendOpts): void
  disconnect(): Promise<void>
  connect(): Promise<void>
}

/**
 * @public
 */
export namespace MinimumTransport {
  export type DisconnectionEvent = {
    /**
     * Whether or no the disconnection was caused due to a
     * kick.
     */
    kicked: boolean

    /**
     * This field signals if the disconnection was caused by an error and thus
     * a reconnection should be retried or notified to the user
     */
    error?: Error
  }

  export type PeerDisconnectedEvent = {
    /**
     * The address of the peer that was disconnected.
     */
    address: string
  }

  export type MessageEvent = {
    data: Uint8Array
    /**
     * Sender address
     */
    address: string
  }

  export type Events = {
    PEER_DISCONNECTED: PeerDisconnectedEvent
    DISCONNECTION: DisconnectionEvent
    message: MessageEvent
  }

  /**
   * Send options
   * @public
   */
  export type SendOpts = {
    reliable?: boolean
  }
}

/**
 * Transport
 * @public
 */
export type CommsV3Transport = MinimumTransport & {
  name: TransportName

  // TODO: this method seems like a leaky abstraction
  onPeerPositionChange(address: string, position: Position3D): void
}

export type CommsDisconnectionEvent = {
  kicked: boolean
}

export type CommsPeerDisconnectedEvent = {
  address: string
}

/**
 * Transport Statistics
 * @public
 */
export type TransportStatistics = {
  beginTime: number
  endTime: number

  bytesSent: number
  bytesRecv: number
  messagesSent: number
  messagesRecv: number

  custom?: Record<string, any>
}

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
  addPeerTopicListener(
    topic: string,
    handler: (data: Uint8Array, peerId: string) => Promise<void>
  ): Promise<TopicListener>

  addSystemTopicListener(topic: string, handler: (data: Uint8Array) => Promise<void>): Promise<TopicListener>

  removePeerTopicListener(l: TopicListener): Promise<void>
  removeSystemTopicListener(l: TopicListener): Promise<void>
}
