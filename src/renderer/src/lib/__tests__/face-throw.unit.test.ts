import { describe, expect, it } from 'vitest'
import {
  BOUNCE,
  clampThrow,
  HANG_MAX_SPEED,
  hitHoop,
  hoopFor,
  isHanging,
  isResting,
  keepInside,
  MAX_THROW,
  punch,
  PUNCH_REACH_PX,
  stepBall,
  stepBallWithImpact,
  type Ball,
  type Bounds
} from '../face-throw'

const BOUNDS: Bounds = { width: 800, height: 600, radius: 20 }
const BALL: Ball = { x: 400, y: 300, vx: 0, vy: 0, angle: 0, spin: 0 }

describe('stepBall', () => {
  it('falls', () => {
    const next = stepBall(BALL, 0.016, BOUNDS)
    expect(next.vy).toBeGreaterThan(0)
    expect(next.y).toBeGreaterThan(BALL.y)
  })

  it('bounces off the floor, keeping part of its speed', () => {
    const falling = { ...BALL, y: 579, vy: 500 }
    const next = stepBall(falling, 0.016, BOUNDS)
    expect(next.y).toBe(BOUNDS.height - BOUNDS.radius)
    expect(next.vy).toBeLessThan(0)
    expect(Math.abs(next.vy)).toBeLessThan(500 * 1.1)
    expect(Math.abs(next.vy)).toBeGreaterThan(500 * BOUNCE * 0.5)
  })

  it('bounces off the side walls and turns its spin around', () => {
    const flying = { ...BALL, x: 790, vx: 900, spin: 3 }
    const next = stepBall(flying, 0.016, BOUNDS)
    expect(next.x).toBe(BOUNDS.width - BOUNDS.radius)
    expect(next.vx).toBeLessThan(0)
    expect(next.spin).toBeLessThan(0)
  })

  it('bounces off the ceiling', () => {
    const rising = { ...BALL, y: 25, vy: -900 }
    const next = stepBall(rising, 0.016, BOUNDS)
    expect(next.y).toBe(BOUNDS.radius)
    expect(next.vy).toBeGreaterThan(0)
  })

  it('never leaves the window, however hard it is thrown', () => {
    let ball: Ball = { ...BALL, vx: MAX_THROW, vy: -MAX_THROW }
    for (let i = 0; i < 600; i++) {
      ball = stepBall(ball, 1 / 60, BOUNDS)
      expect(ball.x).toBeGreaterThanOrEqual(BOUNDS.radius)
      expect(ball.x).toBeLessThanOrEqual(BOUNDS.width - BOUNDS.radius)
      expect(ball.y).toBeGreaterThanOrEqual(BOUNDS.radius)
      expect(ball.y).toBeLessThanOrEqual(BOUNDS.height - BOUNDS.radius)
    }
  })

  it('comes to rest on the floor in the end', () => {
    let ball: Ball = { ...BALL, vx: 600, vy: -400 }
    for (let i = 0; i < 60 * 30 && !isResting(ball, BOUNDS); i++) {
      ball = stepBall(ball, 1 / 60, BOUNDS)
    }
    expect(isResting(ball, BOUNDS)).toBe(true)
  })
})

describe('stepBallWithImpact', () => {
  it('reports nothing in mid-air', () => {
    expect(stepBallWithImpact(BALL, 0.016, BOUNDS).impact).toBeNull()
  })

  it('reports a floor hit away from the sides, with its speed', () => {
    const { impact } = stepBallWithImpact({ ...BALL, y: 579, vy: 500 }, 0.016, BOUNDS)
    expect(impact?.kind).toBe('floor')
    expect(impact?.speed).toBeGreaterThan(500)
  })

  it('reports a side wall hit high above the floor', () => {
    const { impact } = stepBallWithImpact({ ...BALL, x: 790, vx: 900 }, 0.016, BOUNDS)
    expect(impact?.kind).toBe('wall')
  })

  it('reports a ceiling hit away from the sides as a wall knock', () => {
    const { impact } = stepBallWithImpact({ ...BALL, y: 25, vy: -900 }, 0.016, BOUNDS)
    expect(impact?.kind).toBe('wall')
  })

  it('reports a corner when a wall is hit down by the floor', () => {
    const { impact } = stepBallWithImpact({ ...BALL, x: 790, y: 575, vx: 900 }, 0.016, BOUNDS)
    expect(impact?.kind).toBe('corner')
  })

  it('reports a corner when the floor is hit up against a wall', () => {
    const { impact } = stepBallWithImpact({ ...BALL, x: 25, y: 579, vy: 500 }, 0.016, BOUNDS)
    expect(impact?.kind).toBe('corner')
  })
})

describe('isResting', () => {
  it('is false in the air', () => {
    expect(isResting(BALL, BOUNDS)).toBe(false)
  })

  it('is false on the floor while still moving', () => {
    expect(isResting({ ...BALL, y: 580, vx: 40 }, BOUNDS)).toBe(false)
  })
})

