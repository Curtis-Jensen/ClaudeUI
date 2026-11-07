import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../../../../shared/types'
import { enqueueSpeech, getSpeakScope, isSpeakingEnabled, stopSpeaking } from './kokoro-speaker'

export const SPEAK_UNREACHABLE_EVENT = 'claudeui:speak-unreachable'

function textOf(message: ChatMessage): string {
  return message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n')
}

type Watch = {
  sessionId: string | null
  isRunning: boolean
  /** Only replies that arrive after a turn started are read; opening a chat reads nothing. */
  armed: boolean
  /** Messages already read, or that were there before the turn began. */
  seen: Set<string>
}

function say(message: ChatMessage): void {
  void enqueueSpeech(textOf(message), { key: message.id }).then((reached) => {
    if (!reached) window.dispatchEvent(new Event(SPEAK_UNREACHABLE_EVENT))
  })
}

/**
 * Reads replies aloud on its own, while reading is on (it is by default). What it reads
 * depends on the scope: only the closing summary of a turn (the default), or every reply as
 * soon as it is finished, the short check-ins between tool calls included. A new turn, or
 * another session coming into view, goes quiet.
 */
export function useSpeakReplies(
  sessionId: string | null,
  messages: readonly ChatMessage[],
  isRunning: boolean
): void {
  const watch = useRef<Watch>({ sessionId, isRunning, armed: false, seen: new Set() })

  useEffect(() => {
    let current = watch.current
    if (current.sessionId !== sessionId) {
      stopSpeaking()
      // A new chat gets its id after the first send, so its first turn is already running here.
      const firstTurnOfNewChat = current.sessionId === null && isRunning
      watch.current = {
        sessionId,
        isRunning,
        armed: firstTurnOfNewChat,
        seen: new Set(firstTurnOfNewChat ? messages.map((m) => m.id) : [])
      }
      return
    }
    const wasRunning = current.isRunning
    if (isRunning && !wasRunning) {
      stopSpeaking()
      current = { ...current, armed: true, seen: new Set(messages.map((m) => m.id)) }
      watch.current = current
    }
    current.isRunning = isRunning
    if (!current.armed) return
    const enabled = isSpeakingEnabled()

    if (getSpeakScope() === 'final') {
      // Only when the turn has just ended: the last reply with words in it is the summary.
      if (isRunning || !wasRunning) return
      let summary: ChatMessage | null = null
      for (let i = messages.length - 1; i >= 0 && !summary; i--) {
        const message = messages[i]
        if (current.seen.has(message.id)) break
        if (message.role === 'assistant' && textOf(message).trim()) summary = message
      }
      for (const message of messages) current.seen.add(message.id)
      if (summary && enabled) say(summary)
      return
    }

    // Unread replies are at the end; stop at the first message already accounted for.
    const unread: ChatMessage[] = []
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]
      if (current.seen.has(message.id)) break
      if (message.role !== 'assistant') continue
      if (i === messages.length - 1 && isRunning) continue
      unread.push(message)
    }
    for (const message of unread.reverse()) {
      current.seen.add(message.id)
      if (enabled && textOf(message)) say(message)
    }
  }, [sessionId, messages, isRunning])
}
