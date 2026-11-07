/** The face as a thrown ball: where its middle is, how fast it moves, and how far it has turned. */
export type Ball = {
  x: number
  y: number
  /** Pixels per second. */
  vx: number
  vy: number
  /** Radians. */
  angle: number
  /** Radians per second. */
  spin: number
}

/** The window the ball bounces in: its size, and the ball's radius. */
export type Bounds = { width: number; height: number; radius: number }

export const GRAVITY = 1800
/** The share of speed a bounce keeps. */
export const BOUNCE = 0.75
/** The fastest a throw can be, per axis. */
export const MAX_THROW = 4000
const WALL_SPIN_KEPT = 0.8
const FLOOR_FRICTION = 0.98
const AIR_DRAG = 0.999
/** Below this upward speed a bounce on the floor stops instead of jittering. */
const SETTLE_SPEED = 60
const ROLL_STOP_SPEED = 10

export function clampThrow(speed: number): number {
  return Math.max(-MAX_THROW, Math.min(MAX_THROW, speed))
}

/** Where a ball held in place stays: inside the window. */
export function keepInside(ball: Ball, { width, height, radius }: Bounds): Ball {
  return {
    ...ball,
    x: Math.max(radius, Math.min(width - radius, ball.x)),
    y: Math.max(radius, Math.min(height - radius, ball.y))
  }
}

/** What a frame's bounce hit, and how fast it was going into it (pixels per second). */
export type Impact = {
  kind: 'floor' | 'wall' | 'corner'
  speed: number
}

/** How close to a second wall, in radii, a bounce must be to count as a corner. */
const CORNER_REACH = 1.6

/**
 * The ball one frame later (`dt` seconds): gravity, then a bounce off any wall it reached.
 * `impact` says what it hit, a floor, a wall or a corner (a hit near two walls at once), or
 * null when it hit nothing.
 */
export function stepBallWithImpact(
  ball: Ball,
  dt: number,
  bounds: Bounds
): { ball: Ball; impact: Impact | null } {
  const { width, height, radius } = bounds
  let { x, y, vx, vy, angle, spin } = ball
  vy += GRAVITY * dt
  vx *= AIR_DRAG
  x += vx * dt
  y += vy * dt
  angle += spin * dt

  let hitSide = false
  let hitFloor = false
  let hitCeiling = false
  let speed = 0

  if (x < radius || x > width - radius) {
    hitSide = true
    speed = Math.max(speed, Math.abs(vx))
    x = x < radius ? radius : width - radius
    vx = -vx * BOUNCE
    spin = -spin * WALL_SPIN_KEPT
  }
  if (y < radius) {
    hitCeiling = true
    speed = Math.max(speed, Math.abs(vy))
    y = radius
    vy = -vy * BOUNCE
  } else if (y > height - radius) {
    hitFloor = true
    speed = Math.max(speed, Math.abs(vy))
    y = height - radius
    vy = -vy * BOUNCE
    if (Math.abs(vy) < SETTLE_SPEED) vy = 0
    vx *= FLOOR_FRICTION
    if (Math.abs(vx) < ROLL_STOP_SPEED) vx = 0
    spin = vx / radius
  }

  const nearSide = x < radius * CORNER_REACH || x > width - radius * CORNER_REACH
  const nearTopOrBottom = y < radius * CORNER_REACH || y > height - radius * CORNER_REACH
  let impact: Impact | null = null
  if (hitSide || hitFloor || hitCeiling) {
    const corner = (hitSide && nearTopOrBottom) || ((hitFloor || hitCeiling) && nearSide)
    impact = { kind: corner ? 'corner' : hitSide || hitCeiling ? 'wall' : 'floor', speed }
  }
  return { ball: { x, y, vx, vy, angle, spin }, impact }
}

/** The ball one frame later: see `stepBallWithImpact`. */
export function stepBall(ball: Ball, dt: number, bounds: Bounds): Ball {
  return stepBallWithImpact(ball, dt, bounds).ball
}

/** True once the ball lies still on the floor. */
export function isResting(ball: Ball, { height, radius }: Bounds): boolean {
  return ball.y >= height - radius - 0.5 && ball.vy === 0 && ball.vx === 0
}

/** How far past the ball's edge a hand can still hit it, in pixels. */
export const PUNCH_REACH_PX = 14
/** The speed of a punch from a hand right at the ball's edge, in pixels per second. */
export const PUNCH_SPEED = 1500
/** Shortest time between two punches while the hand is held down, in milliseconds. */
export const PUNCH_GAP_MS = 130

/**
 * A punch from a hand at `hand`: the ball is knocked straight away from it, harder the closer the
 * hand is, and keeps a little of the speed it had. A hand held above the ball knocks it down, and
 * when it bounces back up the next punch sends it down again: a dribble. Null when the ball is
 * out of reach.
 */
