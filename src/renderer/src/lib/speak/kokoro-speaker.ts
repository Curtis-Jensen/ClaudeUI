import { extractMood, stripMoodTag } from '../../../../shared/mood'
import { startWaitingCue, stopWaitingCue } from './sfx'

/**
 * Reads replies aloud through a local Kokoro server (`~/Tools/voice/start-kokoro.sh`).
 * Nothing leaves the machine: the server listens on 127.0.0.1 only, and the
 * renderer's CSP allows exactly that origin.
 */
const SPEECH_URL = 'http://127.0.0.1:8880/v1/audio/speech'
// A British voice needs the British language setting too, or Kokoro reads it with American rules.
const VOICE = 'bm_daniel'
const LANGUAGE = 'en-gb'
const SAMPLE_RATE = 24_000
const CHUNK_CHARS = 240
/** What an automatic read-aloud says at most: a long reply is mostly on screen anyway. */
const AUTO_MAX_SPOKEN_CHARS = 4_000
/** What the play button on a message says at most. */
const MANUAL_MAX_SPOKEN_CHARS = 6_000
const STORAGE_KEY = 'claudeui.speakReplies'

export type SpeakOptions = {
  /** Which message this is, so its play button can show that it is being read. */
  key?: string
  maxChars?: number
}

/** Plain sentences for the voice: no code, links, tables or markdown marks. */
export function prepareSpeech(markdown: string, maxChars = AUTO_MAX_SPOKEN_CHARS): string {
  const text = stripMoodTag(markdown)
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'a link')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text
}

/** Splits into pieces of whole sentences so the first words play while the rest is made. */
export function chunkSpeech(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text]
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > CHUNK_CHARS) {
      chunks.push(current.trim())
      current = ''
    }
    current += sentence
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

/** Reading aloud is on unless the person turned it off. */
export function isSpeakingEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

export function setSpeakingEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    // Private mode: the choice just will not be remembered.
  }
  if (!on) stopSpeaking()
}

export type SpeakScope = 'final' | 'all'
const SCOPE_KEY = 'claudeui.speakScope'

/** What is read aloud on its own: just the closing summary of a turn (the default), or every reply. */
export function getSpeakScope(): SpeakScope {
  try {
    return window.localStorage.getItem(SCOPE_KEY) === 'all' ? 'all' : 'final'
  } catch {
    return 'final'
  }
}

export function setSpeakScope(scope: SpeakScope): void {
  try {
    window.localStorage.setItem(SCOPE_KEY, scope)
  } catch {
    // Private mode: the choice just will not be remembered.
  }
}

let audio: AudioContext | null = null
let generation = 0
let controller: AbortController | null = null
// Everything waiting to be said runs one after another through this chain.
let queueTail: Promise<unknown> = Promise.resolve()

/**
 * The message being said, kept whole so it can be paused, jumped around in and backed up.
 * The pieces are made ahead of the playhead, which is `index` (the piece it is in) plus
 * `offset` (seconds into that piece).
 */
type Track = {
  chunks: string[]
  buffers: AudioBuffer[]
  failure: unknown
  index: number
  offset: number
  /** Audio-clock time the current piece started sounding; null while nothing sounds. */
  startedAt: number | null
  paused: boolean
  /** Bumped by every jump, so a piece that ended just as the person jumped is not counted. */
  epoch: number
  source: AudioBufferSourceNode | null
  /** Silences the sound now and ends `playSlice` with false. */
  halt: (() => void) | null
  /** Wakes the loop in `sayNow` when it is waiting on a piece, a resume or a jump. */
  nudge: (() => void) | null
}

let track: Track | null = null

// Which message is being said right now, for the play buttons under messages.
let speakingKey: string | null = null
const speakingListeners = new Set<() => void>()

function notifySpeaking(): void {
  for (const listener of speakingListeners) listener()
}

function setSpeakingKey(key: string | null): void {
  if (speakingKey === key) return
  speakingKey = key
  notifySpeaking()
}

export function subscribeSpeaking(listener: () => void): () => void {
  speakingListeners.add(listener)
  return () => {
    speakingListeners.delete(listener)
  }
}

export function getSpeakingKey(): string | null {
  return speakingKey
}

/** Is a voice sound coming out right now? */
export function isSpeechPlaying(): boolean {
  return track?.source != null
}

