import { useId } from 'react'
import type { Mood } from '../../../../shared/mood'
import { NO_GAZE, type Gaze } from '../../lib/face-gaze'

/**
 * A cartoon face: a flat orange circle with two solid dark eyes in the top third of the head.
 * No pupils, no brows, no shine. The mood is told by the shape of the eyes alone (round,
 * tall, squinting, arched, half shut, tilted) and by a small mark beside the head: a tear,
 * a sweat drop, sparkles, thought dots. Each mood also moves a little in its own way, and the
 * open eyes turn toward the pointer.
 */

// The head is the thread's color, the same one the window border has, so they always match.
// (Orange until a thread sets its own.)
const ORANGE = 'var(--thread-color, var(--color-orange-400, #fb923c))'
const OUTLINE = `color-mix(in srgb, ${ORANGE} 60%, black)`
// The head is a soft gradient of the thread's color: a lighter patch up and to the left, falling
// to a deeper edge down and to the right. All three stops are made from the thread's own color.
const HEAD_LIGHT = `color-mix(in srgb, ${ORANGE} 78%, white)`
const HEAD_DEEP = `color-mix(in srgb, ${ORANGE} 76%, black)`
const INK = 'var(--thread-ink, #2a1405)'
const CREAM = 'var(--thread-cream, #fff4dc)'
const SPARK = '#fff3b0'
const WATER = '#9fd8ff'

// A 48 by 48 drawing. The head spans rows 2 to 46, so its top third ends near row 17: the eyes
// are centred on row 15.
const EYE_Y = 15
const LEFT_X = 16
const RIGHT_X = 32

/** How far the open eyes slide toward the pointer, in drawing units. */
const GAZE_REACH_X = 2.6
const GAZE_REACH_Y = 2

type EyeShape =
  /** A solid oval. */
  | { kind: 'oval'; rx: number; ry: number }
  /** A round ring with a pale middle, wide with surprise. */
  | { kind: 'ring'; r: number }
  /** An arch (happy) or a bowl-shaped arc (content): a closed eye drawn as one stroke. */
  | { kind: 'arch' }
  | { kind: 'bowl' }
  /** A half-shut eye: flat on top, round underneath. */
  | { kind: 'lidded'; rx: number; ry: number }

type Eye = {
  shape: EyeShape
  /** Degrees. The right eye mirrors the left one unless the mood writes it out. */
  tilt?: number
  dx?: number
  dy?: number
}

type Mark = { x: number; y: number; color: string; kind: 'dot' | 'drop' | 'spark' }

type Look = {
  left: Eye
  right?: Eye
  /** Both eyes shift together: looking away. */
  shift?: readonly [number, number]
  /** Eyes shut, so there is nothing to blink and nothing to look with. */
  closed?: boolean
  /** How much the eyes follow the pointer: this mood already looks somewhere. Default 1. */
  gazeScale?: number
  /** A thought bubble over the head's top right corner. */
  thought?: boolean
  /** The little movement of the whole face (a class in app.css). */
  motion: string
  marks?: readonly Mark[]
}

const OVAL: Eye = { shape: { kind: 'oval', rx: 4, ry: 5.8 } }

const LOOKS: Record<Mood, Look> = {
  calm: { left: OVAL, motion: 'face-breathe' },
  happy: { left: { shape: { kind: 'arch' } }, closed: true, motion: 'face-bounce' },
  proud: { left: { shape: { kind: 'bowl' } }, closed: true, motion: 'face-nod' },
  excited: {
    left: { shape: { kind: 'oval', rx: 4.7, ry: 7.4 } },
    motion: 'face-bounce-fast',
    marks: [
      { x: 5, y: 7, color: SPARK, kind: 'spark' },
      { x: 43, y: 7, color: SPARK, kind: 'spark' },
      { x: 3, y: 17, color: SPARK, kind: 'spark' }
    ]
  },
  curious: {
    left: OVAL,
    right: { shape: { kind: 'oval', rx: 4.5, ry: 7 }, dy: -1.5 },
    motion: 'face-tilt'
  },
  thinking: {
    // One eye squints and the other is raised and wide, as with one brow down: a skeptical look,
    // turned up and away.
    left: { shape: { kind: 'lidded', rx: 4.4, ry: 5 }, dy: 1.5 },
    right: { shape: { kind: 'oval', rx: 4.2, ry: 6.6 }, dy: -1.5 },
    shift: [-1.5, -1.5],
    gazeScale: 0.35,
    motion: 'face-sway',
    thought: true
  },
  focused: { left: { shape: { kind: 'oval', rx: 5.4, ry: 3 } }, motion: 'face-still' },
  surprised: { left: { shape: { kind: 'ring', r: 5.6 } }, motion: 'face-pop' },
  worried: {
    left: { shape: { kind: 'oval', rx: 3.7, ry: 5 }, tilt: -14, dy: 1 },
    motion: 'face-shiver',
    marks: [{ x: 40, y: 15, color: WATER, kind: 'drop' }]
  },
  sad: {
    left: { shape: { kind: 'oval', rx: 3.7, ry: 4.8 }, tilt: 16, dy: 2 },
    gazeScale: 0.5,
    motion: 'face-droop',
    marks: [{ x: 14, y: 27, color: WATER, kind: 'drop' }]
  },
  tired: {
    left: { shape: { kind: 'lidded', rx: 5.2, ry: 4.2 }, dy: 2 },
    closed: true,
    motion: 'face-sag'
  },
  annoyed: {
    left: { shape: { kind: 'lidded', rx: 5.4, ry: 4.8 }, tilt: 14, dy: 1 },
    motion: 'face-twitch'
  }
}

