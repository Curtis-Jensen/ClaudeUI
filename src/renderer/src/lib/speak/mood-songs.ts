import type { Mood } from '../../../../shared/mood'

/** A note: how many semitones above the song's root, and how many beats long. Null is a rest. */
export type SongNote = readonly [semitones: number | null, beats: number]

export type Song = {
  /** The root note in hertz. */
  root: number
  bpm: number
  wave: OscillatorType
  notes: readonly SongNote[]
  /** Louder or softer than the usual, 1 by default. */
  volume?: number
}

/**
 * A very small song for each mood, played over and over while the voice gets ready to read a
 * reply of that mood: bright and bouncy when happy, a slow fall when sad, a rising question when
 * curious.
 */
export const SONGS: Record<Mood, Song> = {
  happy: {
    root: 392,
    bpm: 150,
    wave: 'triangle',
    notes: [
      [0, 0.5],
      [4, 0.5],
      [7, 0.5],
      [4, 0.5],
      [12, 1.5]
    ]
  },
  excited: {
    root: 440,
    bpm: 210,
    wave: 'triangle',
    notes: [
      [0, 0.5],
      [4, 0.5],
      [7, 0.5],
      [12, 0.5],
      [7, 0.5],
      [12, 0.5],
      [16, 1.5]
    ]
  },
  proud: {
    root: 262,
    bpm: 90,
    wave: 'triangle',
    notes: [
      [0, 1],
      [7, 1],
      [12, 2]
    ]
  },
  calm: {
    root: 330,
    bpm: 70,
    wave: 'sine',
    notes: [
      [0, 1.5],
      [4, 1],
      [7, 1],
      [4, 2]
    ]
  },
  curious: {
    root: 349,
    bpm: 120,
    wave: 'sine',
    notes: [
      [0, 0.5],
      [2, 0.5],
      [4, 0.5],
      [7, 0.5],
      [9, 1.5]
    ]
  },
  thinking: {
    root: 220,
    bpm: 80,
    wave: 'sine',
    notes: [
      [0, 1],
      [3, 0.5],
      [2, 0.5],
      [null, 0.5],
      [-2, 1.5]
    ]
  },
  focused: {
    root: 294,
    bpm: 130,
    wave: 'sine',
    notes: [
      [0, 0.5],
      [0, 0.5],
      [5, 0.5],
      [0, 0.5],
      [0, 1]
    ]
  },
  surprised: {
    root: 392,
    bpm: 180,
    wave: 'triangle',
    notes: [
      [0, 0.25],
      [12, 0.75],
      [null, 0.25],
      [7, 1]
    ]
  },
  worried: {
    root: 262,
    bpm: 140,
    wave: 'sine',
    notes: [
      [0, 0.5],
      [3, 0.5],
      [0, 0.5],
      [-1, 0.5],
      [3, 0.5],
      [-1, 1.5]
    ]
  },
  sad: {
    root: 330,
    bpm: 80,
    wave: 'sine',
    notes: [
      [0, 1.5],
      [-2, 1.5],
      [-4, 1.5],
      [-7, 3]
    ]
  },
  tired: {
    root: 220,
    bpm: 55,
    wave: 'sine',
    volume: 0.8,
    notes: [
      [0, 2],
      [-5, 3]
    ]
  },
  annoyed: {
    root: 165,
    bpm: 160,
    wave: 'sawtooth',
    volume: 0.5,
    notes: [
      [0, 0.5],
      [0, 0.5],
      [-1, 0.5],
      [null, 0.5],
      [0, 1]
    ]
  }
}

export type TimedNote = {
  hz: number
  /** Seconds from the song's start. */ at: number
  length: number
}

/** The song's notes laid out in time, rests left as gaps. A note rings for most of its beats. */
export function songTimeline(song: Song): TimedNote[] {
  const beat = 60 / song.bpm
  const timeline: TimedNote[] = []
  let at = 0
  for (const [semitones, beats] of song.notes) {
    if (semitones !== null) {
      timeline.push({ hz: song.root * 2 ** (semitones / 12), at, length: beats * beat * 0.9 })
    }
    at += beats * beat
  }
  return timeline
}

/** How long the whole song lasts, in seconds. */
export function songLength(song: Song): number {
  return (song.notes.reduce((sum, [, beats]) => sum + beats, 0) * 60) / song.bpm
}
