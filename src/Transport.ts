import { Observable } from 'mz-observable'

import { Position3D } from './types'

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
 * The base class for all the transports
 * @public
 */
export abstract class Transport {
  public onDisconnectObservable = new Observable<void>()
  public onMessageObservable = new Observable<TransportMessage>()

  abstract connect(): Promise<void>
  abstract send(msg: Uint8Array, opts: SendOpts): Promise<void>
  abstract disconnect(): Promise<void>

  onPeerPositionChange(_: string, __: Position3D): void {}
}
