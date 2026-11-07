import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HUE,
  THREAD_SURFACE_VARS,
  threadAccent,
  threadHue,
  threadSurfaces
} from '../thread-theme'

describe('threadHue', () => {
  it('gives a thread the same color every time', () => {
    expect(threadHue('local_74197d60-605e')).toBe(threadHue('local_74197d60-605e'))
  })

  it('is orange when there is no thread yet', () => {
    expect(threadHue(null)).toBe(DEFAULT_HUE)
    expect(threadHue(undefined)).toBe(DEFAULT_HUE)
    expect(threadHue('')).toBe(DEFAULT_HUE)
  })

  it('spreads threads over several colors, not just one', () => {
    const hues = new Set(
      Array.from({ length: 60 }, (_, i) => threadHue(`local_session-${i}-abc${i * 7}`))
    )
    expect(hues.size).toBeGreaterThanOrEqual(6)
  })
})

describe('thread colors', () => {
  it('tints every background and border layer, dark, from the same hue', () => {
    const surfaces = threadSurfaces(27)
    expect(Object.keys(surfaces)).toEqual(THREAD_SURFACE_VARS)
    for (const value of Object.values(surfaces)) expect(value).toMatch(/^hsl\(27 \d+% \d+%\)$/)
  })

  it('keeps the background deep and each layer lighter than the one below', () => {
    const lightness = (value: string): number => Number(/(\d+)%\)$/.exec(value)?.[1])
    const s = threadSurfaces(200)
    expect(lightness(s['--color-bg-primary'])).toBeLessThanOrEqual(10)
    expect(lightness(s['--color-bg-primary'])).toBeLessThan(lightness(s['--color-bg-secondary']))
    expect(lightness(s['--color-bg-secondary'])).toBeLessThan(lightness(s['--color-bg-tertiary']))
    expect(lightness(s['--color-bg-tertiary'])).toBeLessThan(lightness(s['--color-bg-hover']))
  })

  it('the accent is a bright version of the hue', () => {
    expect(threadAccent(27)).toBe('hsl(27 95% 60%)')
  })
})

describe('black', () => {
  it('is pickable but never assigned at random', async () => {
    const { BLACK_HUE, THREAD_COLORS, THREAD_HUES } = await import('../thread-theme')
    expect(THREAD_COLORS).toContain(BLACK_HUE)
    expect(THREAD_HUES as readonly number[]).not.toContain(BLACK_HUE)
  })

  it('draws neutral grays with no hue in them', async () => {
    const { BLACK_HUE, threadAccent, threadSurfaces } = await import('../thread-theme')
    expect(threadAccent(BLACK_HUE)).toMatch(/^hsl\(0 0%/)
    for (const value of Object.values(threadSurfaces(BLACK_HUE))) expect(value).toMatch(/^hsl\(0 0%/)
  })
})

describe('tinted blacks', () => {
  it('offers a black for every hue, beside plain black', async () => {
    const { BLACK_HUE, THREAD_COLORS, THREAD_HUES, tintedBlack, isBlack, baseHue } = await import(
      '../thread-theme'
    )
    expect(THREAD_COLORS).toHaveLength(THREAD_HUES.length * 2 + 1)
    for (const hue of THREAD_HUES) {
      expect(THREAD_COLORS).toContain(tintedBlack(hue))
      expect(isBlack(tintedBlack(hue))).toBe(true)
      expect(baseHue(tintedBlack(hue))).toBe(hue)
      expect(isBlack(hue)).toBe(false)
    }
    expect(isBlack(BLACK_HUE)).toBe(true)
  })

  it('draws true black surfaces with the hue on the borders', async () => {
    const { tintedBlack, threadSurfaces } = await import('../thread-theme')
    const s = threadSurfaces(tintedBlack(200))
    expect(s['--color-bg-primary']).toBe('hsl(0 0% 0%)')
    expect(Object.keys(s)).toEqual(Object.keys(threadSurfaces(27)))
  })
})
