import { TopicListener } from '../../src/types'

export type TestTopicListener = {
  peerId: string
  pattern: string

  systemHandler?: (data: Uint8Array) => void
  peerHandler?: (data: Uint8Array, peerId: string) => void
}

export class InMemoryBFF {
  private listeners = new Set<TestTopicListener>()

  async publishSystemTopic(topic: string, payload: Uint8Array): Promise<void> {
    this.listeners.forEach((l) => {
      const sPattern = l.pattern.split('.')
      const sTopic = topic.split('.')
      if (sPattern.length !== sTopic.length) {
        return
      }
      for (let i = 0; i < sTopic.length; i++) {
        if (sPattern[i] !== '*' && sPattern[i] !== sTopic[i]) {
          return
        }
      }
      l!.systemHandler(payload)
    })
  }

  async publishToTopic(peerId: string, topic: string, payload: Uint8Array): Promise<void> {
    this.listeners.forEach((l) => {
      const sPattern = l.pattern.split('.')
      const sTopic = topic.split('.')
      if (sPattern.length !== sTopic.length) {
        return
      }
      for (let i = 0; i < sTopic.length; i++) {
        if (sPattern[i] !== '*' && sPattern[i] !== sTopic[i]) {
          return
        }
      }
      l!.peerHandler(payload, peerId)
    })
  }

  async addPeerTopicListener(
    peerId: string,
    topic: string,
    handler: (data: Uint8Array, peerId: string) => void
  ): Promise<TopicListener> {
    const l = {
      peerId,
      pattern: topic,
      peerHandler: handler
    }
    this.listeners.add(l)
    return l
  }

  async addSystemTopicListener(
    peerId: string,
    topic: string,
    handler: (data: Uint8Array) => void
  ): Promise<TopicListener> {
    const l = {
      peerId,
      pattern: topic,
      systemHandler: handler
    }
    this.listeners.add(l)
    return l
  }

  async removePeerTopicListener(l: TopicListener): Promise<void> {
    this.listeners.delete(l as TestTopicListener)
  }
  async removeSystemTopicListener(l: TopicListener): Promise<void> {
    this.listeners.delete(l as TestTopicListener)
  }
}

export class InMemoryBFFClient {
  constructor(private peerId: string, private bff: InMemoryBFF) {}

  publishToTopic(topic: string, payload: Uint8Array): Promise<void> {
    return this.bff.publishToTopic(this.peerId, topic, payload)
  }

  addPeerTopicListener(topic: string, handler: (data: Uint8Array, peerId: string) => void): Promise<TopicListener> {
    return this.bff.addPeerTopicListener(this.peerId, topic, handler)
  }

  addSystemTopicListener(topic: string, handler: (data: Uint8Array) => void): Promise<TopicListener> {
    return this.bff.addSystemTopicListener(this.peerId, topic, handler)
  }

  removePeerTopicListener(l: TopicListener): Promise<void> {
    return this.bff.removePeerTopicListener(l)
  }
  removeSystemTopicListener(l: TopicListener): Promise<void> {
    return this.bff.removeSystemTopicListener(l)
  }
}
