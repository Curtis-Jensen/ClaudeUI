import { describe, expect, it } from 'vitest'
import { MOODS } from '../../../../../shared/mood'
import { SONGS, songLength, songTimeline } from '../mood-songs'

describe('mood songs', () => {
  it('has a very small song for every mood', () => {
    for (const mood of MOODS) {
      const song = SONGS[mood]
      expect(song, mood).toBeDefined()
      expect(songTimeline(song).length, mood).toBeGreaterThanOrEqual(2)
      expect(songLength(song), mood).toBeLessThan(8)
    }
  })

  it('keeps every note audible', () => {
    for (const mood of MOODS) {
      for (const note of songTimeline(SONGS[mood])) {
        expect(note.hz, mood).toBeGreaterThan(80)
        expect(note.hz, mood).toBeLessThan(2000)
      }
    }
  })

  it('lays the notes out in order, each inside the song', () => {
    for (const mood of MOODS) {
      const song = SONGS[mood]
      let last = -1
      for (const note of songTimeline(song)) {
        expect(note.at, mood).toBeGreaterThan(last)
        expect(note.at + note.length, mood).toBeLessThanOrEqual(songLength(song) + 1e-9)
        last = note.at
      }
    }
  })

  it('goes up for a happy song and down for a sad one', () => {
    const rise = (mood: 'happy' | 'sad'): number => {
      const notes = songTimeline(SONGS[mood])
      return notes[notes.length - 1].hz - notes[0].hz
    }
    expect(rise('happy')).toBeGreaterThan(0)
    expect(rise('sad')).toBeLessThan(0)
  })

  it('turns semitones into hertz: an octave doubles the pitch', () => {
    const notes = songTimeline({
      root: 200,
      bpm: 60,
      wave: 'sine',
      notes: [
        [0, 1],
        [12, 1]
      ]
    })
    expect(notes[1].hz).toBeCloseTo(400)
    expect(notes[1].at).toBeCloseTo(1)
  })

  it('leaves a gap for a rest', () => {
    const song = {
      root: 200,
      bpm: 60,
      wave: 'sine' as const,
      notes: [
        [0, 1],
        [null, 1],
        [0, 1]
      ] as const
    }
    const notes = songTimeline(song)
    expect(notes).toHaveLength(2)
    expect(notes[1].at).toBeCloseTo(2)
  })
})