function EyeDrawing({ eye, cx, side }: { eye: Eye; cx: number; side: 'left' | 'right' }) {
  const x = cx + (eye.dx ?? 0)
  const y = EYE_Y + (eye.dy ?? 0)
  const tilt = (eye.tilt ?? 0) * (side === 'left' ? 1 : -1)
  const turn = tilt ? `rotate(${tilt} ${x} ${y})` : undefined
  const { shape } = eye

  switch (shape.kind) {
    case 'oval':
      return <ellipse cx={x} cy={y} rx={shape.rx} ry={shape.ry} fill={INK} transform={turn} />
    case 'ring':
      return (
        <circle
          cx={x}
          cy={y}
          r={shape.r}
          fill={CREAM}
          stroke={INK}
          strokeWidth={2.4}
          transform={turn}
        />
      )
    case 'arch':
      return (
        <path
          d={`M${x - 5.2} ${y + 4} Q${x} ${y - 8.5} ${x + 5.2} ${y + 4}`}
          fill="none"
          stroke={INK}
          strokeWidth={3.4}
          strokeLinecap="round"
          transform={turn}
        />
      )
    case 'bowl':
      return (
        <path
          d={`M${x - 5.2} ${y - 2} Q${x} ${y + 8} ${x + 5.2} ${y - 2}`}
          fill="none"
          stroke={INK}
          strokeWidth={3.4}
          strokeLinecap="round"
          transform={turn}
        />
      )
    case 'lidded':
      // Flat across the top, round below: an eye half shut.
      return (
        <path
          d={`M${x - shape.rx} ${y - shape.ry * 0.4} H${x + shape.rx} A${shape.rx} ${shape.ry} 0 0 1 ${x - shape.rx} ${y - shape.ry * 0.4} Z`}
          fill={INK}
          transform={turn}
        />
      )
  }
}

/**
 * A thought bubble: a trail of circles growing as it rises from the head, ending in a cloud with
 * three dots that light up in turn. It reaches past the edge of the drawing, so the svg lets it.
 */
function ThoughtBubble(): React.JSX.Element {
  return (
    <g data-testid="MoodFace.thought" className="thought-bob">
      <circle cx={38.2} cy={6.2} r={1.4} fill={CREAM} stroke={OUTLINE} strokeWidth={0.8} />
      <circle cx={40.2} cy={1.8} r={2.2} fill={CREAM} stroke={OUTLINE} strokeWidth={0.8} />
      <ellipse cx={44} cy={-5.5} rx={8.5} ry={5.8} fill={CREAM} stroke={OUTLINE} strokeWidth={1} />
      {[39.5, 44, 48.5].map((cx, i) => (
        <circle
          key={cx}
          cx={cx}
          cy={-5.5}
          r={1.5}
          fill={INK}
          className="mark-pulse"
          style={{ animationDelay: `${i * 0.3}s` }}
        />
      ))}
    </g>
  )
}

const MARK_CLASS: Record<Mark['kind'], string> = {
  spark: 'mark-twinkle',
  dot: 'mark-pulse',
  drop: 'mark-fall'
}

function MarkDrawing({ mark, index }: { mark: Mark; index: number }): React.JSX.Element {
  const { x, y, color, kind } = mark
  // Marks of one kind take turns: a stagger, not a unison.
  const props = { className: MARK_CLASS[kind], style: { animationDelay: `${index * 0.35}s` } }
  if (kind === 'dot') return <circle cx={x} cy={y} r={1.6} fill={color} {...props} />
  if (kind === 'drop') {
    return (
      <path
        d={`M${x} ${y - 4} Q${x + 3.2} ${y + 0.5} ${x} ${y + 2.6} Q${x - 3.2} ${y + 0.5} ${x} ${y - 4} Z`}
        fill={color}
        {...props}
      />
    )
  }
  // A four-pointed sparkle.
  return (
    <path
      d={`M${x} ${y - 3.2} L${x + 0.9} ${y - 0.9} L${x + 3.2} ${y} L${x + 0.9} ${y + 0.9} L${x} ${y + 3.2} L${x - 0.9} ${y + 0.9} L${x - 3.2} ${y} L${x - 0.9} ${y - 0.9} Z`}
      fill={color}
      {...props}
    />
  )
}

/** How far the face sits from the panel's right edge: clear of the scrollbar. */
export const MOOD_FACE_INSET_PX = 24
const MOOD_FACE_GAP_PX = 8
const MOOD_FACE_MIN_PX = 28
const MOOD_FACE_MAX_PX = 220

