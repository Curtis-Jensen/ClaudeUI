import { useState } from 'react'
import { playToggle } from '../../lib/speak/sfx'
import { getSpeakScope, setSpeakScope, type SpeakScope } from '../../lib/speak/kokoro-speaker'

/**
 * A small button that picks what is read aloud on its own: only the summary at the end of a
 * turn, or every reply including the short check-ins while work is going on.
 */
export function ScopeToggle(): React.JSX.Element {
  const [scope, setScope] = useState<SpeakScope>(getSpeakScope)
  const summaryOnly = scope === 'final'

  const toggle = (): void => {
    const next: SpeakScope = summaryOnly ? 'all' : 'final'
    setScope(next)
    setSpeakScope(next)
    playToggle(next === 'final')
  }

  return (
    <button
      type="button"
      data-testid="ScopeToggle"
      data-enter-sends
      aria-pressed={summaryOnly}
      onClick={toggle}
      title={
        summaryOnly
          ? 'Reading only the summary at the end. Click to read every reply.'
          : 'Reading every reply. Click to read only the summary at the end.'
      }
      className={`pointer-events-auto w-7 h-7 flex items-center justify-center rounded-full border border-border bg-bg-tertiary transition-colors cursor-pointer ${
        summaryOnly ? 'text-accent' : 'text-text-muted hover:text-text-primary'
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
        {/* A stack of replies; with summary only, just the last one is solid. */}
        <path d="M5 6h14" opacity={summaryOnly ? 0.35 : 1} />
        <path d="M5 11h14" opacity={summaryOnly ? 0.35 : 1} />
        <path d="M5 16h14" strokeWidth={summaryOnly ? 3.2 : 2} />
      </svg>
    </button>
  )
}
