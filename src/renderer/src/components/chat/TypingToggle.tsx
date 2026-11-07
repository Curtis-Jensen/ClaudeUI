import { useState } from 'react'
import { playToggle } from '../../lib/speak/sfx'
import { isTypingSoundsEnabled, setTypingSoundsEnabled } from '../../lib/speak/typing-sounds'

/** A small keyboard button: turns the typing sound heard when Claude starts working on or off. */
export function TypingToggle(): React.JSX.Element {
  const [on, setOn] = useState(isTypingSoundsEnabled)

  const toggle = (): void => {
    const next = !on
    setOn(next)
    setTypingSoundsEnabled(next)
    playToggle(next)
  }

  return (
    <button
      type="button"
      data-testid="TypingToggle"
      data-enter-sends
      aria-pressed={on}
      onClick={toggle}
      title={
        on
          ? 'Typing sound when work starts. Click to turn off.'
          : 'Play a typing sound when work starts'
      }
      className={`pointer-events-auto w-7 h-7 flex items-center justify-center rounded-full border border-border bg-bg-tertiary transition-colors cursor-pointer ${
        on ? 'text-accent' : 'text-text-muted hover:text-text-primary'
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
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
        {!on && <path d="M4 20L20 4" />}
      </svg>
    </button>
  )
}
