import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sfx = vi.hoisted(() => ({
  playSend: vi.fn(),
  playDone: vi.fn(),
  playError: vi.fn()
}))
vi.mock('../sfx', async (original) => ({ ...(await original<object>()), ...sfx }))

import {
  claimFirstOpenOfDay,
  impactStrength,
  isSfxEnabled,
  QUIET_IMPACT_SPEED,
  setSfxEnabled,
  startWaitingCue,
  stopWaitingCue
} from '../sfx'
import { useTurnSounds } from '../use-turn-sounds'

describe('sound effects switch', () => {
  afterEach(() => window.localStorage.clear())

  it('is on until turned off, and remembers the choice', () => {
    expect(isSfxEnabled()).toBe(true)
    setSfxEnabled(false)
    expect(isSfxEnabled()).toBe(false)
    setSfxEnabled(true)
    expect(isSfxEnabled()).toBe(true)
  })
})

describe('impactStrength', () => {
  it('grows with speed and stays between a whisper and full volume', () => {
    expect(impactStrength(QUIET_IMPACT_SPEED)).toBeGreaterThan(0)
    expect(impactStrength(400)).toBeLessThan(impactStrength(1200))
    expect(impactStrength(99_999)).toBe(1)
  })
})

describe('useTurnSounds', () => {
  beforeEach(() => vi.clearAllMocks())

  type Props = { id: string; state: 'idle' | 'running' | 'error'; user: string | null }
  const setup = (initial: Props) =>
    renderHook((p: Props) => useTurnSounds(p.id, p.state, p.user), { initialProps: initial })

  it('says nothing when it first appears', () => {
    setup({ id: 'a', state: 'idle', user: 'u1' })
    expect(sfx.playSend).not.toHaveBeenCalled()
    expect(sfx.playDone).not.toHaveBeenCalled()
  })

  it('swishes when a new message of yours appears', () => {
    const { rerender } = setup({ id: 'a', state: 'idle', user: 'u1' })
    rerender({ id: 'a', state: 'running', user: 'u2' })
    expect(sfx.playSend).toHaveBeenCalledTimes(1)
  })

  it('chimes when a turn finishes and buzzes when it fails', () => {
    const { rerender } = setup({ id: 'a', state: 'running', user: 'u1' })
    rerender({ id: 'a', state: 'idle', user: 'u1' })
    expect(sfx.playDone).toHaveBeenCalledTimes(1)
    rerender({ id: 'a', state: 'error', user: 'u1' })
    expect(sfx.playError).toHaveBeenCalledTimes(1)
  })

  it('plays nothing when you switch to another chat', () => {
    const { rerender } = setup({ id: 'a', state: 'running', user: 'u1' })
    rerender({ id: 'b', state: 'idle', user: 'u9' })
    expect(sfx.playDone).not.toHaveBeenCalled()
    expect(sfx.playSend).not.toHaveBeenCalled()
  })
})

describe('waiting cue', () => {
  afterEach(() => {
    stopWaitingCue()
    vi.useRealTimers()
  })

  it('schedules nothing when there is no audio engine to play it', () => {
    vi.useFakeTimers()
    startWaitingCue()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('can always be stopped, even when it never started', () => {
    expect(() => stopWaitingCue()).not.toThrow()
  })
})

describe('claimFirstOpenOfDay', () => {
  afterEach(() => window.localStorage.clear())

  it('is true once per calendar day and true again the next day', () => {
    expect(claimFirstOpenOfDay(new Date(2026, 10, 1, 8))).toBe(true)
    expect(claimFirstOpenOfDay(new Date(2026, 10, 1, 20))).toBe(false)
    expect(claimFirstOpenOfDay(new Date(2026, 10, 2, 8))).toBe(true)
  })

  it('does not use up the day while sound effects are off', () => {
    setSfxEnabled(false)
    expect(claimFirstOpenOfDay(new Date(2026, 10, 1))).toBe(false)
    setSfxEnabled(true)
    expect(claimFirstOpenOfDay(new Date(2026, 10, 1))).toBe(true)
  })
})
