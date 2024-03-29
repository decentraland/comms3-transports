import * as jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

import { registerGlobals } from '../helpers/globals'

registerGlobals()

import { WsTransport } from '../../src/ws/WsTransport'
import { StatisticsCollector } from '../../src/statistics'

const WS_URL = process.env.TEST_WS_URL
const WS_SECRET = process.env.TEST_WS_SECRET

describe('ws', () => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const logger = console
  const islandId = 'I1'

  function createWsTransport(peerId: string) {
    const url = `${WS_URL}/${islandId}`
    const token = jwt.sign({ peerId }, WS_SECRET, {
      audience: url
    })

    const transport = new WsTransport({
      logger,
      url: `${url}?access_token=${token}`,
      logConfig: {verbose: true},
      statisticsCollector: new StatisticsCollector
    })
    return transport
  }

  it(
    'smoke test',
    async () => {
      const data = 'hello'
      const t1 = createWsTransport('peer1')
      const t2 = createWsTransport('peer2')

      await t1.connect()
      await t2.connect()

      const p1 = new Promise((resolve) => {
        t1.events.on('message', ({ address, data }) => {
          resolve([address, decoder.decode(data)])
        })
      })

      const p2 = new Promise((resolve) => {
        t2.events.on('message', ({ address, data }) => {
          resolve([address, decoder.decode(data)])
        })
      })

      t1.send(encoder.encode(data))
      t2.send(encoder.encode(data))

      expect(await p1).toEqual(['peer2', data])
      expect(await p2).toEqual(['peer1', data])
    },
    1000 * 20
  )
})
