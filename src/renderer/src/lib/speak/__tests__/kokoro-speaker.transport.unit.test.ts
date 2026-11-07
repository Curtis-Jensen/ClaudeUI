import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../sfx', () => ({ startWaitingCue: vi.fn(), stopWaitingCue: vi.fn() }))

// Two pieces of speech, 2 s and 3 s long at 24 kHz, so positions are easy to check.
const SAMPLE_RATE = 24_000
const SENTENCE = `${'word '.repeat(45).trim()}. `
const TEXT = SENTENCE.repeat(2)

class FakeSource {
  buffer: { duration: number } | null = null
  onended: (() => void) | null = null
  starts: number[] = []
  stopped = false
  connect(): void {}
  start(_when: number, offset: number): void {
    this.starts.push(offset)
  }
  stop(): void {
    this.stopped = true
  }
  finish(): void {
    this.onended?.()
  }
}

let sources: FakeSource[]
let clock: number

class FakeAudioContext {
  destination = {}
  get currentTime(): number {
    return clock
  }
  createBuffer(
    _channels: number,
    length: number
  ): { duration: number; getChannelData: () => Float32Array } {
    return { duration: length / SAMPLE_RATE, getChannelData: () => new Float32Array(length) }
  }
  createBufferSource(): FakeSource {
    const source = new FakeSource()
    sources.push(source)
    return source
  }
  resume(): Promise<void> {
    return Promise.resolve()
  }
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('seekable speech', () => {
  let speaker: typeof import('../kokoro-speaker')

  beforeEach(async () => {
    sources = []
    clock = 0
    vi.stubGlobal('AudioContext', FakeAudioContext)
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const seconds = call++ === 0 ? 2 : 3
        return { ok: true, arrayBuffer: async () => new Int16Array(seconds * SAMPLE_RATE).buffer }
      })
    )
    vi.resetModules()
    speaker = await import('../kokoro-speaker')
  })

  afterEach(() => {
    speaker.stopSpeaking()
    vi.unstubAllGlobals()
  })

  it('reports the playhead and the whole length once the pieces are made', async () => {
    void speaker.speakMessage(TEXT, 'm1')
    await flush()
    expect(speaker.getSpeechProgress()).toEqual({ position: 0, duration: 5, loaded: 5 })
    clock = 1.5
    expect(speaker.getSpeechProgress()?.position).toBeCloseTo(1.5)
  })

  it('pauses where it is and carries on from the same spot', async () => {
    void speaker.speakMessage(TEXT, 'm1')
    await flush()
    clock = 1.5
    speaker.pauseSpeech()
    await flush()
    expect(sources[0].stopped).toBe(true)
    expect(speaker.isSpeechPaused()).toBe(true)
    expect(speaker.isSpeechPlaying()).toBe(false)
    expect(speaker.getSpeechProgress()?.position).toBeCloseTo(1.5)

    clock = 9
    expect(speaker.getSpeechProgress()?.position).toBeCloseTo(1.5)
    speaker.resumeSpeech()
    await flush()
    expect(sources).toHaveLength(2)
    expect(sources[1].starts[0]).toBeCloseTo(1.5)
  })

  it('jumps into the middle of a later piece, and back again', async () => {
    void speaker.speakMessage(TEXT, 'm1')
    await flush()
    speaker.seekSpeech(3.5)
    await flush()
    expect(sources[0].stopped).toBe(true)
    expect(sources[1].starts[0]).toBeCloseTo(1.5)
    expect(speaker.getSpeechProgress()?.position).toBeCloseTo(3.5)

    clock = 0.5
    speaker.skipSpeech(-4)
    await flush()
    expect(sources[2].starts[0]).toBeCloseTo(0)
    expect(speaker.getSpeechProgress()?.position).toBeCloseTo(0)
  })

  it('stays paused through a jump', async () => {
    void speaker.speakMessage(TEXT, 'm1')
    await flush()
    speaker.pauseSpeech()
    speaker.seekSpeech(4)
    await flush()
    expect(sources).toHaveLength(1)
    expect(speaker.getSpeechProgress()?.position).toBeCloseTo(4)
    speaker.resumeSpeech()
    await flush()
    expect(sources[1].starts[0]).toBeCloseTo(2)
  })

  it('counts a piece that ended while the person jumped only once', async () => {
    void speaker.speakMessage(TEXT, 'm1')
    await flush()
    sources[0].finish()
    speaker.seekSpeech(0.5)
    await flush()
    expect(sources.at(-1)?.starts[0]).toBeCloseTo(0.5)
    expect(speaker.getSpeechProgress()?.position).toBeCloseTo(0.5)
  })

  it('finishes, and forgets the message, when played to the end', async () => {
    const done = speaker.speakMessage(TEXT, 'm1')
    await flush()
    sources[0].finish()
    await flush()
    sources[1].finish()
    await expect(done).resolves.toBe(true)
    expect(speaker.getSpeakingKey()).toBeNull()
    expect(speaker.getSpeechProgress()).toBeNull()
  })

  it('stopping while paused ends the message', async () => {
    const done = speaker.speakMessage(TEXT, 'm1')
    await flush()
    speaker.pauseSpeech()
    speaker.stopSpeaking()
    await expect(done).resolves.toBe(true)
    expect(speaker.getSpeakingKey()).toBeNull()
  })
})
