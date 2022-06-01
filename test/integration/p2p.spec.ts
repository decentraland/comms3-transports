import expect from 'expect'
import { RTCPeerConnection } from 'wrtc'

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

  function createJoinIslandMessage(peerId: string): Uint8Array {
    return JoinIslandMessage.encode({
      islandId,
      peerId
    }).finish()
  }

  it('smoke test', async () => {
    const bff = new InMemoryBFF()

    const t1 = createP2PTransport('peer1', bff)
    await t1.connect()

    const peers = new Map<string, Position3D>()
    peers.set('peer1', [0, 0, 0])
    const t2 = createP2PTransport('peer2', bff, peers)
    await t2.connect()

    bff.publishSystemTopic(`island.${islandId}.peer_join`, createJoinIslandMessage('peer2'))

    await delay(1000)

    expect(t1.mesh.isConnectedTo(t2.peerId)).toBeTruthy()
    expect(t2.mesh.isConnectedTo(t1.peerId)).toBeTruthy()

    t1.send(new Uint8Array(), { reliable: true })
    await new Promise((resolve) => {
      t2.onMessageObservable.add(({ peer, payload }: TransportMessage) => {
        console.log(`got message from ${peer}`, payload)
        resolve(null)
      })
    })

    await t1.disconnect()
    await t2.disconnect()

    await delay(1000)
  })
})
