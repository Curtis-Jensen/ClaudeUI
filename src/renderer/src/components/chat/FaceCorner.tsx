import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Mood } from '../../../../shared/mood'
import { caretPoint, gazeToward, NO_GAZE, type Gaze } from '../../lib/face-gaze'
import {
  BOARD_PX,
  clampThrow,
  HANG_MS,
  hitHoop,
  hoopFor,
  isHanging,
  isResting,
  keepInside,
  punch,
  PUNCH_GAP_MS,
  RIM_TUBE_PX,
  stepBallWithImpact,
  type Ball
} from '../../lib/face-throw'
import { isHoopEnabled } from '../../lib/hoop-setting'
import { playHappyNoise } from '../../lib/speak/pet-sound'
import {
  playBounce,
  playGrabPop,
  playPunch,
  playRimClank,
  playSettle,
  playSwish,
  playThrowWhoosh
} from '../../lib/speak/sfx'
import { HoopToggle } from './HoopToggle'
import { LookPicker } from './LookPicker'
import { MoodFace } from './MoodFace'
import { MoodPicker } from './MoodPicker'
import { ScopeToggle } from './ScopeToggle'
import { SfxToggle } from './SfxToggle'
import { JingleButton } from './JingleButton'
import { SpeakToggle } from './SpeakToggle'
import { TypingToggle } from './TypingToggle'

/** How long the settings menu stays up after the last pet or click. */
export const MENU_HIDE_MS = 6_000
/** How long the face looks pleased after a pet. */
export const PET_MOOD_MS = 1_800
/** How long the new-thread dance lasts; matches `.face-march` in app.css. */
export const DANCE_MS = 3_600
/** The newest dance already played. Module-level so a remounted face (the counter is still
 *  nonzero) does not replay it. */
let lastDanceStarted = 0
/** How far the pointer must travel with the button down before a press becomes a throw, not a pet. */
export const DRAG_START_PX = 6
/** The dim over the window while the ball is out: plain black, mostly see-through. */
const BACKDROP_TINT = 'rgba(0, 0, 0, 0.3)'
/** The ring that shows where the hand is while it is held down on the window. */
const HAND_RING_PX = 44
/** The hang spot's ring: a little wider than the face. */
const HANG_SPOT_PX = 80
/** Only the last stretch of pointer movement says how fast the throw was. */
const THROW_WINDOW_MS = 100
/** The hoop's colors: an orange rim and a white net. */
const RIM_COLOR = '#f97316'
const NET_COLOR = 'rgba(255, 255, 255, 0.75)'

type Sample = { x: number; y: number; t: number }
type Press = {
  pointerId: number
  startX: number
  startY: number
  /** From the pointer to the middle of the face, so the face stays where it was grabbed. */
  offsetX: number
  offsetY: number
  /** False until the pointer has travelled far enough to count as a throw. */
  dragging: boolean
  samples: Sample[]
}
/** Held in the hand, flying free, or rolling back to the corner. */
type Phase = 'held' | 'free' | 'home'

/**
 * The face in the corner. Tapping it pets it: it makes a happy noise, hops and looks happy
 * for a moment. The same tap brings up the little menu of sound switches, which tucks itself
 * away again a few seconds after the last tap, and stays up while the pointer is on it.
 *
 * Pressing and dragging picks it up instead: it turns into a basketball (the eyes stay, the
 * lines come on), follows the pointer, and when let go it flies off, bouncing around the window
 * until it lies still, then rolls back to its corner. It can be picked up again on the way.
 * With the hoop switched on (it starts off), a hoop hangs on the left wall while it is out: the
 * rim knocks it about, and a ball that drops through swishes, shakes the net and counts a basket.
 */
