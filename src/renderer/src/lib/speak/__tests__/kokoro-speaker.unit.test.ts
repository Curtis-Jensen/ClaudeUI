import { describe, expect, it } from 'vitest'
import { chunkSpeech, prepareSpeech } from '../kokoro-speaker'

describe('prepareSpeech', () => {
  it('drops code blocks, tables, the mood tag and markdown marks', () => {
    const reply = [
      '## Done',
      'It **works** and the `fix` is in.',
      '```ts',
      'const x = 1',
      '```',
      '| a | b |',
      '- first point',
      '[the docs](https://example.com/x) and https://example.com/y',
      '',
      '[[mood:proud]]'
    ].join('\n')
    const spoken = prepareSpeech(reply)
    expect(spoken).toBe('Done It works and the fix is in. first point the docs and a link')
  })

  it('drops an unfinished code block', () => {
    expect(prepareSpeech('Look:\n```\nnever closed')).toBe('Look:')
  })

  it('shortens very long replies, but leaves a closing summary room to be read in full', () => {
    expect(prepareSpeech('word '.repeat(2000)).length).toBeLessThanOrEqual(4001)
    expect(prepareSpeech('word '.repeat(600)).endsWith('…')).toBe(false)
  })
})

describe('chunkSpeech', () => {
  it('keeps short text in one piece', () => {
    expect(chunkSpeech('One. Two.')).toEqual(['One. Two.'])
  })

  it('splits long text on sentence ends, never mid-sentence', () => {
    const sentence = 'This is a sentence of a fair length for the test. '
    const chunks = chunkSpeech(sentence.repeat(12))
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) expect(chunk.endsWith('.')).toBe(true)
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(sentence.repeat(12).trim())
  })

  it('returns nothing for empty text', () => {
    expect(chunkSpeech('')).toEqual([])
  })
})
