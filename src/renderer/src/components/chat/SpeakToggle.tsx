import { useEffect, useState } from 'react'
import { isSpeakingEnabled, setSpeakingEnabled, speak } from '../../lib/speak/kokoro-speaker'
import { SPEAK_UNREACHABLE_EVENT } from '../../lib/speak/use-speak-replies'

const START_HINT = 'Voice server is not running. In a terminal: ~/Tools/voice/start-kokoro.sh'

/** A small speaker button: reads my replies aloud in the local Kokoro voice. */
export function SpeakToggle(): React.JSX.Element {
  const [on, setOn] = useState(isSpeakingEnabled)
  const [unreachable, setUnreachable] = useState(false)

  useEffect(() => {
    const onUnreachable = (): void => setUnreachable(true)
    window.addEventListener(SPEAK_UNREACHABLE_EVENT, onUnreachable)
    return () => window.removeEventListener(SPEAK_UNREACHABLE_EVENT, onUnreachable)
  }, [])

  const toggle = (): void => {
    const next = !on
    setOn(next)
    setSpeakingEnabled(next)
    if (!next) return
    // A click is the gesture that lets the browser play sound, and it tells us at once
    // whether the voice server is up.
    setUnreachable(false)
    void speak('Voice on.').then((reached) => setUnreachable(!reached))
  }

  const title = unreachable
    ? START_HINT
    : on
      ? 'Reading replies aloud. Click to turn off.'
      : 'Read replies aloud'

  return (
    <button
      type="button"
      data-testid="SpeakToggle"
      data-enter-sends
      aria-pressed={on}
      onClick={toggle}
      title={title}
      className={`pointer-events-auto w-7 h-7 flex items-center justify-center rounded-full border border-border bg-bg-tertiary transition-colors cursor-default ${
        unreachable
          ? 'text-red-400'
          : on
            ? 'text-accent'
            : 'text-text-muted hover:text-text-primary'
      }`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 5L6 9H3v6h3l5 4V5z" />
        {on ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        ) : (
          <>
            <path d="M16 9l5 6" />
            <path d="M21 9l-5 6" />
          </>
        )}
      </svg>
    </button>
  )
}
