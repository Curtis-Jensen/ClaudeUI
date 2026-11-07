import { describe, expect, it } from 'vitest'
import { extractMood, stripMoodTag, MOODS } from '../mood'

describe('extractMood', () => {
  it('reads the tag at the end of a reply', () => {
    expect(extractMood('Done, it works.\n\n[[mood:proud]]')).toBe('proud')
  })

  it('uses the last tag when several appear', () => {
    expect(extractMood('[[mood:sad]] then [[mood:happy]]')).toBe('happy')
  })

  it('ignores names that are not moods', () => {
    expect(extractMood('hi [[mood:furious]]')).toBeNull()
  })

  it('returns null when there is no tag', () => {
    expect(extractMood('plain reply')).toBeNull()
  })

  it('knows every listed mood', () => {
    for (const mood of MOODS) expect(extractMood(`x [[mood:${mood}]]`)).toBe(mood)
  })
})

describe('stripMoodTag', () => {
  it('removes a complete tag and the blank space before it', () => {
    expect(stripMoodTag('All good.\n\n[[mood:calm]]\n')).toBe('All good.')
  })

  it('hides a tag that is still being typed while streaming', () => {
    for (const partial of ['[[', '[[mo', '[[mood', '[[mood:', '[[mood:hap', '[[mood:happy]']) {
      expect(stripMoodTag(`Almost there ${partial}`)).toBe('Almost there')
    }
  })

  it('leaves ordinary text and double brackets elsewhere alone', () => {
    expect(stripMoodTag('use a[[0]] index here')).toBe('use a[[0]] index here')
    expect(stripMoodTag('no brackets')).toBe('no brackets')
  })
})
