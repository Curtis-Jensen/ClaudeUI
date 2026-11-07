import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MOODS, type Mood } from '../../../../../shared/mood'
import { MoodFace } from '../MoodFace'

const CLOSED: Mood[] = ['happy', 'proud', 'tired']

describe('MoodFace', () => {
  afterEach(cleanup)

  const eyes = (): HTMLElement => screen.getByTestId('MoodFace.eyes')

  it('draws every mood, each with its own movement', () => {
    for (const mood of MOODS) {
      const { container, unmount } = render(<MoodFace mood={mood} />)
      expect(screen.getByTestId('MoodFace')).toHaveAttribute('data-mood', mood)
      const motion = container.querySelector('.face-motion')
      expect(motion?.getAttribute('class')).toMatch(
        /face-(breathe|bounce|bounce-fast|nod|tilt|sway|still|pop|shiver|droop|sag|twitch)/
      )
      unmount()
    }
  })

  it('blinks only with open eyes', () => {
    for (const mood of MOODS) {
      const { container, unmount } = render(<MoodFace mood={mood} />)
      const blinks = container.querySelector('.mood-blink') !== null
      expect(blinks, mood).toBe(!CLOSED.includes(mood))
      unmount()
    }
  })

  it('open eyes slide toward where the pointer is', () => {
    render(<MoodFace mood="calm" gaze={{ x: 1, y: -1 }} />)
    expect(eyes().style.transform).toBe('translate(2.60px, -2.00px)')
  })

  it('looks straight ahead with no pointer', () => {
    render(<MoodFace mood="calm" />)
    expect(eyes().style.transform).toBe('translate(0.00px, 0.00px)')
  })

  it('closed eyes do not follow the pointer', () => {
    for (const mood of CLOSED) {
      render(<MoodFace mood={mood} gaze={{ x: 1, y: 1 }} />)
      expect(eyes().style.transform, mood).toBe('translate(0.00px, 0.00px)')
      cleanup()
    }
  })

  it('a mood that already looks away follows the pointer less', () => {
    render(<MoodFace mood="thinking" gaze={{ x: 1, y: 0 }} />)
    const x = Number(/translate\(([\d.-]+)px/.exec(eyes().style.transform)?.[1])
    expect(x).toBeGreaterThan(0)
    expect(x).toBeLessThan(2.6)
  })

  it('only thinking has a thought bubble', () => {
    for (const mood of MOODS) {
      const { unmount } = render(<MoodFace mood={mood} />)
      const bubble = screen.queryByTestId('MoodFace.thought')
      expect(bubble !== null, mood).toBe(mood === 'thinking')
      unmount()
    }
  })

  it('the bubble can reach past the edge of the drawing', () => {
    const { container } = render(<MoodFace mood="thinking" />)
    expect(container.querySelector('svg')?.style.overflow).toBe('visible')
  })
})