/** Is there a message being said (or held on pause) at all, whether or not it has a play button? */
export function isSpeechActive(): boolean {
  return track !== null
}

/** Is the message being said held on pause? */
export function isSpeechPaused(): boolean {
  return track?.paused ?? false
}

// Until a piece is made its length is a guess from the pieces that are: about this many seconds a letter.
const FALLBACK_SECONDS_PER_CHAR = 0.07

function chunkSeconds(t: Track): number[] {
  let seconds = 0
  let chars = 0
  t.buffers.forEach((buffer, i) => {
    seconds += buffer.duration
    chars += t.chunks[i].length
  })
  const perChar = chars > 0 ? seconds / chars : FALLBACK_SECONDS_PER_CHAR
  return t.chunks.map((text, i) => t.buffers[i]?.duration ?? text.length * perChar)
}

function elapsedInChunk(t: Track): number {
  if (t.startedAt === null || !audio) return t.offset
  const length = t.buffers[t.index]?.duration ?? Infinity
  return Math.min(t.offset + (audio.currentTime - t.startedAt), length)
}

export type SpeechProgress = {
  /** Seconds into the message the playhead is. */
  position: number
  /** How long the whole message is: a guess until every piece is made. */
  duration: number
  /** Seconds of the message made so far, so a bar can show how far ahead the voice is ready. */
  loaded: number
}

/** Where the playhead is in the message being said, and how much of it is ready to play. */
export function getSpeechProgress(): SpeechProgress | null {
  if (!track) return null
  const lengths = chunkSeconds(track)
  const before = lengths.slice(0, track.index).reduce((sum, length) => sum + length, 0)
  const duration = lengths.reduce((sum, length) => sum + length, 0)
  const loaded = track.buffers.reduce((sum, buffer) => sum + buffer.duration, 0)
  // What has been heard trails the audio clock by however long the sound takes to reach the speakers.
  const heard = Math.max(elapsedInChunk(track) - (track.paused ? 0 : outputDelay()), 0)
  return { position: before + heard, duration, loaded }
}

function outputDelay(): number {
  return audio ? (audio.outputLatency || 0) + (audio.baseLatency || 0) : 0
}

const SILENCE_LEVEL = 0.02
const speechEdges = new WeakMap<AudioBuffer, { lead: number; trail: number }>()

/** Seconds of near-silence at the start and end of a piece: the voice does not start at its edge. */
function silenceAround(buffer: AudioBuffer): { lead: number; trail: number } {
  const known = speechEdges.get(buffer)
  if (known) return known
  const samples = buffer.getChannelData(0)
  let first = 0
  while (first < samples.length && Math.abs(samples[first]) < SILENCE_LEVEL) first++
  let last = samples.length - 1
  while (last > first && Math.abs(samples[last]) < SILENCE_LEVEL) last--
  const edges =
    first >= samples.length
      ? { lead: 0, trail: 0 }
      : { lead: first / buffer.sampleRate, trail: (samples.length - 1 - last) / buffer.sampleRate }
  speechEdges.set(buffer, edges)
  return edges
}

// A stop in the middle of a piece takes time without taking letters: so a letter counts for more.
function letterWeight(char: string): number {
  if ('.!?'.includes(char)) return 8
  if (',;:'.includes(char)) return 3
  return 1
}

function weightBefore(text: string, char: number): number {
  let weight = 0
  for (let i = 0; i < Math.min(char, text.length); i++) weight += letterWeight(text[i])
  return weight
}

function charAtWeight(text: string, target: number): number {
  let weight = 0
  for (let i = 0; i < text.length; i++) {
    weight += letterWeight(text[i])
    if (weight > target) return i
  }
  return text.length
}

export type SpeechTimeline = {
  /** What the voice is saying, whole: the text that `charAt` and `secondsAt` count letters in. */
  text: string
  /** Seconds into the message at which letter `char` of `text` is said (a guess inside a piece). */
  secondsAt: (char: number) => number
  /** The letter of `text` being said `seconds` into the message. */
  charAt: (seconds: number) => number
}

