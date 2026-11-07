import { describe, expect, it } from 'vitest'
import { charAtY, findAnchors, lineYAtChar, sentenceStart, yAtChar } from '../speech-anchors'

function message(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `<div data-speech-text>${html}</div>`
  return root
}

describe('findAnchors', () => {
  it('matches paragraphs, headings and list items to their place in the spoken text', () => {
    const root = message('<h2>Plan</h2><p>First we dig.</p><ul><li>Then we build.</li></ul>')
    const spoken = 'Plan First we dig. Then we build.'
    const found = findAnchors(root, spoken).map((a) => spoken.slice(a.start, a.end))
    expect(found).toEqual(['Plan', 'First we dig.', 'Then we build.'])
  })

  it('leaves out code and tables, which are not spoken', () => {
    const root = message('<p>Before.</p><pre><code>const x = 1</code></pre><p>After.</p>')
    const spoken = 'Before. After.'
    expect(findAnchors(root, spoken)).toHaveLength(2)
  })

  it('ignores text outside the message text, such as thinking', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>Hmm, let me think.</p><div data-speech-text><p>Hello.</p></div>'
    expect(findAnchors(root, 'Hmm, let me think. Hello.')).toHaveLength(1)
  })

  it("keeps a list item's own words apart from its nested list", () => {
    const root = message('<ul><li>Outer<ul><li>Inner</li></ul></li></ul>')
    const spoken = 'Outer Inner'
    const found = findAnchors(root, spoken).map((a) => spoken.slice(a.start, a.end))
    expect(found).toEqual(['Outer', 'Inner'])
  })
})

describe('stops', () => {
  const stops = [
    { y: 0, char: 0 },
    { y: 40, char: 100 },
    { y: 200, char: 100 },
    { y: 240, char: 200 }
  ]

  it('finds where the voice is on screen, holding still across an unspoken block', () => {
    expect(yAtChar(stops, 50)).toBe(20)
    expect(yAtChar(stops, 150)).toBe(220)
  })

  it('finds the letter at a spot on screen, and back', () => {
    expect(charAtY(stops, 20)).toBe(50)
    expect(charAtY(stops, 220)).toBe(150)
    expect(charAtY(stops, 999)).toBe(200)
  })
})

describe('sentenceStart', () => {
  const spoken = 'One here. Two there. Three.'

  it('begins at the sentence holding the letter', () => {
    expect(sentenceStart(spoken, 12)).toBe(10)
    expect(sentenceStart(spoken, 3)).toBe(0)
  })

  it('never reaches back before the block, so a heading without a full stop stays itself', () => {
    expect(sentenceStart(spoken, 12, 10)).toBe(10)
    expect(sentenceStart(spoken, 22, 21)).toBe(21)
  })
})

describe('lineYAtChar', () => {
  function block(top: number, height: number): HTMLElement {
    const el = document.createElement('p')
    el.style.lineHeight = '20px'
    el.getBoundingClientRect = () => ({ top, bottom: top + height, height }) as DOMRect
    return el
  }
  // A three-line paragraph (letters 0-90), then a one-line paragraph (100-120) after a gap.
  const anchors = [
    { element: block(100, 60), start: 0, end: 90 },
    { element: block(172, 20), start: 100, end: 120 }
  ]

  it('holds on a line and hops a whole line at a time', () => {
    expect(lineYAtChar(anchors, 100, 0)).toBe(10)
    expect(lineYAtChar(anchors, 100, 29)).toBe(10)
    expect(lineYAtChar(anchors, 100, 31)).toBe(30)
    expect(lineYAtChar(anchors, 100, 89)).toBe(50)
  })

  it('hops over the gap to the next paragraph, and stays put in between', () => {
    expect(lineYAtChar(anchors, 100, 95)).toBe(50)
    expect(lineYAtChar(anchors, 100, 100)).toBe(82)
  })

  it('has no answer when no text matched', () => {
    expect(lineYAtChar([], 0, 5)).toBeNull()
  })
})

describe('lineYAtChar with wrapped text', () => {
  it('follows the line the browser wrapped the letter onto', () => {
    const el = document.createElement('p')
    el.style.lineHeight = '20px'
    el.textContent = 'aaaaaaaaaa bbbbbbbbbb'
    el.getBoundingClientRect = () => ({ top: 100, bottom: 140, height: 40 }) as DOMRect
    const original = Range.prototype.getClientRects
    // Eleven letters to a line.
    Range.prototype.getClientRects = function (this: Range) {
      const top = 100 + Math.floor(this.startOffset / 11) * 20
      return [{ top, height: 16 }] as unknown as DOMRectList
    }
    try {
      const anchors = [{ element: el, start: 0, end: 21 }]
      expect(lineYAtChar(anchors, 100, 3)).toBe(10)
      expect(lineYAtChar(anchors, 100, 12)).toBe(30)
    } finally {
      Range.prototype.getClientRects = original
    }
  })
})