export function punch(ball: Ball, hand: { x: number; y: number }, radius: number): Ball | null {
  const dx = ball.x - hand.x
  const dy = ball.y - hand.y
  const distance = Math.hypot(dx, dy)
  const reach = radius + PUNCH_REACH_PX
  if (distance > reach) return null
  // A hand right on the ball's middle punches it straight up.
  const [ux, uy] = distance < 1 ? [0, -1] : [dx / distance, dy / distance]
  const power = PUNCH_SPEED * (1 - 0.5 * (distance / reach))
  const vx = clampThrow(ball.vx * 0.3 + ux * power)
  const vy = clampThrow(ball.vy * 0.3 + uy * power)
  return { ...ball, vx, vy, spin: vx / radius }
}

/** How long the ball must stay still over its spot to be hung up, in milliseconds. */
export const HANG_MS = 375
/** The fastest the ball can be moving, in pixels per second, and still count as resting on its spot. */
export const HANG_MAX_SPEED = 160

/**
 * Whether the ball is resting on its spot (`home`, the middle of where the face lives): its middle
 * within one radius of the spot, and not moving fast. Held there for `HANG_MS` it is hung up.
 */
export function isHanging(
  ball: Ball,
  speed: number,
  home: { x: number; y: number },
  radius: number
): boolean {
  return Math.hypot(ball.x - home.x, ball.y - home.y) <= radius && speed <= HANG_MAX_SPEED
}

/**
 * The basketball hoop on the window's left wall, while the ball is out: a backboard flush on the
 * wall and a rim sticking out of it. The rim is two hard points (its back, at the board, and its
 * front) the ball bounces off, with the opening between them.
 */
export type Hoop = {
  /** The rim's height. */
  rimY: number
  /** The rim's back end, where it meets the board, and its front end. */
  backX: number
  frontX: number
  /** The board, from its top to its bottom. */
  boardTop: number
  boardBottom: number
}

/** How thick the backboard is: the rim starts where it ends. */
export const BOARD_PX = 10
/** The rim's tube: how far from its ends the ball touches it. */
export const RIM_TUBE_PX = 3
/** The share of speed a bounce off the rim keeps: a rim is less springy than a wall. */
const RIM_BOUNCE = 0.55

/** Where the hoop sits in a window: a third of the way down, wide enough for the ball to drop through. */
export function hoopFor({ width, height, radius }: Bounds): Hoop {
  const opening = Math.max(60, radius * 5)
  const rimY = Math.max(radius * 6, Math.round(height * 0.34))
  const backX = Math.min(BOARD_PX, width / 4)
  return {
    rimY,
    backX,
    frontX: backX + opening + RIM_TUBE_PX * 2,
    boardTop: rimY - Math.max(70, opening * 0.9),
    boardBottom: rimY + 14
  }
}

/** What the hoop did to the ball this frame: bounced it off the rim (how hard), and whether it went in. */
export type HoopHit = { ball: Ball; rimSpeed: number | null; scored: boolean }

/**
 * The ball after meeting the hoop, from where it was (`before`) and where the step put it
 * (`after`). It bounces off either end of the rim, and it scores when its middle drops down
 * through the opening between them.
 */
export function hitHoop(before: Ball, after: Ball, hoop: Hoop, radius: number): HoopHit {
  let ball = after
  let rimSpeed: number | null = null
  const reach = radius + RIM_TUBE_PX
  for (const x of [hoop.backX, hoop.frontX]) {
    // A ball dropped dead on the rim's end would balance there forever: it rolls off to the right.
    const dx = Math.abs(ball.x - x) < 0.5 ? 0.5 : ball.x - x
    const dy = ball.y - hoop.rimY
    const distance = Math.hypot(dx, dy)
    if (distance >= reach) continue
    const [nx, ny] = [dx / distance, dy / distance]
    const into = ball.vx * nx + ball.vy * ny
    ball = { ...ball, x: x + nx * reach, y: hoop.rimY + ny * reach }
    if (into < 0) {
      const push = (1 + RIM_BOUNCE) * into
      const vx = ball.vx - push * nx
      ball = { ...ball, vx, vy: ball.vy - push * ny, spin: vx / radius }
      rimSpeed = Math.max(rimSpeed ?? 0, -into)
    }
  }
  const dropped = before.y < hoop.rimY && ball.y >= hoop.rimY && ball.vy > 0
  const inside = ball.x > hoop.backX + RIM_TUBE_PX && ball.x < hoop.frontX - RIM_TUBE_PX
  return { ball, rimSpeed, scored: dropped && inside }
}
