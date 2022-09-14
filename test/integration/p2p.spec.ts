import expect from 'expect'

import { delay } from '../helpers/delay'
import { InMemoryBFF, InMemoryBFFClient } from '../helpers/bff'
import { registerGlobals, registerWebRTCGlobals } from '../helpers/globals'

registerGlobals()
registerWebRTCGlobals()

import { P2PTransport } from '../../src/p2p/PeerToPeerTransport'
import { TransportMessage } from '../../src/Transport'
import { Position3D } from '../../src/types'
import { JoinIslandMessage } from '../../src/proto/archipelago'

// SEE https://github.com/node-webrtc/node-webrtc/issues/636
// process.on('beforeExit', (code) => process.exit(code))

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
        bff: new InMemoryBFFClient(peerId, bff),
        logger,
        peerId,
        islandId,
        logConfig: {
          debugMesh: false,
          debugWebRtcEnabled: false,
          debugUpdateNetwork: false,
          debugIceCandidates: false
        }
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
    const data = 'hello'
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const bff = new InMemoryBFF()

    const t1 = createP2PTransport('peer1', bff)
    await t1.connect()

    const peers = new Map<string, Position3D>()
    peers.set('peer1', [0, 0, 0])
    const t2 = createP2PTransport('peer2', bff, peers)
    await t2.connect()

    bff.publishSystemTopic(`island.${islandId}.peer_join`, createJoinIslandMessage('peer2'))

    await delay(100)

    const p1 = new Promise((resolve) => {
      t1.onMessageObservable.add(({ peer, payload }: TransportMessage) => {
        resolve([peer, decoder.decode(payload)])
      })
    })

    const p2 = new Promise((resolve) => {
      t2.onMessageObservable.add(({ peer, payload }: TransportMessage) => {
        resolve([peer, decoder.decode(payload)])
      })
    })

    t1.send(encoder.encode(data), { reliable: true })
    t2.send(encoder.encode(data), { reliable: false })

    expect(await p1).toEqual(['peer2', data])
    expect(await p2).toEqual(['peer1', data])

    await t1.disconnect()
    await t2.disconnect()
  })
})