/**
 * The face width that fills the free space beside the chat text, `freePx` being the
 * gap from the text's right edge to the panel's edge. Null when the gap is too
 * narrow for a face that would not overlap the text.
 */
export function moodFaceSizeForMargin(freePx: number): number | null {
  const size = Math.floor(freePx - MOOD_FACE_INSET_PX - MOOD_FACE_GAP_PX)
  if (size < MOOD_FACE_MIN_PX) return null
  return Math.min(size, MOOD_FACE_MAX_PX)
}

/** Turns whatever it styles about the middle of the head, by the CSS variable `--ball-spin`. */
const SPIN_STYLE: React.CSSProperties = {
  transform: 'rotate(var(--ball-spin, 0rad))',
  transformOrigin: '24px 24px'
}

/**
 * The lines of a basketball over the head: a cross and a curve on each side. They turn with the
 * CSS variable `--ball-spin` (an angle), the eyes with them, and the curves keep clear of the
 * eyes while upright.
 */
function BallSeams({ clipId }: { clipId: string }): React.JSX.Element {
  return (
    <g data-testid="MoodFace.seams" clipPath={`url(#${clipId})`}>
      <g
        fill="none"
        stroke={INK}
        strokeWidth={1.7}
        strokeLinecap="round"
        opacity={0.75}
        style={SPIN_STYLE}
      >
        <path d="M2 24H46" />
        <path d="M24 2V46" />
        <path d="M7 8Q17 24 7 40" />
        <path d="M41 8Q31 24 41 40" />
      </g>
    </g>
  )
}

export function MoodFace({
  mood,
  size = 40,
  gaze = NO_GAZE,
  ball = false,
  className = '',
  style
}: {
  mood: Mood
  /** Width and height in px. */
  size?: number
  /** Where the open eyes look, from the pointer. Closed eyes ignore it. */
  gaze?: Gaze
  /** Basketball lines over the head: the face is being thrown. */
  ball?: boolean
  className?: string
  style?: React.CSSProperties
}): React.JSX.Element {
  const look = LOOKS[mood]
  const [shiftX, shiftY] = look.shift ?? [0, 0]
  const left: Eye = {
    ...look.left,
    dx: (look.left.dx ?? 0) + shiftX,
    dy: (look.left.dy ?? 0) + shiftY
  }
  const rightBase = look.right ?? look.left
  const right: Eye = {
    ...rightBase,
    dx: (rightBase.dx ?? 0) + shiftX,
    dy: (rightBase.dy ?? 0) + shiftY
  }
  // An id for this face's gradient, safe inside url(#...).
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const gradientId = `face-head-${uid}`
  const shadowId = `face-shadow-${uid}`
  const clipId = `face-clip-${uid}`
  const follow = look.closed ? 0 : (look.gazeScale ?? 1)
  const glance = `translate(${(gaze.x * GAZE_REACH_X * follow).toFixed(2)}px, ${(gaze.y * GAZE_REACH_Y * follow).toFixed(2)}px)`
  return (
    <div
      data-testid="MoodFace"
      data-mood={mood}
      title={`Feeling ${mood}`}
      className={`select-none animate-fade-in ${className}`}
      style={style}
      key={mood}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        style={{ overflow: 'visible' }}
        aria-label={`Claude is feeling ${mood}`}
      >
        <defs>
          <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.7" />
          </filter>
          <clipPath id={clipId}>
            <circle cx="24" cy="24" r="22" />
          </clipPath>
          <radialGradient id={gradientId} cx="34%" cy="28%" r="85%">
            <stop offset="0" style={{ stopColor: HEAD_LIGHT }} />
            <stop offset="0.5" style={{ stopColor: ORANGE }} />
            <stop offset="1" style={{ stopColor: HEAD_DEEP }} />
          </radialGradient>
        </defs>
        <g className={`face-motion ${look.motion}`}>
          {/* A soft shadow on the underside, away from the light. */}
          <circle
            cx="26.2"
            cy="27.2"
            r="21.5"
            fill="#000"
            opacity="0.5"
            filter={`url(#${shadowId})`}
          />
          <circle
            cx="24"
            cy="24"
            r="22"
            fill={`url(#${gradientId})`}
            stroke={OUTLINE}
            strokeWidth="2"
          />
          {ball && <BallSeams clipId={clipId} />}
          {/* A thrown ball turns its eyes with the lines; they slide toward the pointer otherwise. */}
          <g style={ball ? SPIN_STYLE : undefined}>
            <g
              data-testid="MoodFace.eyes"
              style={{ transform: glance, transition: 'transform 140ms ease-out' }}
            >
              {/* Closed eyes stay still: only open eyes blink. */}
              <g className={look.closed ? undefined : 'mood-blink'}>
                <EyeDrawing eye={left} cx={LEFT_X} side="left" />
                <EyeDrawing eye={right} cx={RIGHT_X} side="right" />
              </g>
            </g>
          </g>
          {look.thought && <ThoughtBubble />}
          {look.marks?.map((mark, index) => (
            <MarkDrawing key={`${mark.kind}-${mark.x},${mark.y}`} mark={mark} index={index} />
          ))}
        </g>
      </svg>
    </div>
  )
}
