import expect from 'expect'
import { RTCPeerConnection } from 'wrtc'

import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

window.RTCPeerConnection = RTCPeerConnection

import { P2PTransport } from '../../src/p2p/PeerToPeerTransport'
import { TransportMessage } from '../../src/Transport'
import { Position3D } from '../../src/types'
import { InMemoryBFF, InMemoryBFFClient } from '../bff'
import { JoinIslandMessage } from '../../src/proto/archipelago'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// SEE https://github.com/node-webrtc/node-webrtc/issues/636
process.on('beforeExit', (code) => process.exit(code))

describe('p2p', () => {
  const islandId = 'I1'

  function createP2PTransport(peerId: string, bff: InMemoryBFF, peers?: Map<string, Position3D>) {
    if (!peers) {
      peers = new Map<string, Position3D>()
    }

    const logger = {
      error: (message: string | Error, ...args: any[]) => {
        console.error(`${peerId}: ${message}`, ...args)
      },
      log: (message: string, ...args: any[]) => {
        console.log(`${peerId}: ${message}`, ...args)
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(`${peerId}: ${message}`, ...args)
      },
      info: (message: string, ...args: any[]) => {
        console.info(`${peerId}: ${message}`, ...args)
      },
      trace: (message: string, ...args: any[]) => {
        console.trace(`${peerId}: ${message}`, ...args)
      }
    }
    return new P2PTransport(
      {
        selfPosition: () => [0, 0, 0],
        verbose: false,
        debugWebRtcEnabled: false,
        bff: new InMemoryBFFClient(peerId, bff),
        logger,
        peerId,
        islandId
      },
      peers
    )
  }

  it('initial peers are added as known peers', async () => {
    const bff = new InMemoryBFF()

    const peers = new Map<string, Position3D>()
    peers.set('peer2', [0, 0, 0])
    const t1 = createP2PTransport('peer1', bff)
    expect(t1.isKnownPeer('peer2'))
  })
})
