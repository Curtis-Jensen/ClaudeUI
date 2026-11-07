import { playStartupJingle } from '../../lib/speak/sfx'

/** A small play button: plays the startup jingle on demand (silent while sound effects are off). */
export function JingleButton(): React.JSX.Element {
  return (
    <button
      type="button"
      data-testid="JingleButton"
      data-enter-sends
      onClick={playStartupJingle}
      title="Play the startup jingle"
      aria-label="Play the startup jingle"
      className="pointer-events-auto w-7 h-7 flex items-center justify-center rounded-full border border-border bg-bg-tertiary transition-colors cursor-pointer text-text-muted hover:text-text-primary"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
      </svg>
    </button>
  )
}
