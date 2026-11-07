import { describe, expect, it, vi } from 'vitest'
import { PET_RUN_GAP_MS, SONGS, nextTuneNote, playHappyNoise } from '../pet-sound'

describe('playHappyNoise', () => {
  it('does nothing, and does not throw, without an audio engine', () => {
    expect(typeof AudioContext).toBe('undefined')
    expect(() => playHappyNoise()).not.toThrow()
  })
})

describe('the songs', () => {
  it('has several, and the first is long enough for a whole petting', () => {
    expect(SONGS.length).toBeGreaterThanOrEqual(5)
    expect(SONGS[0].notes.length).toBeGreaterThanOrEqual(60)
  })

  it('keeps every note in a range that stays soft and singable', () => {
    for (const song of SONGS) {
      for (const note of song.notes) expect(note).toBeGreaterThanOrEqual(-5)
      for (const note of song.notes) expect(note).toBeLessThanOrEqual(14)
    }
  })

  it('plays the first song first, one fixed note per pet, from the very first pet', () => {
    const t = 5_000_000
    expect(nextTuneNote(t)).toBe(SONGS[0].notes[0])
    expect(nextTuneNote(t + 150)).toBe(SONGS[0].notes[1])
    expect(nextTuneNote(t + 300)).toBe(SONGS[0].notes[2])
  })

  it('picks a random other song after a pause', async () => {
    vi.resetModules()
    const fresh = await import('../pet-sound')
    const t = 9_000_000
    fresh.nextTuneNote(t)
    // A roll of 0 skips the song that just stopped and takes the one after it.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(fresh.nextTuneNote(t + PET_RUN_GAP_MS + 1)).toBe(fresh.SONGS[1].notes[0])
    vi.restoreAllMocks()
  })

  it('picks a random other song when one ends, never the same one again', async () => {
    vi.resetModules()
    const fresh = await import('../pet-sound')
    let now = 20_000_000
    for (let i = 0; i < fresh.SONGS[0].notes.length; i += 1) fresh.nextTuneNote((now += 100))
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const next = fresh.nextTuneNote((now += 100))
    vi.restoreAllMocks()
    // The highest roll lands on the last song; it starts with that song's first note.
    expect(next).toBe(fresh.SONGS[fresh.SONGS.length - 1].notes[0])
    vi.spyOn(Math, 'random').mockReturnValue(0)
    for (let i = 1; i < fresh.SONGS[fresh.SONGS.length - 1].notes.length; i += 1) {
      fresh.nextTuneNote((now += 100))
    }
    // The lowest roll skips the song that just ended and takes the one after it: the first.
    expect(fresh.nextTuneNote(now + 100)).toBe(fresh.SONGS[0].notes[0])
    vi.restoreAllMocks()
  })
})
