/**
 * A short burst of soft keyboard clicks when Claude starts working, made in the browser's own
 * audio engine so no sound files are needed. It is skipped while the voice is speaking.
 */
const STORAGE_KEY = 'claudeui.typingSounds'

/** Typing sounds are on unless the person turned them off. */
export function isTypingSoundsEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

export function setTypingSoundsEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    // Private mode: the choice just will not be remembered.
  }
  if (!on) stopTypingSounds()
}

/** How many keys the opening burst presses. */
export const BURST_KEYS = 8

/** Milliseconds until the next key of the burst: quick and a little uneven, like real typing. */
export function nextKeyDelay(random: () => number): number {
  return 45 + random() * 70
}

let context: AudioContext | null = null
let noise: AudioBuffer | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let running = false

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise
  const length = Math.floor(c.sampleRate * 0.08)
  noise = c.createBuffer(1, length, c.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return noise
}

/** One key: a short burst of filtered noise (the click) over a low, quick thud. */
function keyClick(c: AudioContext): void {
  const now = c.currentTime
  const peak = 0.04 + Math.random() * 0.04

  const click = c.createBufferSource()
  click.buffer = noiseBuffer(c)
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1800 + Math.random() * 2600
  band.Q.value = 1.1
  const clickGain = c.createGain()
  clickGain.gain.setValueAtTime(0.0001, now)
  clickGain.gain.linearRampToValueAtTime(peak, now + 0.002)
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03 + Math.random() * 0.02)
  click.connect(band).connect(clickGain).connect(c.destination)
  click.start(now)
  click.stop(now + 0.08)

  const thud = c.createOscillator()
  thud.type = 'sine'
  thud.frequency.value = 130 + Math.random() * 70
  const thudGain = c.createGain()
  thudGain.gain.setValueAtTime(0.0001, now)
  thudGain.gain.linearRampToValueAtTime(peak * 0.7, now + 0.003)
  thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
  thud.connect(thudGain).connect(c.destination)
  thud.start(now)
  thud.stop(now + 0.07)
}

/** Types one short burst; `isQuiet` is asked before each key, and a quiet moment skips it. */
export function playTypingBurst(isQuiet: () => boolean = () => false): void {
  // No audio engine (a test window, an old browser): stay silent rather than break the chat.
  if (typeof AudioContext === 'undefined') return
  stopTypingSounds()
  running = true
  const c = (context ??= new AudioContext())
  void c.resume()
  let pressed = 0
  const tick = (): void => {
    if (!running) return
    if (!isQuiet()) keyClick(c)
    pressed++
    if (pressed >= BURST_KEYS) {
      running = false
      timer = null
      return
    }
    timer = setTimeout(tick, nextKeyDelay(Math.random))
  }
  tick()
}

/** Cuts a burst short. */
export function stopTypingSounds(): void {
  running = false
  if (timer) clearTimeout(timer)
  timer = null
}
