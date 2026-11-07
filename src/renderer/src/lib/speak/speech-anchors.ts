/**
 * Ties the words the voice says to where they sit on screen, so the bar can follow the line being
 * read and a click on a line can start the voice there. A message's markdown text is shown as
 * paragraphs, list items and headings; each one is found again in the spoken text, in order.
 * Code, tables and the like are not spoken, so they simply find no match and are left out.
 */
export type SpeechAnchor = { element: HTMLElement; start: number; end: number }

/** A place on the message: `y` pixels down from its top is where the voice is at letter `char`. */
export type SpeechStop = { y: number; char: number }

const TEXT_BLOCKS = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']
const BLOCK_SELECTOR = TEXT_BLOCKS.map((tag) => `[data-speech-text] ${tag}`).join(', ')
// Inside a block, what is not the block's own words: nested blocks get their own anchor.
const NESTED_SELECTOR = [...TEXT_BLOCKS, 'ul', 'ol', 'pre', 'table', 'blockquote'].join(', ')
// If a block's whole text is not found (a bare link is spoken as "a link"), its start is enough.
const PREFIX_CHARS = 24

function ownText(element: HTMLElement): string {
  const copy = element.cloneNode(true) as HTMLElement
  copy.querySelectorAll(NESTED_SELECTOR).forEach((node) => node.remove())
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Finds each text block of `root` in `spoken`, reading down the page and the text together. */
export function findAnchors(root: ParentNode, spoken: string): SpeechAnchor[] {
  const anchors: SpeechAnchor[] = []
  let cursor = 0
  for (const element of root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    if (element.closest('pre, table')) continue
    const text = ownText(element)
    if (!text) continue
    let start = spoken.indexOf(text, cursor)
    if (start === -1 && text.length > PREFIX_CHARS) {
      start = spoken.indexOf(text.slice(0, PREFIX_CHARS), cursor)
    }
    if (start === -1) continue
    const end = Math.min(start + text.length, spoken.length)
    anchors.push({ element, start, end })
    cursor = end
  }
  return anchors
}

/** Where each anchor starts and ends on the page, measured from `containerTop`, top to bottom. */
export function measureStops(anchors: SpeechAnchor[], containerTop: number): SpeechStop[] {
  const stops: SpeechStop[] = []
  let lastY = 0
  const push = (y: number, char: number): void => {
    lastY = Math.max(y, lastY)
    stops.push({ y: lastY, char })
  }
  for (const { element, start, end } of anchors) {
    const rect = element.getBoundingClientRect()
    // A list item's own words end where its nested list begins, not where that list ends.
    const nested = element.querySelector('ul, ol, blockquote, pre, table, p')
    const bottom = nested ? nested.getBoundingClientRect().top : rect.bottom
    push(rect.top - containerTop, start)
    push(Math.max(bottom, rect.top) - containerTop, end)
  }
  return stops
}

function lineHeightOf(element: HTMLElement): number {
  const style = getComputedStyle(element)
  const height = parseFloat(style.lineHeight)
  return Number.isFinite(height) && height > 0 ? height : (parseFloat(style.fontSize) || 13) * 1.4
}

/** The text node and offset where letter `n` of an element's own words (spaces collapsed) sits. */
function domPosition(element: HTMLElement, n: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let count = 0
  let spaced = true
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest(NESTED_SELECTOR) !== element) continue
    const data = (node as Text).data
    for (let offset = 0; offset < data.length; offset++) {
      if (/\s/.test(data[offset])) {
        if (spaced) continue
        spaced = true
      } else {
        spaced = false
      }
      if (count === n) return { node: node as Text, offset }
      count++
    }
  }
  return null
}

/** How many lines down its block the letter sits, as the browser wrapped it; null if it cannot tell. */
function wrappedLine(anchor: SpeechAnchor, char: number, top: number, lineHeight: number) {
  const within = Math.max(0, Math.min(char - anchor.start, anchor.end - anchor.start - 1))
  const position = domPosition(anchor.element, within)
  if (!position) return null
  const range = document.createRange()
  range.setStart(position.node, position.offset)
  range.setEnd(position.node, position.offset + 1)
  const rect = range.getClientRects?.()[0]
  if (!rect || rect.height === 0) return null
  const middle = rect.top + rect.height / 2
  return Math.max(0, Math.round((middle - top - lineHeight / 2) / lineHeight))
}