export function FaceCorner({
  mood,
  size,
  dances = 0
}: {
  mood: Mood
  size: number
  /** Goes up by one each time a new thread starts; the face does a little dance. */
  dances?: number
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const [pets, setPets] = useState(0)
  const [pleased, setPleased] = useState(false)
  // A face picked from the expressions menu, shown until the real mood changes.
  const [previewMood, setPreviewMood] = useState<Mood | null>(null)
  useEffect(() => setPreviewMood(null), [mood])
  const [thrown, setThrown] = useState(false)
  // Baskets scored since the face was last picked up from its corner.
  const [baskets, setBaskets] = useState(0)
  // Whether this outing has a hoop: read from the setting each time the face is picked up.
  const [hoopUp, setHoopUp] = useState(false)
  const hoopOn = useRef(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pleasedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const overMenu = useRef(false)
  const faceRef = useRef<HTMLButtonElement>(null)
  const flyRef = useRef<HTMLDivElement>(null)
  const [gaze, setGaze] = useState<Gaze>(NO_GAZE)

  // A new thread: the face hops in from the left edge of the window to its corner. While it
  // does, an overlay carries it (a copy at the corner's spot) and the corner itself stays empty.
  const [dance, setDance] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    if (dances === 0 || dances <= lastDanceStarted) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const box = faceRef.current?.getBoundingClientRect()
    if (!box) return
    lastDanceStarted = dances
    setDance({ left: box.left, top: box.top })
    // No cleanup: StrictMode's replay would cancel this timer and the early return above would
    // then keep it from restarting. Clearing state on an unmounted face is a no-op.
    setTimeout(() => setDance(null), DANCE_MS)
  }, [dances])

  const ball = useRef<Ball>({ x: 0, y: 0, vx: 0, vy: 0, angle: 0, spin: 0 })
  const press = useRef<Press | null>(null)
  const phase = useRef<Phase>('held')
  const restedAt = useRef<number | null>(null)
  // A hand held down on the dimmed window (not on the ball) punches the ball whenever it is near.
  const hand = useRef<{ x: number; y: number } | null>(null)
  const handRing = useRef<HTMLDivElement>(null)
  const lastPunch = useRef(0)
  const hangSpot = useRef<HTMLDivElement>(null)
  const dwellStart = useRef<number | null>(null)
  const [handDown, setHandDown] = useState(false)
  const frame = useRef(0)
  // A throw ends with a click on the face; that click is not a pet.
  const justThrown = useRef(false)
  const radius = size / 2

  // The eyes follow the pointer, a frame at a time, and while someone types they look at the
  // text cursor instead, until the pointer moves again. Someone who asked for less motion gets
  // eyes that stay put.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    let pointer: { x: number; y: number } | null = null
    const look = (): void => {
      frame = 0
      const el = flyRef.current ?? faceRef.current
      if (!el || !pointer) return
      const box = el.getBoundingClientRect()
      const next = gazeToward(
        box.left + box.width / 2,
        box.top + box.height / 2,
        pointer.x,
        pointer.y
      )
      setGaze((was) => (was.x === next.x && was.y === next.y ? was : next))
    }
    const onMove = (e: PointerEvent): void => {
      pointer = { x: e.clientX, y: e.clientY }
      if (!frame) frame = requestAnimationFrame(look)
    }
    // Typing or moving the cursor in a textarea: look at the cursor.
    const onType = (e: Event): void => {
      const target = e.target
      if (!(target instanceof HTMLTextAreaElement)) return
      pointer = caretPoint(target)
      if (!frame) frame = requestAnimationFrame(look)
    }
    // The pointer left the window: look straight ahead again.
    const onLeave = (): void => {
      pointer = null
      setGaze(NO_GAZE)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('input', onType, true)
    document.addEventListener('keyup', onType, true)
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('input', onType, true)
      document.removeEventListener('keyup', onType, true)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  // The look picker's panel is open: the menu holds it, so it must not tuck itself away mid-pick.
  const pickerOpen = useRef(false)

  const armHide = (): void => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (pickerOpen.current) return
    hideTimer.current = setTimeout(() => setMenuOpen(false), MENU_HIDE_MS)
  }

  const setPickerOpen = (open: boolean): void => {
    pickerOpen.current = open
    if (open) {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    } else if (!overMenu.current) {
      armHide()
    }
  }

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      if (pleasedTimer.current) clearTimeout(pleasedTimer.current)
      if (frame.current) cancelAnimationFrame(frame.current)
    },
    []
  )

  const pet = (): void => {
    playHappyNoise()
    setPets((count) => count + 1)
    setPleased(true)
    if (pleasedTimer.current) clearTimeout(pleasedTimer.current)
    pleasedTimer.current = setTimeout(() => setPleased(false), PET_MOOD_MS)
    setMenuOpen(true)
    if (!overMenu.current) armHide()
  }

  /** Puts the flying face where the ball is, without going through React. */
  const paint = (): void => {
    const el = flyRef.current
    if (!el) return
    const { x, y, angle } = ball.current
    el.style.transform = `translate3d(${x - radius}px, ${y - radius}px, 0)`
    el.style.setProperty('--ball-spin', `${angle}rad`)
  }

  const bounds = (): { width: number; height: number; radius: number } => ({
    width: window.innerWidth,
    height: window.innerHeight,
    radius
  })

  const stopLoop = (): void => {
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = 0
  }

  /** How fast the pointer is carrying the held ball, from its last stretch of movement. */
  const heldSpeed = (now: number): number => {
    const samples = press.current?.samples
    if (!samples || samples.length < 2) return 0
    const first = samples[0]
    const last = samples[samples.length - 1]
    // A pointer that has stopped sends no moves: the last ones are old.
    if (now - last.t > 80) return 0
    const seconds = (last.t - first.t) / 1000
    return seconds > 0.001 ? Math.hypot(last.x - first.x, last.y - first.y) / seconds : 0
  }

  /** Keeps the hang spot where the face lives, fills its ring while the ball rests on it, and hangs up. */
  const watchHangSpot = (now: number): void => {
    const box = faceRef.current?.getBoundingClientRect()
    if (!box) return
    const home = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    const spot = hangSpot.current
    if (spot) {
      spot.style.transform = `translate3d(${home.x - HANG_SPOT_PX / 2}px, ${home.y - HANG_SPOT_PX / 2}px, 0)`
    }
    const speed =
      phase.current === 'held' ? heldSpeed(now) : Math.hypot(ball.current.vx, ball.current.vy)
    if (isHanging(ball.current, speed, home, radius)) {
      dwellStart.current ??= now
      const progress = Math.min(1, (now - dwellStart.current) / HANG_MS)
      spot?.style.setProperty('--hang', String(progress))
      if (progress >= 1) hangUp()
    } else {
      dwellStart.current = null
      spot?.style.setProperty('--hang', '0')
    }
  }

  const startLoop = (): void => {
    stopLoop()
    let last = performance.now()
    const tick = (now: number): void => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      if (phase.current === 'free') {
        const before = ball.current
        const { ball: stepped, impact } = stepBallWithImpact(before, dt, bounds())
        ball.current = stepped
        if (hoopOn.current) {
          const hoopHit = hitHoop(before, stepped, hoopFor(bounds()), radius)
          ball.current = hoopHit.ball
          if (hoopHit.rimSpeed !== null) playRimClank(hoopHit.rimSpeed)
          if (hoopHit.scored) {
            playSwish()
            setBaskets((count) => count + 1)
          }
        }
        if (hand.current && now - lastPunch.current > PUNCH_GAP_MS) {
          const hit = punch(ball.current, hand.current, radius)
          if (hit) {
            ball.current = hit
            lastPunch.current = now
            playPunch(Math.hypot(hit.vx, hit.vy) / 1500)
          }
        }
        if (impact) playBounce(impact.speed)
        if (isResting(ball.current, bounds())) {
          if (restedAt.current === null) playSettle()
          restedAt.current ??= now
        } else {
          restedAt.current = null
        }
      } else if (phase.current === 'home') {
        const home = faceRef.current?.getBoundingClientRect()
        if (home) {
          const ease = 1 - Math.exp(-dt * 9)
          const b = ball.current
          const tx = home.left + home.width / 2
          const ty = home.top + home.height / 2
          ball.current = {
            ...b,
            x: b.x + (tx - b.x) * ease,
            y: b.y + (ty - b.y) * ease,
            angle: b.angle * (1 - ease)
          }
          if (Math.hypot(tx - ball.current.x, ty - ball.current.y) < 1.5) {
            frame.current = 0
            setThrown(false)
            return
          }
        }
      }
      if (phase.current !== 'home') watchHangSpot(now)
      paint()
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }

  // The flying face is drawn only after React has put it in the page: place it at once.
  useLayoutEffect(() => {
    if (thrown) paint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thrown])

  // The face stays a ball, with the window dimmed and blocked, until it is hung up: held (or left)
  // still on its spot in the corner for a moment, it rolls home and turns into the face again.
  const hangUp = (): void => {
    press.current = null
    onHandUp()
    dwellStart.current = null
    phase.current = 'home'
    playHappyNoise()
    if (!frame.current) startLoop()
  }

  const paintHand = (): void => {
    const el = handRing.current
    if (!el || !hand.current) return
    el.style.transform = `translate3d(${hand.current.x - HAND_RING_PX / 2}px, ${hand.current.y - HAND_RING_PX / 2}px, 0)`
  }
  useLayoutEffect(paintHand, [handDown])

  const onHandDown = (e: React.PointerEvent<HTMLElement>): void => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    hand.current = { x: e.clientX, y: e.clientY }
    lastPunch.current = 0
    setHandDown(true)
  }
  const onHandMove = (e: React.PointerEvent<HTMLElement>): void => {
    if (!hand.current) return
    hand.current = { x: e.clientX, y: e.clientY }
    paintHand()
  }
  const onHandUp = (): void => {
    hand.current = null
    setHandDown(false)
  }

  const record = (x: number, y: number): void => {
    const p = press.current
    if (!p) return
    const t = performance.now()
    p.samples.push({ x, y, t })
    while (p.samples.length > 2 && t - p.samples[0].t > THROW_WINDOW_MS) p.samples.shift()
  }

  const onPressStart = (e: React.PointerEvent<HTMLElement>): void => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const flying = thrown
    const center = flying
      ? { x: ball.current.x, y: ball.current.y }
      : (() => {
          const box = faceRef.current?.getBoundingClientRect()
          return box
            ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
            : { x: e.clientX, y: e.clientY }
        })()
    press.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: center.x - e.clientX,
      offsetY: center.y - e.clientY,
      // Picking the face up in mid-air needs no drag: it is already a ball.
      dragging: flying,
      samples: [{ x: e.clientX, y: e.clientY, t: performance.now() }]
    }
    if (flying) {
      playGrabPop()
      phase.current = 'held'
      restedAt.current = null
      ball.current = { ...ball.current, vx: 0, vy: 0, spin: 0 }
    }
  }

  const onPressMove = (e: React.PointerEvent<HTMLElement>): void => {
    const p = press.current
    if (!p || p.pointerId !== e.pointerId) return
    if (!p.dragging) {
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < DRAG_START_PX) return
      p.dragging = true
      const box = faceRef.current?.getBoundingClientRect()
      if (box)
        ball.current = { ...ball.current, x: box.left + box.width / 2, y: box.top + box.height / 2 }
      ball.current = { ...ball.current, vx: 0, vy: 0, spin: 0, angle: 0 }
      phase.current = 'held'
      restedAt.current = null
      playGrabPop()
      setBaskets(0)
      hoopOn.current = isHoopEnabled()
      setHoopUp(hoopOn.current)
      setThrown(true)
      startLoop()
    }
    record(e.clientX, e.clientY)
    ball.current = keepInside(
      { ...ball.current, x: e.clientX + p.offsetX, y: e.clientY + p.offsetY },
      bounds()
    )
    paint()
  }

  const onPressEnd = (e: React.PointerEvent<HTMLElement>): void => {
    const p = press.current
    if (!p || p.pointerId !== e.pointerId) return
    press.current = null
    if (!p.dragging) return
    justThrown.current = true
    setTimeout(() => {
      justThrown.current = false
    }, 0)
    const first = p.samples[0]
    const last = p.samples[p.samples.length - 1]
    const seconds = (last.t - first.t) / 1000
    const vx = seconds > 0.001 ? clampThrow((last.x - first.x) / seconds) : 0
    const vy = seconds > 0.001 ? clampThrow((last.y - first.y) / seconds) : 0
    ball.current = { ...ball.current, vx, vy, spin: vx / radius }
    phase.current = 'free'
    restedAt.current = null
    playThrowWhoosh(Math.hypot(vx, vy))
    if (!frame.current) startLoop()
  }

  const handlers = {
    onPointerDown: onPressStart,
    onPointerMove: onPressMove,
    onPointerUp: onPressEnd,
    onPointerCancel: onPressEnd
  }

  return (
    // Menu above the face, so opening it never moves the face you are petting.
    <div className="flex flex-col items-center gap-1">
      {menuOpen && (
        <div
          data-testid="FaceCorner.menu"
          className="pointer-events-auto flex flex-wrap justify-center gap-1 max-w-[124px] animate-fade-in"
          onPointerEnter={() => {
            overMenu.current = true
            if (hideTimer.current) clearTimeout(hideTimer.current)
          }}
          onPointerLeave={() => {
            overMenu.current = false
            armHide()
          }}
        >
          <SpeakToggle />
          <ScopeToggle />
          <TypingToggle />
          <LookPicker onOpenChange={setPickerOpen} />
          <MoodPicker
            mood={previewMood ?? mood}
            onPick={setPreviewMood}
            onOpenChange={setPickerOpen}
          />
          <SfxToggle />
          <HoopToggle />
          <JingleButton />
        </div>
      )}
      <button
        type="button"
        ref={faceRef}
        data-testid="FaceCorner.face"
        // Enter belongs to the chat (send, or end a recording), not to this button.
        data-enter-sends
        aria-label="Pet Claude"
        onClick={() => {
          if (justThrown.current) return
          pet()
        }}
        {...handlers}
        style={{ touchAction: 'none' }}
        className="pointer-events-auto cursor-grab rounded-full transition-transform active:scale-90 focus:outline-none"
      >
        {thrown || dance ? (
          // The face is out flying or dancing: keep its place in the corner.
          <div style={{ width: size, height: size }} />
        ) : (
          <div key={pets} className={pets > 0 ? 'pet-bounce' : undefined}>
            <MoodFace mood={pleased ? 'happy' : (previewMood ?? mood)} size={size} gaze={gaze} />
          </div>
        )}
      </button>
      {dance &&
        createPortal(
          <div
            data-testid="FaceCorner.dance"
            className="face-march"
            style={
              {
                position: 'fixed',
                left: dance.left,
                top: dance.top,
                width: size,
                height: size,
                zIndex: 1000,
                pointerEvents: 'none',
                '--travel': `${-dance.left - size}px`
              } as React.CSSProperties
            }
          >
            <div className="face-hop">
              <MoodFace mood="excited" size={size} gaze={NO_GAZE} />
            </div>
          </div>,
          document.body
        )}
      {thrown &&
        createPortal(
          <div
            data-testid="FaceCorner.backdrop"
            onPointerDown={onHandDown}
            onPointerMove={onHandMove}
            onPointerUp={onHandUp}
            onPointerCancel={onHandUp}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
              background: BACKDROP_TINT,
              touchAction: 'none'
            }}
            className="animate-fade-in"
          />,
          document.body
        )}
      {thrown &&
        createPortal(
          <div
            ref={hangSpot}
            data-testid="FaceCorner.hangSpot"
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: HANG_SPOT_PX,
              height: HANG_SPOT_PX,
              zIndex: 1000,
              pointerEvents: 'none'
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '9999px',
                border: '3px dashed rgba(255, 255, 255, 0.7)',
                background: 'rgba(255, 255, 255, 0.08)'
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '9999px',
                background:
                  'conic-gradient(var(--thread-color, #fb923c) calc(var(--hang, 0) * 360deg), transparent 0)',
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 7px), #000 0)',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 7px), #000 0)'
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: 6,
                whiteSpace: 'nowrap',
                fontSize: 12,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.9)',
                textShadow: '0 1px 4px rgba(0, 0, 0, 0.6)'
              }}
            >
              hang me up here
            </div>
          </div>,
          document.body
        )}
      {thrown && hoopUp && <Hoop {...hoopFor(bounds())} baskets={baskets} />}
      {thrown &&
        handDown &&
        createPortal(
          <div
            ref={handRing}
            data-testid="FaceCorner.hand"
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: HAND_RING_PX,
              height: HAND_RING_PX,
              zIndex: 1000,
              pointerEvents: 'none',
              borderRadius: '9999px',
              border: '3px solid rgba(255, 255, 255, 0.85)',
              background: 'rgba(255, 255, 255, 0.15)'
            }}
          />,
          document.body
        )}
      {thrown &&
        createPortal(
          <div
            ref={flyRef}
            data-testid="FaceCorner.thrown"
            {...handlers}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: size,
              height: size,
              zIndex: 1000,
              touchAction: 'none'
            }}
            className="cursor-grab select-none"
          >
            <MoodFace mood={previewMood ?? mood} size={size} gaze={gaze} ball />
          </div>,
          document.body
        )}
    </div>
  )
}

