import { useEffect } from 'react'
import { isSpeechPlaying } from './kokoro-speaker'
import { isTypingSoundsEnabled, playTypingBurst, stopTypingSounds } from './typing-sounds'

/** One short burst of typing when a turn starts, skipped while the voice is talking. */
export function useTypingSounds(isRunning: boolean): void {
  useEffect(() => {
    if (!isRunning || !isTypingSoundsEnabled()) return
    playTypingBurst(isSpeechPlaying)
    return () => stopTypingSounds()
  }, [isRunning])
}
