import { describe, expect, it } from 'vitest'
import { gazeToward, NO_GAZE } from '../face-gaze'

describe('gazeToward', () => {
  it('looks straight at a pointer far to the right', () => {
    expect(gazeToward(100, 100, 900, 100)).toEqual({ x: 1, y: 0 })
  })

  it('looks up and left toward a pointer up and to the left', () => {
    const gaze = gazeToward(500, 500, 400, 400)
    expect(gaze.x).toBeLessThan(0)
    expect(gaze.y).toBeLessThan(0)
  })

  it('stays centred on a pointer right on the face', () => {
    expect(gazeToward(100, 100, 100, 100)).toEqual(NO_GAZE)
  })

  it('turns less for a pointer that is close than for one that is far', () => {
    const near = gazeToward(0, 0, 40, 0)
    const far = gazeToward(0, 0, 400, 0)
    expect(near.x).toBeGreaterThan(0)
    expect(near.x).toBeLessThan(far.x)
  })

  it('never looks past full', () => {
    const gaze = gazeToward(0, 0, 5000, 5000)
    expect(Math.hypot(gaze.x, gaze.y)).toBeLessThanOrEqual(1.05)
  })
})
