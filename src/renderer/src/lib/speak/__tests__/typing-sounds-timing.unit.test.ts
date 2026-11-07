import { describe, expect, it } from 'vitest'
import { BURST_KEYS, nextKeyDelay, playTypingBurst, stopTypingSounds } from '../typing-sounds'

describe('nextKeyDelay', () => {
  it('is quick and a little uneven', () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const delay = nextKeyDelay(() => r)
      expect(delay).toBeGreaterThanOrEqual(45)
      expect(delay).toBeLessThanOrEqual(115)
    }
  })

  it('a burst is short: a handful of keys, well under a second', () => {
    expect(BURST_KEYS).toBeLessThanOrEqual(10)
    expect(BURST_KEYS * 115).toBeLessThan(1000)
  })
})

describe('without an audio engine', () => {
  it('playing and stopping do nothing and do not throw', () => {
    expect(typeof AudioContext).toBe('undefined')
    expect(() => {
      playTypingBurst()
      stopTypingSounds()
    }).not.toThrow()
  })
})
