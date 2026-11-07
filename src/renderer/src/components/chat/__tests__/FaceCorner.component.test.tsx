import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sound = vi.hoisted(() => ({ playHappyNoise: vi.fn() }))
vi.mock('../../../lib/speak/pet-sound', () => sound)
vi.mock('../SpeakToggle', () => ({ SpeakToggle: () => <button data-testid="SpeakToggle" /> }))
vi.mock('../TypingToggle', () => ({ TypingToggle: () => <button data-testid="TypingToggle" /> }))

import { useSessionStore } from '../../../stores/session-store'
import { DRAG_START_PX, FaceCorner, MENU_HIDE_MS, PET_MOOD_MS } from '../FaceCorner'

describe('FaceCorner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  const face = (): HTMLElement => screen.getByTestId('FaceCorner.face')
  const shownMood = (): string | null =>
    within(face()).getByTestId('MoodFace').getAttribute('data-mood')

  it('hides the sound switches until the face is tapped', () => {
    render(<FaceCorner mood="calm" size={40} />)
    expect(screen.queryByTestId('SpeakToggle')).toBeNull()
    expect(screen.queryByTestId('TypingToggle')).toBeNull()

    fireEvent.click(face())
    expect(screen.getByTestId('SpeakToggle')).toBeInTheDocument()
    expect(screen.getByTestId('TypingToggle')).toBeInTheDocument()
  })

  it('a pet makes the happy noise and the face looks happy for a moment', () => {
    render(<FaceCorner mood="sad" size={40} />)
    expect(shownMood()).toBe('sad')

    fireEvent.click(face())
    expect(sound.playHappyNoise).toHaveBeenCalledTimes(1)
    expect(shownMood()).toBe('happy')

    act(() => {
      vi.advanceTimersByTime(PET_MOOD_MS + 10)
    })
    expect(shownMood()).toBe('sad')
  })

  it('picking a face from the expressions menu shows it until the real mood changes', () => {
    const { rerender } = render(<FaceCorner mood="calm" size={40} />)
    fireEvent.click(face())
    fireEvent.click(screen.getByTestId('MoodPicker.button'))
    fireEvent.click(screen.getByTestId('MoodPicker.mood.worried'))
    act(() => {
      vi.advanceTimersByTime(PET_MOOD_MS + 10)
    })
    expect(shownMood()).toBe('worried')

    rerender(<FaceCorner mood="proud" size={40} />)
    expect(shownMood()).toBe('proud')
  })

  it('every pet makes the noise', () => {
    render(<FaceCorner mood="calm" size={40} />)
    fireEvent.click(face())
    fireEvent.click(face())
    fireEvent.click(face())
    expect(sound.playHappyNoise).toHaveBeenCalledTimes(3)
  })

  it('tucks the menu away a few seconds after the last pet, and a new pet keeps it up', () => {
    render(<FaceCorner mood="calm" size={40} />)
    fireEvent.click(face())

    act(() => {
      vi.advanceTimersByTime(MENU_HIDE_MS - 1_000)
    })
    fireEvent.click(face())
    act(() => {
      vi.advanceTimersByTime(MENU_HIDE_MS - 1_000)
    })
    expect(screen.getByTestId('FaceCorner.menu')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1_500)
    })
    expect(screen.queryByTestId('FaceCorner.menu')).toBeNull()
  })

  it('keeps the menu up while the pointer is on it', () => {
    render(<FaceCorner mood="calm" size={40} />)
    fireEvent.click(face())
    const menu = screen.getByTestId('FaceCorner.menu')

    fireEvent.pointerEnter(menu)
    act(() => {
      vi.advanceTimersByTime(MENU_HIDE_MS * 2)
    })
    expect(screen.getByTestId('FaceCorner.menu')).toBeInTheDocument()

    fireEvent.pointerLeave(menu)
    act(() => {
      vi.advanceTimersByTime(MENU_HIDE_MS + 10)
    })
    expect(screen.queryByTestId('FaceCorner.menu')).toBeNull()
  })
  describe('throwing', () => {
    const press = (x: number, y: number): void => {
      fireEvent.pointerDown(face(), { pointerId: 1, button: 0, clientX: x, clientY: y })
    }
    const move = (x: number, y: number): void => {
      fireEvent.pointerMove(face(), { pointerId: 1, clientX: x, clientY: y })
    }
    const release = (x: number, y: number): void => {
      fireEvent.pointerUp(face(), { pointerId: 1, clientX: x, clientY: y })
    }

    it('a press that barely moves is still a pet', () => {
      render(<FaceCorner mood="calm" size={40} />)
      press(100, 100)
      move(100 + DRAG_START_PX - 2, 100)
      release(100 + DRAG_START_PX - 2, 100)
      fireEvent.click(face())
      expect(sound.playHappyNoise).toHaveBeenCalledTimes(1)
      expect(screen.queryByTestId('FaceCorner.thrown')).toBeNull()
    })

    it('dragging picks the face up as a basketball with its eyes and lines', () => {
      render(<FaceCorner mood="calm" size={40} />)
      press(100, 100)
      move(100 + DRAG_START_PX + 20, 100)

      const thrown = screen.getByTestId('FaceCorner.thrown')
      expect(thrown.querySelector('[data-testid="MoodFace.seams"]')).not.toBeNull()
      expect(thrown.querySelector('[data-testid="MoodFace.eyes"]')).not.toBeNull()
      expect(screen.queryByTestId('FaceCorner.menu')).toBeNull()
    })

    it('a face picked from the expressions menu stays on the basketball', () => {
      render(<FaceCorner mood="calm" size={40} />)
      fireEvent.click(face())
      fireEvent.click(screen.getByTestId('MoodPicker.button'))
      fireEvent.click(screen.getByTestId('MoodPicker.mood.worried'))
      press(100, 100)
      move(100 + DRAG_START_PX + 20, 100)

      const thrown = screen.getByTestId('FaceCorner.thrown')
      expect(thrown.querySelector('[data-testid="MoodFace"]')?.getAttribute('data-mood')).toBe(
        'worried'
      )
    })

    it('dims and blocks the window while the face is out, and clears it when the face is home', () => {
      render(<FaceCorner mood="calm" size={40} />)
      expect(screen.queryByTestId('FaceCorner.backdrop')).toBeNull()

      press(100, 100)
      move(100 + DRAG_START_PX + 20, 100)
      expect(screen.getByTestId('FaceCorner.backdrop')).toBeInTheDocument()
    })

    it('stays a ball, with the window blocked and a hang spot shown, until it is hung up', () => {
      render(<FaceCorner mood="calm" size={40} />)
      press(100, 100)
      move(100 + DRAG_START_PX + 20, 100)
      release(100 + DRAG_START_PX + 20, 100)

      act(() => {
        vi.advanceTimersByTime(60_000)
      })
      fireEvent.keyDown(window, { key: 'Escape' })
      fireEvent.pointerDown(screen.getByTestId('FaceCorner.backdrop'))
      expect(screen.getByTestId('FaceCorner.thrown')).toBeInTheDocument()
      expect(screen.getByTestId('FaceCorner.backdrop')).toBeInTheDocument()
      expect(screen.getByTestId('FaceCorner.hangSpot')).toBeInTheDocument()
    })

    it('holding down on the dimmed window shows a hand, and letting go puts it away', () => {
      render(<FaceCorner mood="calm" size={40} />)
      press(100, 100)
      move(100 + DRAG_START_PX + 20, 100)
      release(100 + DRAG_START_PX + 20, 100)

      const backdrop = screen.getByTestId('FaceCorner.backdrop')
      expect(screen.queryByTestId('FaceCorner.hand')).toBeNull()
      fireEvent.pointerDown(backdrop, { pointerId: 2, button: 0, clientX: 300, clientY: 300 })
      expect(screen.getByTestId('FaceCorner.hand')).toBeInTheDocument()
      fireEvent.pointerUp(backdrop, { pointerId: 2 })
      expect(screen.queryByTestId('FaceCorner.hand')).toBeNull()
    })

    it('shows no hang spot or hoop while the face is home', () => {
      render(<FaceCorner mood="calm" size={40} />)
      expect(screen.queryByTestId('FaceCorner.hangSpot')).toBeNull()
      expect(screen.queryByTestId('FaceCorner.hoop')).toBeNull()
    })

    it('puts up no hoop unless it is switched on', () => {
      render(<FaceCorner mood="calm" size={40} />)
      press(100, 100)
      move(100 + DRAG_START_PX + 20, 100)
      expect(screen.queryByTestId('FaceCorner.hoop')).toBeNull()
    })

    it('puts up a hoop, with no baskets yet, while the face is a ball and the hoop is on', () => {
      window.localStorage.setItem('claudeui.basketballHoop', '1')
      render(<FaceCorner mood="calm" size={40} />)
      press(100, 100)
      move(100 + DRAG_START_PX + 20, 100)
      expect(screen.getByTestId('FaceCorner.hoop')).toBeInTheDocument()
      expect(screen.queryByTestId('FaceCorner.baskets')).toBeNull()
      window.localStorage.removeItem('claudeui.basketballHoop')
    })

    it('has a hoop switch in the menu that starts off and turns on', () => {
      render(<FaceCorner mood="calm" size={40} />)
      fireEvent.click(face())
      const toggle = screen.getByTestId('HoopToggle')
      expect(toggle.getAttribute('aria-pressed')).toBe('false')
      fireEvent.click(toggle)
      expect(toggle.getAttribute('aria-pressed')).toBe('true')
      expect(window.localStorage.getItem('claudeui.basketballHoop')).toBe('1')
      window.localStorage.removeItem('claudeui.basketballHoop')
    })

    it('letting go after a drag is a throw, not a pet', () => {
      render(<FaceCorner mood="calm" size={40} />)
      press(100, 100)
      move(100 + DRAG_START_PX + 20, 100)
      release(100 + DRAG_START_PX + 20, 100)
      sound.playHappyNoise.mockClear()
      fireEvent.click(face())
      expect(sound.playHappyNoise).not.toHaveBeenCalled()
      expect(screen.queryByTestId('FaceCorner.menu')).toBeNull()
    })
  })

  describe('with the look picker', () => {
    const picker = (): HTMLElement => screen.getByTestId('LookPicker.button')

    // The picker is for the chat in view, so it needs one open.
    beforeEach(() => useSessionStore.setState({ activeSessionId: 'chat-a' }))
    afterEach(() => useSessionStore.setState({ activeSessionId: null }))

    it('has one Look button in the menu, in place of separate texture and color buttons', () => {
      render(<FaceCorner mood="calm" size={40} />)
      fireEvent.click(face())
      expect(picker()).toBeInTheDocument()
      expect(screen.queryByTestId('TextureToggle')).toBeNull()
      expect(screen.queryByTestId('ColorToggle')).toBeNull()
    })

    it('keeps the menu up while the picker is open, however long you take', () => {
      render(<FaceCorner mood="calm" size={40} />)
      fireEvent.click(face())
      fireEvent.click(picker())
      act(() => {
        vi.advanceTimersByTime(MENU_HIDE_MS * 3)
      })
      expect(screen.getByTestId('FaceCorner.menu')).toBeInTheDocument()
      expect(screen.getByTestId('LookPicker.panel')).toBeInTheDocument()
    })

    it('tucks the menu away again a few seconds after the picker closes', () => {
      render(<FaceCorner mood="calm" size={40} />)
      fireEvent.click(face())
      fireEvent.click(picker())
      fireEvent.click(picker())
      act(() => {
        vi.advanceTimersByTime(MENU_HIDE_MS + 10)
      })
      expect(screen.queryByTestId('FaceCorner.menu')).toBeNull()
    })
  })
})
