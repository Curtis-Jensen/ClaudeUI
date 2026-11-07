import { useState } from 'react'
import { isHoopEnabled, setHoopEnabled } from '../../lib/hoop-setting'
import { playToggle } from '../../lib/speak/sfx'

/** A small hoop button: puts a basketball hoop on the wall while the face is thrown, or takes it down. */
export function HoopToggle(): React.JSX.Element {
  const [on, setOn] = useState(isHoopEnabled)

  const toggle = (): void => {
    const next = !on
    setOn(next)
    setHoopEnabled(next)
    playToggle(next)
  }

  return (
    <button
      type="button"
      data-testid="HoopToggle"
      data-enter-sends
      aria-pressed={on}
      onClick={toggle}
      title={on ? 'Basketball hoop on. Click to turn off.' : 'Put up a basketball hoop'}
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
        <path d="M5 3h14v8H5z" />
        <path d="M7 11h10" />
        <path d="M8 11l1.5 9M16 11l-1.5 9M12 11v9" />
        {!on && <path d="M4 20L20 4" />}
      </svg>
    </button>
  )
}