describe('keepInside', () => {
  it('pulls a ball held past the edge back into the window', () => {
    const held = keepInside({ ...BALL, x: -50, y: 900 }, BOUNDS)
    expect(held.x).toBe(BOUNDS.radius)
    expect(held.y).toBe(BOUNDS.height - BOUNDS.radius)
  })
})

describe('clampThrow', () => {
  it('limits a throw in either direction', () => {
    expect(clampThrow(99_999)).toBe(MAX_THROW)
    expect(clampThrow(-99_999)).toBe(-MAX_THROW)
    expect(clampThrow(120)).toBe(120)
  })
})

describe('punch', () => {
  const HAND = { x: 400, y: 200 }

  it('knocks the ball straight away from the hand', () => {
    const hit = punch({ ...BALL, x: 400, y: 230 }, HAND, 20)
    expect(hit?.vy).toBeGreaterThan(0)
    expect(Math.abs(hit?.vx ?? 1)).toBeLessThan(1)
  })

  it('knocks it sideways from a hand beside it', () => {
    const hit = punch({ ...BALL, x: 430, y: 200 }, HAND, 20)
    expect(hit?.vx).toBeGreaterThan(0)
  })

  it('hits harder the closer the hand is', () => {
    const near = punch({ ...BALL, x: 410, y: 200 }, HAND, 20)
    const far = punch({ ...BALL, x: 430, y: 200 }, HAND, 20)
    expect(near?.vx).toBeGreaterThan(far?.vx ?? Infinity)
  })

  it('misses a ball out of reach', () => {
    expect(punch({ ...BALL, x: 400 + 20 + PUNCH_REACH_PX + 5, y: 200 }, HAND, 20)).toBeNull()
  })

  it('punches a ball under the hand straight up', () => {
    const hit = punch({ ...BALL, x: HAND.x, y: HAND.y }, HAND, 20)
    expect(hit?.vy).toBeLessThan(0)
  })

  it('keeps a little of the speed the ball had', () => {
    const still = punch({ ...BALL, x: 400, y: 230 }, HAND, 20)
    const falling = punch({ ...BALL, x: 400, y: 230, vy: 1000 }, HAND, 20)
    expect(falling?.vy).toBeGreaterThan(still?.vy ?? Infinity)
  })
})

describe('isHanging', () => {
  const HOME = { x: 700, y: 500 }

  it('is true for a slow ball on its spot', () => {
    expect(isHanging({ ...BALL, x: 710, y: 495 }, 20, HOME, 20)).toBe(true)
  })

  it('is false for a ball off to the side', () => {
    expect(isHanging({ ...BALL, x: 760, y: 500 }, 0, HOME, 20)).toBe(false)
  })

  it('is false for a ball racing across its spot', () => {
    expect(isHanging({ ...BALL, x: 700, y: 500 }, HANG_MAX_SPEED + 100, HOME, 20)).toBe(false)
  })
})

describe('the hoop', () => {
  const hoop = hoopFor(BOUNDS)
  const middle = (hoop.backX + hoop.frontX) / 2

  it('sits on the left wall, wide enough for the ball to drop through', () => {
    expect(hoop.backX).toBeLessThan(BOUNDS.width / 4)
    expect(hoop.frontX - hoop.backX).toBeGreaterThan(BOUNDS.radius * 2)
    expect(hoop.boardTop).toBeLessThan(hoop.rimY)
  })

  it('counts a basket when the ball drops down through the opening', () => {
    const before = { ...BALL, x: middle, y: hoop.rimY - 4, vy: 300 }
    const after = { ...before, y: hoop.rimY + 2 }
    expect(hitHoop(before, after, hoop, BOUNDS.radius).scored).toBe(true)
  })

  it('counts nothing for a ball going up through it, or passing outside it', () => {
    const rising = { ...BALL, x: middle, y: hoop.rimY + 2, vy: -300 }
    expect(hitHoop({ ...rising, y: hoop.rimY + 6 }, rising, hoop, BOUNDS.radius).scored).toBe(false)
    const outside = { ...BALL, x: hoop.frontX + 60, y: hoop.rimY + 2, vy: 300 }
    expect(hitHoop({ ...outside, y: hoop.rimY - 4 }, outside, hoop, BOUNDS.radius).scored).toBe(
      false
    )
  })

  it('bounces a ball off the front of the rim', () => {
    const falling = { ...BALL, x: hoop.frontX + 5, y: hoop.rimY - BOUNDS.radius, vy: 500 }
    const hit = hitHoop(falling, falling, hoop, BOUNDS.radius)
    expect(hit.rimSpeed).toBeGreaterThan(0)
    expect(hit.ball.vy).toBeLessThan(500)
    expect(hit.ball.vx).toBeGreaterThan(0)
  })

  it('leaves a ball far from the rim alone', () => {
    const away = { ...BALL, x: 600, y: 100, vx: 100, vy: 100 }
    const hit = hitHoop(away, away, hoop, BOUNDS.radius)
    expect(hit.ball).toEqual(away)
    expect(hit.rimSpeed).toBeNull()
  })
})
