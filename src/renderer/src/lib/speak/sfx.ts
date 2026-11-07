/**
 * Sound effects for the app, made in the browser's own audio engine: the thrown face's bounce,
 * and small cues for sending, finishing, failing and switching things on or off. The one
 * exception is the startup jingle, a recorded file. One switch (kept in the browser) turns them
 * all off.
 */
import type { Mood } from '../../../../shared/mood'
import { SONGS, songLength, songTimeline } from './mood-songs'
import startupJingleUrl from '../../assets/sounds/startup-jingle.mp3'

const STORAGE_KEY = 'claudeui.soundEffects'

/** Sound effects are on unless the person turned them off. */
export function isSfxEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

export function setSfxEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    // Private mode: the choice just will not be remembered.
  }
}

let context: AudioContext | null = null
let noise: AudioBuffer | null = null

/** The audio engine, or null when sounds are off or the window has none (a test, an old browser). */
function engine(): AudioContext | null {
  if (typeof AudioContext === 'undefined' || !isSfxEnabled()) return null
  context ??= new AudioContext()
  void context.resume()
  return context
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise
  const length = Math.floor(c.sampleRate * 0.4)
  noise = c.createBuffer(1, length, c.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return noise
}

type Tone = {
  type: OscillatorType
  from: number
  to: number
  /** Seconds after now. */
  at?: number
  length: number
  peak: number
}

/** One pitched note that slides from `from` to `to` hertz and fades away. */
function tone(c: AudioContext, t: Tone): void {
  const begin = c.currentTime + (t.at ?? 0)
  const end = begin + t.length
  const voice = c.createOscillator()
  voice.type = t.type
  voice.frequency.setValueAtTime(t.from, begin)
  voice.frequency.exponentialRampToValueAtTime(t.to, end)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, begin)
  gain.gain.linearRampToValueAtTime(t.peak, begin + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  voice.connect(gain).connect(c.destination)
  voice.start(begin)
  voice.stop(end + 0.03)
}

type Hiss = {
  filter: BiquadFilterType
  from: number
  to: number
  q?: number
  at?: number
  length: number
  peak: number
}

/** A burst of filtered noise whose filter slides from `from` to `to` hertz: a slap or a whoosh. */
function hiss(c: AudioContext, h: Hiss): void {
  const begin = c.currentTime + (h.at ?? 0)
  const end = begin + h.length
  const source = c.createBufferSource()
  source.buffer = noiseBuffer(c)
  const filter = c.createBiquadFilter()
  filter.type = h.filter
  filter.Q.value = h.q ?? 1
  filter.frequency.setValueAtTime(h.from, begin)
  filter.frequency.exponentialRampToValueAtTime(h.to, end)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, begin)
  gain.gain.linearRampToValueAtTime(h.peak, begin + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  source.connect(filter).connect(gain).connect(c.destination)
  source.start(begin)
  source.stop(end + 0.03)
}

/** How hard an impact sounds, 0 to 1, from its speed in pixels per second. */
export function impactStrength(speed: number): number {
  return Math.max(0.12, Math.min(1, speed / 1600))
}

/** Hits slower than this make no sound: a ball settling should not chatter. */
export const QUIET_IMPACT_SPEED = 90

function pitchJitter(): number {
  return 0.94 + Math.random() * 0.12
}

/** Every bounce, off the floor, a wall or a corner, sounds the same: a rubber thud, harder hits louder. */
export function playBounce(speed: number): void {
  const c = engine()
  if (!c || speed < QUIET_IMPACT_SPEED) return
  const s = impactStrength(speed)
  const j = pitchJitter()
  tone(c, { type: 'sine', from: 150 * j, to: 52, length: 0.16, peak: 0.42 * s })
  hiss(c, { filter: 'lowpass', from: 900, to: 200, length: 0.06, peak: 0.2 * s })
}

/** A hand punches the ball: a sharp slap over a short low thump. */
export function playPunch(strength: number): void {
  const c = engine()
  if (!c) return
  const s = Math.max(0.3, Math.min(1, strength))
  const j = pitchJitter()
  hiss(c, { filter: 'bandpass', from: 1800, to: 700, q: 1.3, length: 0.05, peak: 0.28 * s })
  tone(c, { type: 'sine', from: 190 * j, to: 70, length: 0.1, peak: 0.34 * s })
}

/** The face flies off: a rushing whoosh, longer and brighter for a harder throw. */
export function playThrowWhoosh(speed: number): void {
  const c = engine()
  if (!c) return
  const s = impactStrength(speed)
  hiss(c, {
    filter: 'bandpass',
    from: 400,
    to: 400 + 2200 * s,
    q: 0.9,
    length: 0.18 + 0.2 * s,
    peak: 0.22 * s
  })
}

/** The ball hits the hoop's rim: a short metal clang, louder for a harder hit. */
export function playRimClank(speed: number): void {
  const c = engine()
  if (!c || speed < QUIET_IMPACT_SPEED) return
  const s = impactStrength(speed)
  const j = pitchJitter()
  tone(c, { type: 'triangle', from: 880 * j, to: 820 * j, length: 0.22, peak: 0.16 * s })
  tone(c, { type: 'square', from: 1310 * j, to: 1240 * j, length: 0.12, peak: 0.04 * s })
  hiss(c, { filter: 'highpass', from: 3000, to: 2000, length: 0.04, peak: 0.12 * s })
}

/** The ball drops through the hoop: the net's soft swish, then a little rising cheer. */
export function playSwish(): void {
  const c = engine()
  if (!c) return
  hiss(c, { filter: 'bandpass', from: 2400, to: 900, q: 0.7, length: 0.32, peak: 0.24 })
  tone(c, { type: 'sine', from: 660, to: 990, at: 0.18, length: 0.12, peak: 0.12 })
  tone(c, { type: 'sine', from: 880, to: 1320, at: 0.28, length: 0.16, peak: 0.12 })
}

/** Picking the face up: a small rising pop. */
export function playGrabPop(): void {
  const c = engine()
  if (!c) return
  tone(c, { type: 'sine', from: 420, to: 760, length: 0.07, peak: 0.16 })
}

/** The ball comes to rest: a last soft double knock. */
export function playSettle(): void {
  const c = engine()
  if (!c) return
  tone(c, { type: 'sine', from: 110, to: 60, length: 0.1, peak: 0.12 })
  tone(c, { type: 'sine', from: 100, to: 56, at: 0.09, length: 0.1, peak: 0.07 })
}

/** A message goes out: a quick upward swish and blip. */
export function playSend(): void {
  const c = engine()
  if (!c) return
  hiss(c, { filter: 'bandpass', from: 700, to: 3200, q: 1.1, length: 0.14, peak: 0.1 })
  tone(c, { type: 'sine', from: 520, to: 980, length: 0.1, peak: 0.1 })
}

/** A turn is finished: two rising soft notes. */
export function playDone(): void {
  const c = engine()
  if (!c) return
  tone(c, { type: 'triangle', from: 660, to: 668, length: 0.16, peak: 0.12 })
  tone(c, { type: 'triangle', from: 880, to: 890, at: 0.12, length: 0.3, peak: 0.12 })
}

/** Something went wrong: a short low buzz that sags. */
export function playError(): void {
  const c = engine()
  if (!c) return
  tone(c, { type: 'sawtooth', from: 190, to: 120, length: 0.28, peak: 0.07 })
  tone(c, { type: 'sawtooth', from: 143, to: 90, at: 0.02, length: 0.26, peak: 0.05 })
}

/** A switch flipped: a high blip going on, a low one going off. */
export function playToggle(on: boolean): void {
  const c = engine()
  if (!c) return
  if (on) tone(c, { type: 'sine', from: 600, to: 900, length: 0.09, peak: 0.13 })
  else tone(c, { type: 'sine', from: 520, to: 340, length: 0.09, peak: 0.13 })
}

/** A little menu opens: one soft pop. */
export function playMenuOpen(): void {
  const c = engine()
  if (!c) return
  tone(c, { type: 'sine', from: 480, to: 640, length: 0.06, peak: 0.1 })
}

const JINGLE_DAY_KEY = 'claudeui.jingleDay'

function localDay(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * True the first time it is asked on each calendar day, and records that the day has had its
 * jingle. False when sound effects are off (so the day is not used up on silence) or when the
 * browser cannot remember the day, so a broken store never makes the jingle play on every open.
 */
export function claimFirstOpenOfDay(now: Date = new Date()): boolean {
  if (!isSfxEnabled()) return false
  try {
    const today = localDay(now)
    if (window.localStorage.getItem(JINGLE_DAY_KEY) === today) return false
    window.localStorage.setItem(JINGLE_DAY_KEY, today)
    return true
  } catch {
    return false
  }
}

let jingle: HTMLAudioElement | null = null

/**
 * The first-open-of-the-day jingle: a short recorded piece (made with ACE-Step, trimmed and
 * faded), played from the start again if it is already playing. Silent when sound effects are off.
 */
export function playStartupJingle(): void {
  if (typeof Audio === 'undefined' || !isSfxEnabled()) return
  jingle ??= new Audio(startupJingleUrl)
  jingle.currentTime = 0
  void jingle.play().catch(() => {
    // No sound device, or the page has not been allowed to play sound yet: skip it quietly.
  })
}

let waitTimer: ReturnType<typeof setTimeout> | null = null
let waitGiveUp: ReturnType<typeof setTimeout> | null = null
/** The quiet between one playing of the waiting song and the next, in seconds. */
export const WAITING_SONG_PAUSE_S = 0.6
/** The waiting song never plays longer than this, whatever happens to the voice. */
export const WAITING_CUE_MAX_MS = 20_000
const SONG_PEAK = 0.08

/**
 * A very small song for the reply's mood, played over and over while the voice is getting ready
 * to read it, so the wait between the words arriving and the first sound is not silent. Silent
 * when sound effects are off. With no mood it is the calm one.
 */
export function startWaitingCue(mood: Mood | null = null): void {
  stopWaitingCue()
  if (!engine()) return
  const song = SONGS[mood ?? 'calm']
  const sing = (): void => {
    const c = engine()
    if (!c) return stopWaitingCue()
    for (const note of songTimeline(song)) {
      tone(c, {
        type: song.wave,
        from: note.hz,
        to: note.hz * 1.005,
        at: note.at,
        length: note.length,
        peak: SONG_PEAK * (song.volume ?? 1)
      })
    }
    waitTimer = setTimeout(sing, (songLength(song) + WAITING_SONG_PAUSE_S) * 1000)
  }
  sing()
  waitGiveUp = setTimeout(stopWaitingCue, WAITING_CUE_MAX_MS)
}

/** Ends the waiting song: the voice has started, or there is nothing left to wait for. */
export function stopWaitingCue(): void {
  if (waitTimer) clearTimeout(waitTimer)
  if (waitGiveUp) clearTimeout(waitGiveUp)
  waitTimer = null
  waitGiveUp = null
}