/** Lines the spoken text up with the clock, so a spot on screen can be found in the voice and back. */
export function getSpeechTimeline(): SpeechTimeline | null {
  const t = track
  if (!t) return null
  const lengths = chunkSeconds(t)
  const starts: number[] = []
  let text = ''
  for (const chunk of t.chunks) {
    if (text) text += ' '
    starts.push(text.length)
    text += chunk
  }
  const pieceAt = (char: number): number => {
    let i = starts.length - 1
    while (i > 0 && starts[i] > char) i--
    return i
  }
  // Where the voice is actually sounding inside a piece: after its lead-in silence, before its tail.
  const voiced = (i: number): { lead: number; length: number } => {
    const buffer = t.buffers[i]
    if (!buffer) return { lead: 0, length: lengths[i] }
    const { lead, trail } = silenceAround(buffer)
    return { lead, length: Math.max(lengths[i] - lead - trail, lengths[i] * 0.1) }
  }
  return {
    text,
    secondsAt: (char) => {
      const at = Math.min(Math.max(char, 0), text.length)
      const i = pieceAt(at)
      const piece = t.chunks[i]
      const total = weightBefore(piece, piece.length)
      const within = total > 0 ? weightBefore(piece, at - starts[i]) / total : 0
      const before = lengths.slice(0, i).reduce((sum, length) => sum + length, 0)
      const { lead, length } = voiced(i)
      return before + lead + Math.min(within, 1) * length
    },
    charAt: (seconds) => {
      let rest = Math.max(seconds, 0)
      let i = 0
      while (i < lengths.length - 1 && rest >= lengths[i]) {
        rest -= lengths[i]
        i++
      }
      const piece = t.chunks[i]
      const { lead, length } = voiced(i)
      const within = Math.min(Math.max((rest - lead) / length, 0), 1)
      return starts[i] + charAtWeight(piece, within * weightBefore(piece, piece.length))
    }
  }
}

function wake(t: Track): void {
  const nudge = t.nudge
  t.nudge = null
  nudge?.()
}

function waitForChange(t: Track): Promise<void> {
  return new Promise((resolve) => {
    t.nudge = resolve
  })
}

/** Holds the voice where it is; `resumeSpeech` carries on from the same spot. */
export function pauseSpeech(): void {
  const t = track
  if (!t || t.paused) return
  const at = elapsedInChunk(t)
  t.paused = true
  t.halt?.()
  t.offset = at
  stopWaitingCue()
  notifySpeaking()
}

export function resumeSpeech(): void {
  const t = track
  if (!t || !t.paused) return
  t.paused = false
  wake(t)
  notifySpeaking()
}

/** Moves the playhead to `seconds` into the message. A spot not made yet waits at the start of its piece. */
export function seekSpeech(seconds: number): void {
  const t = track
  if (!t) return
  const lengths = chunkSeconds(t)
  let rest = Math.min(
    Math.max(seconds, 0),
    lengths.reduce((sum, length) => sum + length, 0)
  )
  let index = 0
  while (index < lengths.length - 1 && rest >= lengths[index]) {
    rest -= lengths[index]
    index++
  }
  if (index >= t.buffers.length) {
    index = t.buffers.length
    rest = 0
  }
  t.epoch++
  t.halt?.()
  t.index = index
  t.offset = rest
  wake(t)
  notifySpeaking()
}

/** Jumps ahead (or back, when negative) from where the playhead is now. */
export function skipSpeech(deltaSeconds: number): void {
  const progress = getSpeechProgress()
  if (progress) seekSpeech(progress.position + deltaSeconds)
}

async function fetchChunk(text: string, signal: AbortSignal): Promise<AudioBuffer> {
  const response = await fetch(SPEECH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: text, voice: VOICE, lang: LANGUAGE, speed: 1 }),
    signal
  })
  if (!response.ok) throw new Error(`speech server answered ${response.status}`)
  const pcm = new Int16Array(await response.arrayBuffer())
  const buffer = (audio ??= new AudioContext()).createBuffer(1, pcm.length, SAMPLE_RATE)
  const channel = buffer.getChannelData(0)
  for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768
  return buffer
}

/** Makes every piece in order, ahead of the playhead; a failure is left on the track for the loop to find. */
async function loadChunks(t: Track, signal: AbortSignal): Promise<void> {
  try {
    for (const text of t.chunks) {
      t.buffers.push(await fetchChunk(text, signal))
      wake(t)
    }
  } catch (error) {
    t.failure = error
    wake(t)
  }
}

