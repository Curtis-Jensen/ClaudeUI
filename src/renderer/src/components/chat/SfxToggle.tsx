import { useState } from 'react'
import { isSfxEnabled, playToggle, setSfxEnabled } from '../../lib/speak/sfx'

/** A small bell button: turns the sound effects (bounces, send, done, errors, switches) on or off. */
export function SfxToggle(): React.JSX.Element {
  const [on, setOn] = useState(isSfxEnabled)

  const toggle = (): void => {
    const next = !on
    setOn(next)
    setSfxEnabled(next)
    playToggle(next)
  }

  return (
    <button
      type="button"
      data-testid="SfxToggle"
      data-enter-sends
      aria-pressed={on}
      onClick={toggle}
      title={on ? 'Sound effects on. Click to turn off.' : 'Play sound effects'}
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
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        {!on && <path d="M4 20L20 4" />}
      </svg>
    </button>
  )
}
