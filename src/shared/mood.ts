/**
 * The little face in the chat corner. The model ends a reply with a hidden tag
 * like `[[mood:happy]]`; the UI strips it from the text and shows the matching
 * face. Shared so the system prompt, the renderer and the tests agree on names.
 */
export const MOODS = [
  'happy',
  'excited',
  'proud',
  'curious',
  'thinking',
  'focused',
  'surprised',
  'worried',
  'sad',
  'tired',
  'annoyed',
  'calm'
] as const

export type Mood = (typeof MOODS)[number]

const COMPLETE_TAG = /\[\[mood:([a-z]+)\]\]/g

// A tag still being typed at the end of a streaming reply: `[[`, `[[mood:ha`, `[[mood:happy]`.
const PARTIAL_TAG_AT_END = /\[\[(?:m|mo|moo|mood|mood:[a-z]*(?:\]|\]\])?)?$/

function isMood(value: string): value is Mood {
  return (MOODS as readonly string[]).includes(value)
}

/** The last valid mood tag in `text`, or null when there is none. */
export function extractMood(text: string): Mood | null {
  let found: Mood | null = null
  for (const match of text.matchAll(COMPLETE_TAG)) {
    if (isMood(match[1])) found = match[1]
  }
  return found
}

/** `text` without mood tags, complete or half-typed, so a tag never flashes on screen. */
export function stripMoodTag(text: string): string {
  if (!text.includes('[[')) return text
  return text.replace(COMPLETE_TAG, '').replace(PARTIAL_TAG_AT_END, '').trimEnd()
}

/** The paragraph appended to the system prompt that teaches the model the tag. */
export const MOOD_FACE_PROMPT_SECTION = `
## Mood Face
The chat window shows a small cartoon face in its corner that reflects how you feel about each reply. End every reply that contains text with one final line holding a single tag, \`[[mood:NAME]]\`, where NAME is exactly one of: ${MOODS.join(', ')}.
Pick the one that honestly fits how you would feel about that message; most replies are calm, happy or curious, so do not force an emotion. The interface hides the tag, so never mention it, explain it or put it anywhere but the very end. Skip it on turns that are only tool calls.`
