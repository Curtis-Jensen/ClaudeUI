import { useEffect, useRef, useState } from 'react'
import { MOODS, type Mood } from '../../../../shared/mood'
import { MoodFace } from './MoodFace'

/**
 * One button in the face menu that opens a panel with every facial expression. Picking one
 * shows it on the corner face until the next reply sets a real mood. The panel closes on a
 * click outside it, on Escape, or on the button again.
 */
export function MoodPicker({
  mood,
  onPick,
  onOpenChange
}: {
  /** The face the corner is showing now. */
  mood: Mood
  onPick: (mood: Mood) => void
  /** Told when the panel opens or closes, so the menu around it knows not to tuck itself away. */
  onOpenChange?: (open: boolean) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const openChange = useRef(onOpenChange)
  openChange.current = onOpenChange

  const toggle = (next: boolean): void => {
    setOpen(next)
    openChange.current?.(next)
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent): void => {
      if (root.current && !root.current.contains(e.target as Node)) toggle(false)
    }
    // Escape closes the panel and nothing else: it must not also stop a running turn.
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      toggle(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  // A closed panel must not leave the menu thinking it is open.
  useEffect(() => () => openChange.current?.(false), [])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-testid="MoodPicker.button"
        data-enter-sends
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => toggle(!open)}
        title="See all the facial expressions"
        className={`pointer-events-auto w-7 h-7 flex items-center justify-center rounded-full border border-border bg-bg-tertiary transition-colors cursor-pointer ${
          open ? 'text-accent' : 'text-text-muted hover:text-text-primary'
        }`}
      >
        <MoodFace mood="happy" size={16} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Facial expressions"
          data-testid="MoodPicker.panel"
          // Enter belongs to the chat while focus is anywhere in here.
          data-enter-sends
          className="pointer-events-auto absolute bottom-full right-0 mb-2 z-30 w-[240px] rounded-xl border border-border-bright bg-bg-secondary p-3 shadow-xl animate-fade-in"
        >
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Expressions
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                data-testid={`MoodPicker.mood.${m}`}
                aria-pressed={m === mood}
                onClick={() => onPick(m)}
                title={m}
                className="group flex flex-col items-center gap-1 cursor-pointer"
              >
                <span
                  className={`rounded-full border-2 p-0.5 ${
                    m === mood ? 'border-text-primary' : 'border-transparent'
                  }`}
                >
                  <MoodFace mood={m} size={34} />
                </span>
                <span
                  className={`text-[9px] leading-none ${
                    m === mood ? 'text-text-primary' : 'text-text-muted group-hover:text-text-primary'
                  }`}
                >
                  {m}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