/**
 * Plays one piece from the playhead. Resolves true when it played to its end, false when
 * it was cut short (paused, jumped, stopped), so a cut never leaves the loop waiting on a
 * sound that will not report that it ended.
 */
function playSlice(t: Track, buffer: AudioBuffer): Promise<boolean> {
  return new Promise((resolve) => {
    const context = (audio ??= new AudioContext())
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    let settled = false
    const settle = (finished: boolean): void => {
      if (settled) return
      settled = true
      if (t.source === source) {
        t.source = null
        t.startedAt = null
      }
      if (t.halt === halt) t.halt = null
      resolve(finished)
    }
    const halt = (): void => {
      source.onended = null
      try {
        source.stop()
      } catch {
        // Never started, or already over.
      }
      settle(false)
    }
    source.onended = () => settle(true)
    t.source = source
    t.halt = halt
    t.startedAt = null
    // If the browser keeps the audio engine asleep, give up instead of stalling the queue.
    const woke = Promise.race([
      context.resume(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('audio engine asleep')), 3_000)
      )
    ])
    void woke.then(
      () => {
        // Cut short while the audio engine was waking up: say nothing.
        if (settled) return
        t.startedAt = context.currentTime
        source.start(0, t.offset)
      },
      (error) => {
        console.warn('[speak] audio engine would not start', error)
        settle(true)
      }
    )
  })
}

/** Stops whatever is being said and drops everything still queued. */
export function stopSpeaking(): void {
  generation++
  controller?.abort()
  controller = null
  const t = track
  track = null
  if (t) {
    t.halt?.()
    wake(t)
  }
  stopWaitingCue()
  queueTail = Promise.resolve()
  setSpeakingKey(null)
  notifySpeaking()
}

async function sayNow(
  markdown: string,
  mine: number,
  { key = null, maxChars }: { key?: string | null; maxChars?: number }
): Promise<boolean> {
  const chunks = chunkSpeech(prepareSpeech(markdown, maxChars))
  if (chunks.length === 0) return true
  const abort = new AbortController()
  controller = abort
  const t: Track = {
    chunks,
    buffers: [],
    failure: null,
    index: 0,
    offset: 0,
    startedAt: null,
    paused: false,
    epoch: 0,
    source: null,
    halt: null,
    nudge: null
  }
  track = t
  setSpeakingKey(key)
  notifySpeaking()
  // The words are here but the voice is not ready: a soft cue fills the wait.
  startWaitingCue(extractMood(markdown))
  void loadChunks(t, abort.signal)
  try {
    while (t.index < chunks.length) {
      if (mine !== generation) return true
      if (t.paused) {
        await waitForChange(t)
        continue
      }
      const buffer = t.buffers[t.index]
      if (!buffer) {
        if (t.failure) throw t.failure
        await waitForChange(t)
        continue
      }
      stopWaitingCue()
      const epoch = t.epoch
      if ((await playSlice(t, buffer)) && t.epoch === epoch) {
        t.index++
        t.offset = 0
      }
    }
    return true
  } catch (error) {
    if (abort.signal.aborted) return true
    console.warn('[speak] local voice server unreachable', error)
    return false
  } finally {
    stopWaitingCue()
    if (track === t) {
      track = null
      notifySpeaking()
    }
    if (mine === generation && speakingKey === key) setSpeakingKey(null)
  }
}

/**
 * Says `markdown` after whatever is already being said. Resolves false when the speech
 * server could not be reached, so the caller can tell the person once.
 */
export function enqueueSpeech(markdown: string, options: SpeakOptions = {}): Promise<boolean> {
  const mine = generation
  const run = queueTail.then(() =>
    mine !== generation
      ? true
      : sayNow(markdown, mine, { key: options.key, maxChars: options.maxChars })
  )
  queueTail = run.catch(() => true)
  return run
}

/** Says `markdown` aloud right now, replacing anything being said or queued. */
export function speak(markdown: string, options: SpeakOptions = {}): Promise<boolean> {
  stopSpeaking()
  return enqueueSpeech(markdown, options)
}

/** What the play button under a message says: the whole message, up to a generous cap. */
export function speakMessage(markdown: string, key: string): Promise<boolean> {
  return speak(markdown, { key, maxChars: MANUAL_MAX_SPOKEN_CHARS })
}
