/**
 * The noise when the face is petted: a quick rising three-note "mm-hm!". Its pitch is not random; the top note is the next note of a song,
 * so a slow stroking is a few gentle phrases and a flurry of pets plays the song. Stop for a moment
 * and the next pet starts the next song from its beginning.
 */
let context: AudioContext | null = null

/** A pause this long between pets ends the run, and a new song begins. */
export const PET_RUN_GAP_MS = 1_500
const TUNE_ROOT_HZ = 587.33

/**
 * The songs, as semitones above the root, one note per pet. The first petting plays the first
 * song, and whenever a song ends, by a pause or by reaching its last note, the next one is a
 * random pick from the rest. All of them are old folk and nursery tunes.
 */
const ODE_A = [4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 4, 2, 2]
const ODE_A_END = [4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 2, 0, 0]
const ODE_B = [2, 2, 4, 0, 2, 4, 5, 4, 0, 2, 4, 5, 4, 2, 0, 2, -5]
const JINGLE_START = [4, 4, 4, 4, 4, 4, 4, 7, 0, 2, 4, 5, 5, 5, 5, 5, 4, 4, 4, 4]

export const SONGS: readonly { name: string; notes: readonly number[] }[] = [
  { name: 'Ode to Joy', notes: [...ODE_A, ...ODE_A_END, ...ODE_B, ...ODE_A_END] },
  {
    name: 'Twinkle, Twinkle, Little Star',
    notes: [
      0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0, 7, 7, 5, 5, 4, 4, 2, 7, 7, 5, 5, 4, 4, 2, 0, 0, 7,
      7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0
    ]
  },
  {
    name: 'Mary Had a Little Lamb',
    notes: [4, 2, 0, 2, 4, 4, 4, 2, 2, 2, 4, 7, 7, 4, 2, 0, 2, 4, 4, 4, 4, 2, 2, 4, 2, 0]
  },
  {
    name: 'Jingle Bells',
    notes: [...JINGLE_START, 2, 2, 4, 2, 7, ...JINGLE_START, 7, 7, 5, 2, 0]
  },
  {
    name: 'Frère Jacques',
    notes: [
      0, 2, 4, 0, 0, 2, 4, 0, 4, 5, 7, 4, 5, 7, 7, 9, 7, 5, 4, 0, 7, 9, 7, 5, 4, 0, 0, -5, 0, 0, -5,
      0
    ]
  },
  {
    name: 'Row, Row, Row Your Boat',
    notes: [0, 0, 0, 2, 4, 4, 2, 4, 5, 7, 12, 12, 12, 7, 7, 7, 4, 4, 4, 0, 0, 0, 7, 5, 4, 2, 0]
  },
  {
    name: 'London Bridge',
    notes: [7, 9, 7, 5, 4, 5, 7, 2, 4, 5, 4, 5, 7, 7, 9, 7, 5, 4, 5, 7, 2, 7, 4, 0]
  }
]

let songIndex = 0
let place = -1
let lastPetAt = -Infinity

/** A random song other than the one that just ended, so the same one never plays twice running. */
function pickAnotherSong(): number {
  return (songIndex + 1 + Math.floor(Math.random() * (SONGS.length - 1))) % SONGS.length
}

/** Counts this pet into the current run and returns the song note it plays, in semitones. */
export function nextTuneNote(now: number): number {
  if (now - lastPetAt > PET_RUN_GAP_MS) {
    // A new run: the very first one plays the first song, each later one a random other song.
    if (lastPetAt !== -Infinity) songIndex = pickAnotherSong()
    place = 0
  } else {
    place += 1
    if (place >= SONGS[songIndex].notes.length) {
      place = 0
      songIndex = pickAnotherSong()
    }
  }
  lastPetAt = now
  return SONGS[songIndex].notes[place]
}

/**
 * One pet is a rising three-note "mm-hm!". The last, longest note is the pet's note of the tune;
 * the two before it are soft steps up into it, fixed distances below, so the pitches are never
 * random and a run of pets still follows the song on its top notes.
 */
const FIGURE = [
  { below: 9, at: 0, length: 0.1, level: 0.09 },
  { below: 5, at: 0.09, length: 0.1, level: 0.11 },
  { below: 0, at: 0.18, length: 0.24, level: 0.16 }
] as const

export function playHappyNoise(): void {
  // No audio engine (a test window, an old browser): stay silent.
  if (typeof AudioContext === 'undefined') return
  const semitones = nextTuneNote(Date.now())
  const c = (context ??= new AudioContext())
  void c.resume()
  const start = c.currentTime
  for (const note of FIGURE) {
    const hz = TUNE_ROOT_HZ * 2 ** ((semitones - note.below) / 12)
    playSoftNote(c, hz, start + note.at, note.length, note.level)
  }
}

/** One warm, round note: a sine with a quiet octave above it, edges softened by a low-pass. */
function playSoftNote(
  c: AudioContext,
  hz: number,
  begin: number,
  length: number,
  level: number
): void {
  const end = begin + length
  const tone = c.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 2_200
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, begin)
  gain.gain.linearRampToValueAtTime(level, begin + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  tone.connect(gain).connect(c.destination)

  for (const [ratio, share] of [
    [1, 1],
    [2, 0.25]
  ] as const) {
    const voice = c.createOscillator()
    voice.type = 'sine'
    // A small lift into the pitch, like a pleased little squeak.
    voice.frequency.setValueAtTime(hz * ratio * 0.97, begin)
    voice.frequency.exponentialRampToValueAtTime(hz * ratio, begin + 0.04)
    const mix = c.createGain()
    mix.gain.value = share
    voice.connect(mix).connect(tone)
    voice.start(begin)
    voice.stop(end + 0.02)
  }
}
