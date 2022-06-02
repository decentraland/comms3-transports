import dotenv from 'dotenv'

dotenv.config()

import { AccessToken } from 'livekit-server-sdk'
import { patchLivekit, registerGlobals, registerWebRTCGlobals } from '../helpers/globals'

registerGlobals()
registerWebRTCGlobals()
patchLivekit()

import { LivekitTransport } from '../../src/livekit/LivekitTransport'
import { TransportMessage } from '../../src/Transport'

const LIVEKIT_URL = process.env.TEST_LIVEKIT_URL
const LIVEKIT_API_KEY = process.env.TEST_LIVEKIT_API_KEY
const LIVEKIT_API_SECRET = process.env.TEST_LIVEKIT_API_SECRET

describe('livekit', () => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const logger = console
  const islandId = 'I1'

  function createLivekitTransport(peerId: string) {
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: peerId
    })
    token.addGrant({ roomJoin: true, roomCreate: true, room: islandId })

    const transport = new LivekitTransport({
      logger,
      url: LIVEKIT_URL,
      token: token.toJwt()
    })
    return transport
  }

  it(
    'smoke test',
    async () => {
      const data = 'hello'
      const t1 = createLivekitTransport('peer1')
      const t2 = createLivekitTransport('peer2')

      await t1.connect()
      await t2.connect()

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
    },
    1000 * 20
  )
})
