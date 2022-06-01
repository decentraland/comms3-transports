/* eslint-disable */
import Long from 'long'
import * as _m0 from 'protobufjs/minimal'

export const protobufPackage = ''

export interface Subscription {
  subscriptionId: number
}

export interface SubscriptionRequest {
  topic: string
}

export interface PeerTopicSubscriptionResultElem {
  payload: Uint8Array
  topic: string
  sender: string
}

export interface SystemTopicSubscriptionResultElem {
  payload: Uint8Array
  topic: string
}

export interface PublishToTopicRequest {
  topic: string
  payload: Uint8Array
}

export interface PublishToTopicResult {
  ok: boolean
}

export interface UnsubscriptionResult {
  ok: boolean
}

function createBaseSubscription(): Subscription {
  return { subscriptionId: 0 }
}

export const Subscription = {
  encode(message: Subscription, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.subscriptionId !== 0) {
      writer.uint32(8).uint32(message.subscriptionId)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Subscription {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseSubscription()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.subscriptionId = reader.uint32()
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): Subscription {
    return {
      subscriptionId: isSet(object.subscriptionId) ? Number(object.subscriptionId) : 0
    }
  },

  toJSON(message: Subscription): unknown {
    const obj: any = {}
    message.subscriptionId !== undefined && (obj.subscriptionId = Math.round(message.subscriptionId))
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<Subscription>, I>>(object: I): Subscription {
    const message = createBaseSubscription()
    message.subscriptionId = object.subscriptionId ?? 0
    return message
  }
}

function createBaseSubscriptionRequest(): SubscriptionRequest {
  return { topic: '' }
}

export const SubscriptionRequest = {
  encode(message: SubscriptionRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.topic !== '') {
      writer.uint32(10).string(message.topic)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SubscriptionRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseSubscriptionRequest()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.topic = reader.string()
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): SubscriptionRequest {
    return {
      topic: isSet(object.topic) ? String(object.topic) : ''
    }
  },

  toJSON(message: SubscriptionRequest): unknown {
    const obj: any = {}
    message.topic !== undefined && (obj.topic = message.topic)
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<SubscriptionRequest>, I>>(object: I): SubscriptionRequest {
    const message = createBaseSubscriptionRequest()
    message.topic = object.topic ?? ''
    return message
  }
}

function createBasePeerTopicSubscriptionResultElem(): PeerTopicSubscriptionResultElem {
  return { payload: new Uint8Array(), topic: '', sender: '' }
}

export const PeerTopicSubscriptionResultElem = {
  encode(message: PeerTopicSubscriptionResultElem, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.payload.length !== 0) {
      writer.uint32(10).bytes(message.payload)
    }
    if (message.topic !== '') {
      writer.uint32(18).string(message.topic)
    }
    if (message.sender !== '') {
      writer.uint32(26).string(message.sender)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PeerTopicSubscriptionResultElem {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBasePeerTopicSubscriptionResultElem()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.payload = reader.bytes()
          break
        case 2:
          message.topic = reader.string()
          break
        case 3:
          message.sender = reader.string()
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): PeerTopicSubscriptionResultElem {
    return {
      payload: isSet(object.payload) ? bytesFromBase64(object.payload) : new Uint8Array(),
      topic: isSet(object.topic) ? String(object.topic) : '',
      sender: isSet(object.sender) ? String(object.sender) : ''
    }
  },

  toJSON(message: PeerTopicSubscriptionResultElem): unknown {
    const obj: any = {}
    message.payload !== undefined &&
      (obj.payload = base64FromBytes(message.payload !== undefined ? message.payload : new Uint8Array()))
    message.topic !== undefined && (obj.topic = message.topic)
    message.sender !== undefined && (obj.sender = message.sender)
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<PeerTopicSubscriptionResultElem>, I>>(
    object: I
  ): PeerTopicSubscriptionResultElem {
    const message = createBasePeerTopicSubscriptionResultElem()
    message.payload = object.payload ?? new Uint8Array()
    message.topic = object.topic ?? ''
    message.sender = object.sender ?? ''
    return message
  }
}

function createBaseSystemTopicSubscriptionResultElem(): SystemTopicSubscriptionResultElem {
  return { payload: new Uint8Array(), topic: '' }
}

export const SystemTopicSubscriptionResultElem = {
  encode(message: SystemTopicSubscriptionResultElem, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.payload.length !== 0) {
      writer.uint32(10).bytes(message.payload)
    }
    if (message.topic !== '') {
      writer.uint32(18).string(message.topic)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SystemTopicSubscriptionResultElem {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseSystemTopicSubscriptionResultElem()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.payload = reader.bytes()
          break
        case 2:
          message.topic = reader.string()
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): SystemTopicSubscriptionResultElem {
    return {
      payload: isSet(object.payload) ? bytesFromBase64(object.payload) : new Uint8Array(),
      topic: isSet(object.topic) ? String(object.topic) : ''
    }
  },

  toJSON(message: SystemTopicSubscriptionResultElem): unknown {
    const obj: any = {}
    message.payload !== undefined &&
      (obj.payload = base64FromBytes(message.payload !== undefined ? message.payload : new Uint8Array()))
    message.topic !== undefined && (obj.topic = message.topic)
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<SystemTopicSubscriptionResultElem>, I>>(
    object: I
  ): SystemTopicSubscriptionResultElem {
    const message = createBaseSystemTopicSubscriptionResultElem()
    message.payload = object.payload ?? new Uint8Array()
    message.topic = object.topic ?? ''
    return message
  }
}

function createBasePublishToTopicRequest(): PublishToTopicRequest {
  return { topic: '', payload: new Uint8Array() }
}

export const PublishToTopicRequest = {
  encode(message: PublishToTopicRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.topic !== '') {
      writer.uint32(10).string(message.topic)
    }
    if (message.payload.length !== 0) {
      writer.uint32(18).bytes(message.payload)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PublishToTopicRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBasePublishToTopicRequest()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.topic = reader.string()
          break
        case 2:
          message.payload = reader.bytes()
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): PublishToTopicRequest {
    return {
      topic: isSet(object.topic) ? String(object.topic) : '',
      payload: isSet(object.payload) ? bytesFromBase64(object.payload) : new Uint8Array()
    }
  },

  toJSON(message: PublishToTopicRequest): unknown {
    const obj: any = {}
    message.topic !== undefined && (obj.topic = message.topic)
    message.payload !== undefined &&
      (obj.payload = base64FromBytes(message.payload !== undefined ? message.payload : new Uint8Array()))
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<PublishToTopicRequest>, I>>(object: I): PublishToTopicRequest {
    const message = createBasePublishToTopicRequest()
    message.topic = object.topic ?? ''
    message.payload = object.payload ?? new Uint8Array()
    return message
  }
}

function createBasePublishToTopicResult(): PublishToTopicResult {
  return { ok: false }
}

export const PublishToTopicResult = {
  encode(message: PublishToTopicResult, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.ok === true) {
      writer.uint32(8).bool(message.ok)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PublishToTopicResult {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBasePublishToTopicResult()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.ok = reader.bool()
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): PublishToTopicResult {
    return {
      ok: isSet(object.ok) ? Boolean(object.ok) : false
    }
  },

  toJSON(message: PublishToTopicResult): unknown {
    const obj: any = {}
    message.ok !== undefined && (obj.ok = message.ok)
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<PublishToTopicResult>, I>>(object: I): PublishToTopicResult {
    const message = createBasePublishToTopicResult()
    message.ok = object.ok ?? false
    return message
  }
}

function createBaseUnsubscriptionResult(): UnsubscriptionResult {
  return { ok: false }
}

export const UnsubscriptionResult = {
  encode(message: UnsubscriptionResult, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.ok === true) {
      writer.uint32(8).bool(message.ok)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UnsubscriptionResult {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseUnsubscriptionResult()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.ok = reader.bool()
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): UnsubscriptionResult {
    return {
      ok: isSet(object.ok) ? Boolean(object.ok) : false
    }
  },

  toJSON(message: UnsubscriptionResult): unknown {
    const obj: any = {}
    message.ok !== undefined && (obj.ok = message.ok)
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<UnsubscriptionResult>, I>>(object: I): UnsubscriptionResult {
    const message = createBaseUnsubscriptionResult()
    message.ok = object.ok ?? false
    return message
  }
}

export type CommsServiceDefinition = typeof CommsServiceDefinition
export const CommsServiceDefinition = {
  name: 'CommsService',
  fullName: 'CommsService',
  methods: {
    subscribeToPeerMessages: {
      name: 'SubscribeToPeerMessages',
      requestType: SubscriptionRequest,
      requestStream: false,
      responseType: Subscription,
      responseStream: false,
      options: {}
    },
    getPeerMessages: {
      name: 'GetPeerMessages',
      requestType: Subscription,
      requestStream: false,
      responseType: PeerTopicSubscriptionResultElem,
      responseStream: true,
      options: {}
    },
    unsubscribeToPeerMessages: {
      name: 'UnsubscribeToPeerMessages',
      requestType: Subscription,
      requestStream: false,
      responseType: UnsubscriptionResult,
      responseStream: false,
      options: {}
    },
    subscribeToSystemMessages: {
      name: 'SubscribeToSystemMessages',
      requestType: SubscriptionRequest,
      requestStream: false,
      responseType: Subscription,
      responseStream: false,
      options: {}
    },
    getSystemMessages: {
      name: 'GetSystemMessages',
      requestType: Subscription,
      requestStream: false,
      responseType: SystemTopicSubscriptionResultElem,
      responseStream: true,
      options: {}
    },
    unsubscribeToSystemMessages: {
      name: 'UnsubscribeToSystemMessages',
      requestType: Subscription,
      requestStream: false,
      responseType: UnsubscriptionResult,
      responseStream: false,
      options: {}
    },
    /** send a peer message to a topic */
    publishToTopic: {
      name: 'PublishToTopic',
      requestType: PublishToTopicRequest,
      requestStream: false,
      responseType: PublishToTopicResult,
      responseStream: false,
      options: {}
    }
  }
} as const

declare var self: any | undefined
declare var window: any | undefined
declare var global: any | undefined
var globalThis: any = (() => {
  if (typeof globalThis !== 'undefined') return globalThis
  if (typeof self !== 'undefined') return self
  if (typeof window !== 'undefined') return window
  if (typeof global !== 'undefined') return global
  throw 'Unable to locate global object'
})()

const atob: (b64: string) => string =
  globalThis.atob || ((b64) => globalThis.Buffer.from(b64, 'base64').toString('binary'))
function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; ++i) {
    arr[i] = bin.charCodeAt(i)
  }
  return arr
}

const btoa: (bin: string) => string =
  globalThis.btoa || ((bin) => globalThis.Buffer.from(bin, 'binary').toString('base64'))
function base64FromBytes(arr: Uint8Array): string {
  const bin: string[] = []
  arr.forEach((byte) => {
    bin.push(String.fromCharCode(byte))
  })
  return btoa(bin.join(''))
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined

export type DeepPartial<T> = T extends Builtin
  ? T
  : T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U>
  ? ReadonlyArray<DeepPartial<U>>
  : T extends {}
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>

type KeysOfUnion<T> = T extends T ? keyof T : never
export type Exact<P, I extends P> = P extends Builtin
  ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & Record<Exclude<keyof I, KeysOfUnion<P>>, never>

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any
  _m0.configure()
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined
}