/** The hoop on the left wall, drawn where `hoopFor` put it, with the baskets scored so far. */
function Hoop({
  rimY,
  backX,
  frontX,
  boardTop,
  boardBottom,
  baskets
}: ReturnType<typeof hoopFor> & { baskets: number }): React.JSX.Element {
  const width = frontX + RIM_TUBE_PX
  const height = boardBottom - boardTop
  const rim = rimY - boardTop
  const netDepth = (frontX - backX) * 0.8
  const netInset = (frontX - backX) * 0.2
  const strands = 5
  return createPortal(
    <div
      data-testid="FaceCorner.hoop"
      style={{
        position: 'fixed',
        left: 0,
        top: boardTop,
        width,
        height: rim + netDepth,
        zIndex: 1000,
        pointerEvents: 'none'
      }}
    >
      <svg width={width} height={rim + netDepth} aria-hidden>
        <rect x={0} y={0} width={BOARD_PX} height={height} rx={2} fill="rgba(255, 255, 255, 0.9)" />
        {/* A basket shakes the net and dips the rim; the key replays it for each one. */}
        <g
          key={`net-${baskets}`}
          className={baskets > 0 ? 'hoop-net-swish' : undefined}
          stroke={NET_COLOR}
          strokeWidth={1.5}
          fill="none"
        >
          {Array.from({ length: strands + 1 }, (_, i) => {
            const top = backX + ((frontX - backX) * i) / strands
            const bottom = backX + netInset + ((frontX - backX - netInset * 2) * i) / strands
            return <line key={i} x1={top} y1={rim} x2={bottom} y2={rim + netDepth} />
          })}
          {[0.33, 0.66, 1].map((at) => (
            <line
              key={at}
              x1={backX + netInset * at}
              y1={rim + netDepth * at}
              x2={frontX - netInset * at}
              y2={rim + netDepth * at}
            />
          ))}
        </g>
        <line
          key={`rim-${baskets}`}
          className={baskets > 0 ? 'hoop-rim-dip' : undefined}
          x1={backX - 2}
          y1={rim}
          x2={frontX}
          y2={rim}
          stroke={RIM_COLOR}
          strokeWidth={RIM_TUBE_PX * 2}
          strokeLinecap="round"
        />
      </svg>
      {baskets > 0 && (
        <div
          key={baskets}
          data-testid="FaceCorner.baskets"
          className="pet-bounce"
          style={{
            position: 'absolute',
            left: BOARD_PX + 6,
            top: 0,
            whiteSpace: 'nowrap',
            fontSize: 13,
            fontWeight: 700,
            color: 'rgba(255, 255, 255, 0.95)',
            textShadow: '0 1px 4px rgba(0, 0, 0, 0.6)'
          }}
        >
          Swish! {baskets}
        </div>
      )}
    </div>,
    document.body
  )
}
