import expect from 'expect'

import { InMemoryBFF, InMemoryBFFClient } from '../helpers/bff'
import { registerGlobals } from '../helpers/globals'

registerGlobals()

import { P2PTransport } from '../../src/p2p/PeerToPeerTransport'
import { Position3D } from '../../src/types'

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
          verbose: false,
          debugWebRtcEnabled: false,
          debugUpdateNetwork: false
        }
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

  it('offer should be rejected if peer is unknown', async () => {
    const bff = new InMemoryBFF()

    const peers = new Map<string, Position3D>()
    peers.set('peer2', [0, 0, 0])
    const t1 = createP2PTransport('peer1', bff)
    await t1.connect()

    bff.publishToTopic('peer2', 'peer1.offer', new Uint8Array())

    expect(t1.mesh.hasConnectionsFor('peer2')).toBeFalsy()

    await t1.disconnect()
  })
})
