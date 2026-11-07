import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  getSpeakingKey,
  getSpeechTimeline,
  isSpeechPaused,
  seekSpeech,
  skipSpeech,
  subscribeSpeaking
} from '../../lib/speak/kokoro-speaker'
import {
  charAtY,
  findAnchors,
  lineYAtChar,
  measureStops,
  spokenCharAtPoint,
  type SpeechAnchor
} from '../../lib/speak/speech-anchors'
import { useSpeechProgress } from '../../lib/speak/use-speech-progress'

/** How far a message's wrapper reaches into the left margin to make room for the bar (ChatPanel). */
export const SPEECH_RAIL_GUTTER_PX = 20
const KEY_SKIP_SECONDS = 5

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * A vertical playback bar down the left side of the message being read aloud, as tall as the
 * message. It runs top to bottom like the text does: the coloured part is what has been said,
 * the lighter part is how much of the rest is already made and ready to play. Click or drag it
 * to start from the middle. Click a line of the message itself and the voice starts that
 * sentence. The thumb sits beside the line being read, because each paragraph on screen is
 * matched to its words in the voice (code and tables, which are not read, take no time).
 * Put it inside a `relative` message; it shows only while that message is the one being read.
 */
export function SpeechRail({ messageId }: { messageId: string }): React.JSX.Element | null {
  const isMobile = useIsMobile()
  const speaking = useSyncExternalStore(subscribeSpeaking, () => getSpeakingKey() === messageId)
  const paused = useSyncExternalStore(subscribeSpeaking, isSpeechPaused)
  const [progress, refresh] = useSpeechProgress(speaking, paused)
  // Where the thumb is (0 to 1) while it is being dragged: the voice only jumps when it is let go.
  const [scrub, setScrub] = useState<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const anchorsRef = useRef<{ spoken: string; anchors: SpeechAnchor[] } | null>(null)
  const shown = !isMobile && speaking && progress !== null

  // The paragraphs of this message, found in the spoken text again only when something changed.
  const anchorsIn = (container: HTMLElement, spoken: string): SpeechAnchor[] => {
    const known = anchorsRef.current
    if (known && known.spoken === spoken && known.anchors.every((a) => a.element.isConnected)) {
      return known.anchors
    }
    const anchors = findAnchors(container, spoken)
    anchorsRef.current = { spoken, anchors }
    return anchors
  }

  useEffect(() => {
    const container = trackRef.current?.parentElement
    if (!shown || !container) return
    const onClick = (event: MouseEvent): void => {
      const target = event.target as Element
      if (event.button !== 0 || trackRef.current?.contains(target)) return
      if (target.closest('a, button, input, textarea, summary, pre, table')) return
      // Selecting words to copy ends in a click too; leave that alone.
      if (window.getSelection()?.isCollapsed === false) return
      const timeline = getSpeechTimeline()
      if (!timeline) return
      const char = spokenCharAtPoint(
        anchorsIn(container, timeline.text),
        timeline.text,
        event.clientX,
        event.clientY
      )
      if (char === null) return
      seekSpeech(timeline.secondsAt(char))
      refresh()
    }
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [shown, refresh])

  if (!shown || !progress) return null

  const { duration, loaded } = progress
  const container = trackRef.current?.parentElement
  const timeline = getSpeechTimeline()
  // Where the words sit down the message; without it the bar falls back to plain elapsed time.
  const anchors = container && timeline ? anchorsIn(container, timeline.text) : []
  const containerTop = container?.getBoundingClientRect().top ?? 0
  const stops = timeline ? measureStops(anchors, containerTop) : []
  const height = container?.getBoundingClientRect().height ?? 0
  const useStops = timeline !== null && stops.length >= 2 && height > 0
  // The bar runs from the middle of the first spoken line to the middle of the last, which is
  // exactly where the thumb can go: not over a "Thought for" bar or tool cards above and below
  // the words, and not half a line past either end.
  const firstLine = useStops ? lineYAtChar(anchors, containerTop, 0) : null
  const lastLine = useStops ? lineYAtChar(anchors, containerTop, timeline.text.length) : null
  const spanTop = firstLine ?? 0
  const spanHeight = firstLine !== null && lastLine !== null ? Math.max(lastLine - firstLine, 0) : 0
  const bounded = useStops && firstLine !== null

  // The thumb never slides: it sits on a line and hops to the next when the voice gets there.
  const secondsToFraction = (seconds: number): number => {
    if (bounded) {
      const y = lineYAtChar(anchors, containerTop, timeline.charAt(seconds))
      return spanHeight > 0 ? Math.min(Math.max(((y ?? spanTop) - spanTop) / spanHeight, 0), 1) : 0
    }
    return duration > 0 ? Math.min(seconds / duration, 1) : 0
  }
  const fractionToSeconds = (fraction: number): number =>
    bounded
      ? timeline.secondsAt(charAtY(stops, spanTop + fraction * spanHeight))
      : fraction * duration

  const played = secondsToFraction(progress.position)
  const ready = secondsToFraction(loaded)
  const thumb = scrub ?? played
  const seconds = scrub !== null ? fractionToSeconds(scrub) : progress.position

  const fractionAt = (clientY: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.height === 0) return 0
    return Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1)
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const step =
      event.key === 'ArrowUp' || event.key === 'ArrowLeft'
        ? -KEY_SKIP_SECONDS
        : event.key === 'ArrowDown' || event.key === 'ArrowRight'
          ? KEY_SKIP_SECONDS
          : null
    if (step === null) return
    event.preventDefault()
    skipSpeech(step)
    refresh()
  }

  return (
    <div
      ref={trackRef}
      data-testid="SpeechRail"
      data-enter-sends
      role="slider"
      tabIndex={0}
      aria-label="Position in the message"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(seconds)}
      aria-valuetext={`${formatTime(seconds)} of ${formatTime(duration)}`}
      title="Drag to move through the message, or click a line to start there"
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setScrub(fractionAt(event.clientY))
      }}
      onPointerMove={(event) => {
        if (scrub !== null) setScrub(fractionAt(event.clientY))
      }}
      onPointerUp={(event) => {
        if (scrub === null) return
        seekSpeech(fractionToSeconds(fractionAt(event.clientY)))
        setScrub(null)
        refresh()
      }}
      onPointerCancel={() => setScrub(null)}
      style={bounded ? { top: spanTop, height: spanHeight } : undefined}
      className={`absolute -left-4 w-3 cursor-pointer touch-none outline-none animate-fade-in focus-visible:ring-1 focus-visible:ring-accent ${
        bounded ? '' : 'inset-y-0'
      }`}
    >
      <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 overflow-hidden rounded-full bg-bg-hover">
        <div
          data-testid="SpeechRail.loaded"
          className="absolute inset-x-0 top-0 bg-text-muted/40"
          style={{ height: `${ready * 100}%` }}
        />
        <div
          data-testid="SpeechRail.played"
          className="absolute inset-x-0 top-0 bg-accent"
          style={{ height: `${thumb * 100}%` }}
        />
      </div>
      <div
        data-testid="SpeechRail.thumb"
        className="absolute left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
        style={{ top: `${thumb * 100}%` }}
      />
    </div>
  )
}
