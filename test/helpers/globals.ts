import { TextEncoder, TextDecoder } from 'util'
import { RTCPeerConnection, RTCDataChannel } from 'wrtc'

export function registerGlobals() {
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}

export function registerWebRTCGlobals() {
  global.RTCPeerConnection = RTCPeerConnection
}

export function patchLivekit() {
  // NOTE(hugo): there is a problem between wrtc and the livekit client, wrtc data channel returns a ArrayBuffer as part of the MessageEvent,
  // and the client client should handle it, but for some reason they ArrayBuffer implementations are different, which means the `instanceof ArrayBuffer` is failing,
  // to solve this, I'm hoooking the dispatchEvent function and transforming the data
  ;(function (dispatchEvent) {
    RTCDataChannel.prototype.dispatchEvent = function (event: any) {
      if (event.type === 'message' && this['onmessage']) {
        const listener = this['onmessage']
        this['onmessage'] = async (event: any) => {
          const a = new Uint8Array(event.data)
          event.data = new Blob([a])
          event.data.arrayBuffer = async () => {
            return a.buffer
          }
          listener.call(this, event)
        }
      }
      return dispatchEvent.apply(this, [event])
    }
  })(RTCDataChannel.prototype.dispatchEvent)
}
