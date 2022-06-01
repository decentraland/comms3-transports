import { AccessToken } from 'livekit-server-sdk'
import { RTCPeerConnection } from 'wrtc'

import { LivekitTransport } from '../../src/livekit/LivekitTransport'
window.RTCPeerConnection = RTCPeerConnection

const LIVEKIT_URL = 'http://127.0.0.1:7880'
const LIVEKIT_API_KEY = 'TEST_KEY'
const LIVEKIT_API_SECRET = 'TEST_SECRET'

describe('livekit', () => {
  const logger = console
  const islandId = 'I1'
  const peerId = 'peer1'

  it('smoke test', async () => {
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: peerId
    })
    token.addGrant({ roomJoin: true, roomCreate: true, room: islandId })

    const transport = new LivekitTransport({
      logger,
      url: LIVEKIT_URL,
      token: token.toJwt()
    })

    await transport.connect()
  })
})
