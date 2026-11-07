import { useEffect, useRef } from 'react'
import { playDone, playError, playSend } from './sfx'

type RunState = 'idle' | 'running' | 'error' | 'disconnected'

/**
 * Cues for a chat: a swish when you send a message, a chime when a turn finishes, a buzz when
 * it fails. Switching to another chat is not a send or a finish, so it plays nothing.
 */
export function useTurnSounds(
  sessionId: string | null,
  state: RunState,
  lastUserMessageId: string | null
): void {
  const seen = useRef<{ sessionId: string | null; state: RunState; user: string | null } | null>(
    null
  )

  useEffect(() => {
    const before = seen.current
    seen.current = { sessionId, state, user: lastUserMessageId }
    if (!before || before.sessionId !== sessionId) return
    if (lastUserMessageId && lastUserMessageId !== before.user) playSend()
    if (before.state === 'running' && state === 'idle') playDone()
    else if (before.state !== 'error' && state === 'error') playError()
  }, [sessionId, state, lastUserMessageId])
}
