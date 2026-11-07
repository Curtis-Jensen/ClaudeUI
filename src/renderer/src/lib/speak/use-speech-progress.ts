import { useCallback, useEffect, useState } from 'react'
import { getSpeechProgress, type SpeechProgress } from './kokoro-speaker'

/** The playhead, read ten times a second while the voice is going; `refresh` reads it at once. */
export function useSpeechProgress(
  active: boolean,
  paused: boolean
): [SpeechProgress | null, () => void] {
  const [progress, setProgress] = useState<SpeechProgress | null>(null)
  const refresh = useCallback((): void => setProgress(getSpeechProgress()), [])
  useEffect(() => {
    if (!active) return
    setProgress(getSpeechProgress())
    if (paused) return
    const id = window.setInterval(() => setProgress(getSpeechProgress()), 100)
    return () => window.clearInterval(id)
  }, [active, paused])
  return [progress, refresh]
}
