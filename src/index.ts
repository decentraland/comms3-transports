import { IslandChangedMessage } from './proto/archipelago'
import { BFFConnection, ILogger, Position3D, Transport } from './types'
import { WsTransport } from './ws/WsTransport'
import { LivekitTransport } from './livekit/LivekitTransport'
import { P2PTransport, RelaySuspensionConfig } from './p2p/PeerToPeerTransport'

export * from './DummyTransport'
export { Position3D, TransportName, Transport } from './types'

/**
 * Transports config
 * @public
 */
export type TransportsConfig = {
  logger: ILogger
  bff: BFFConnection
  selfPosition: () => Position3D | undefined
  peerId: string
  livekit: {
    verbose: boolean
  }
  p2p: {
    verbose: boolean
    debugWebRtcEnabled: boolean
    relaySuspensionConfig?: RelaySuspensionConfig
  }
}

/**
 * Creates a transport based on a TransportsConfig and a island changed message
 * @public
 */
export function createTransport(
  config: TransportsConfig,
  islandChangedMessage: IslandChangedMessage
): Transport | Transport | Transport | null {
  const connStr = islandChangedMessage.connStr
  const { logger, peerId, bff } = config

  const islandId = islandChangedMessage.islandId

  if (connStr.startsWith('ws-room:')) {
    const url = connStr.substring('ws-room:'.length)
    return new WsTransport({
      logger,
      url,
      peerId,
      islandId
    })
  }

  if (connStr.startsWith('livekit:')) {
    const s = connStr.substring('livekit:'.length)
    const [url, params] = s.split('?')
    const token = new URLSearchParams(params).get('access_token')
    if (!token) {
      throw new Error('No access token')
    }
    return new LivekitTransport({
      logger,
      url,
      token,
      peerId,
      islandId,
      verbose: config.livekit.verbose
    })
  }

  if (connStr.startsWith('p2p:')) {
    const peers = new Map<string, Position3D>()
    for (const [id, p] of Object.entries(islandChangedMessage.peers)) {
      if (peerId !== id) {
        peers.set(id, [p.x, p.y, p.z])
      }
    }
    return new P2PTransport(
      {
        logger,
        bff,
        peerId,
        islandId,
        selfPosition: config.selfPosition,
        ...config.p2p
      },
      peers
    )
  }

  return null
}