/**
 * The middle of the line of the message the voice is on when it says letter `char`, in pixels
 * down from `containerTop`. The line is the one the browser actually wrapped the letter onto. It
 * holds still along a line and jumps a line's height when the voice reaches the next one; moving
 * to a new paragraph jumps by the gap too. Null when no text matches.
 */
export function lineYAtChar(
  anchors: SpeechAnchor[],
  containerTop: number,
  char: number
): number | null {
  if (anchors.length === 0) return null
  // The last block the voice has reached; before the first one, that one.
  const anchor = anchors.filter((a) => a.start <= char).pop() ?? anchors[0]
  const rect = anchor.element.getBoundingClientRect()
  const nested = anchor.element.querySelector('ul, ol, blockquote, pre, table, p')
  const bottom = nested ? nested.getBoundingClientRect().top : rect.bottom
  const lineHeight = lineHeightOf(anchor.element)
  const lines = Math.max(1, Math.round((bottom - rect.top) / lineHeight))
  let line = wrappedLine(anchor, char, rect.top, lineHeight)
  if (line === null) {
    // Cannot see the wrapping: guess from how far through the block's letters it is.
    const span = anchor.end - anchor.start
    const through = span > 0 ? Math.min(Math.max((char - anchor.start) / span, 0), 0.9999) : 0
    line = Math.floor(through * lines)
  }
  return rect.top - containerTop + Math.min(line, lines - 1) * lineHeight + lineHeight / 2
}

function interpolate(stops: SpeechStop[], key: keyof SpeechStop, value: number): number {
  const other = key === 'y' ? 'char' : 'y'
  if (value <= stops[0][key]) return stops[0][other]
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1]
    const to = stops[i]
    if (value <= to[key]) {
      const span = to[key] - from[key]
      return span <= 0
        ? to[other]
        : from[other] + ((to[other] - from[other]) * (value - from[key])) / span
    }
  }
  return stops[stops.length - 1][other]
}

/** How far down the message (in pixels) the voice is when it says letter `char`. */
export function yAtChar(stops: SpeechStop[], char: number): number {
  return interpolate(stops, 'char', char)
}

/** Which letter the voice is at when it has reached `y` pixels down the message. */
export function charAtY(stops: SpeechStop[], y: number): number {
  return interpolate(stops, 'y', y)
}

/** Where the sentence holding letter `char` begins, never earlier than the block it is in. */
export function sentenceStart(spoken: string, char: number, blockStart = 0): number {
  let start = blockStart
  const boundary = /[.!?]+["')\]]*\s+/g
  for (let match = boundary.exec(spoken); match; match = boundary.exec(spoken)) {
    const after = match.index + match[0].length
    if (after > char) break
    if (after > start) start = after
  }
  return start
}

function caretRangeAt(x: number, y: number): Range | null {
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y)
    if (!position) return null
    const range = document.createRange()
    range.setStart(position.offsetNode, position.offset)
    return range
  }
  return document.caretRangeFromPoint?.(x, y) ?? null
}

/** The start of the sentence under the point (x, y) on screen, as a letter of `spoken`; null off any words. */
export function spokenCharAtPoint(
  anchors: SpeechAnchor[],
  spoken: string,
  x: number,
  y: number
): number | null {
  const caret = caretRangeAt(x, y)
  if (!caret) return null
  // The deepest block holding the point comes last, since a nested item follows its parent.
  const anchor = anchors.filter((a) => a.element.contains(caret.startContainer)).pop()
  if (!anchor) return null
  const before = document.createRange()
  before.setStart(anchor.element, 0)
  before.setEnd(caret.startContainer, caret.startOffset)
  const typed = before.toString().replace(/\s+/g, ' ').trimStart().length
  const char = anchor.start + Math.min(typed, anchor.end - anchor.start)
  return sentenceStart(spoken, char, anchor.start)
}
