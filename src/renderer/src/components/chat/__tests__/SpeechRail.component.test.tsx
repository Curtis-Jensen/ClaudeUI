import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const speaker = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const state = {
    key: 'm1' as string | null,
    paused: false,
    progress: { position: 25, duration: 100, loaded: 60 } as {
      position: number
      duration: number
      loaded: number
    } | null
  }
  return {
    state,
    listeners,
    subscribeSpeaking: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSpeakingKey: () => state.key,
    isSpeechPaused: () => state.paused,
    getSpeechProgress: () => state.progress,
    getSpeechTimeline: () => null,
    prepareSpeech: (text: string) => text,
    speakMessage: vi.fn(async () => true),
    pauseSpeech: vi.fn(),
    resumeSpeech: vi.fn(),
    seekSpeech: vi.fn(),
    skipSpeech: vi.fn(),
    stopSpeaking: vi.fn()
  }
})
vi.mock('../../../lib/speak/kokoro-speaker', () => speaker)

const mobile = vi.hoisted(() => ({ value: false }))
vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => mobile.value }))

import { SpeakButton } from '../SpeakButton'
import { SpeechRail } from '../SpeechRail'

beforeEach(() => {
  speaker.state.key = 'm1'
  speaker.state.paused = false
  speaker.state.progress = { position: 25, duration: 100, loaded: 60 }
  mobile.value = false
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('SpeechRail', () => {
  it('shows nothing unless this message is the one being read', () => {
    speaker.state.key = 'other'
    render(<SpeechRail messageId="m1" />)
    expect(screen.queryByTestId('SpeechRail')).toBeNull()
  })

  it('shows nothing on a phone, where the margin has no room for it', () => {
    mobile.value = true
    render(<SpeechRail messageId="m1" />)
    expect(screen.queryByTestId('SpeechRail')).toBeNull()
  })

  it('runs the whole height of its message and shows what is said and what is made', () => {
    render(<SpeechRail messageId="m1" />)
    expect(screen.getByTestId('SpeechRail')).toHaveClass('inset-y-0')
    expect(screen.getByTestId('SpeechRail.played')).toHaveStyle({ height: '25%' })
    expect(screen.getByTestId('SpeechRail.loaded')).toHaveStyle({ height: '60%' })
  })

  it('jumps by keyboard along the bar', () => {
    render(<SpeechRail messageId="m1" />)
    const rail = screen.getByTestId('SpeechRail')
    fireEvent.keyDown(rail, { key: 'ArrowDown' })
    fireEvent.keyDown(rail, { key: 'ArrowUp' })
    expect(speaker.skipSpeech.mock.calls).toEqual([[5], [-5]])
  })

  it('jumps to where the bar is let go, not while it is dragged', () => {
    render(<SpeechRail messageId="m1" />)
    const rail = screen.getByTestId('SpeechRail')
    rail.getBoundingClientRect = () => ({ top: 100, height: 200 }) as DOMRect

    fireEvent.pointerDown(rail, { clientY: 100 })
    fireEvent.pointerMove(rail, { clientY: 200 })
    expect(speaker.seekSpeech).not.toHaveBeenCalled()
    expect(screen.getByTestId('SpeechRail.played')).toHaveStyle({ height: '50%' })

    fireEvent.pointerUp(rail, { clientY: 250 })
    expect(speaker.seekSpeech).toHaveBeenCalledWith(75)
  })
})

describe('SpeakButton controls', () => {
  it('has no player controls while its message is not being read', () => {
    speaker.state.key = null
    render(<SpeakButton messageId="m1" text="Hello there." />)
    expect(screen.queryByTestId('MessageBubble.speak.player')).toBeNull()
  })

  it('shows the time and pauses, then offers to keep reading', () => {
    render(<SpeakButton messageId="m1" text="Hello there." />)
    expect(screen.getByTestId('MessageBubble.speak.time')).toHaveTextContent('0:25 / 1:40')
    fireEvent.click(screen.getByTestId('MessageBubble.speak.pause'))
    expect(speaker.pauseSpeech).toHaveBeenCalledTimes(1)

    speaker.state.paused = true
    act(() => speaker.listeners.forEach((listener) => listener()))
    fireEvent.click(screen.getByTestId('MessageBubble.speak.pause'))
    expect(speaker.resumeSpeech).toHaveBeenCalledTimes(1)
  })

  it('backs up and skips ahead ten seconds', () => {
    render(<SpeakButton messageId="m1" text="Hello there." />)
    fireEvent.click(screen.getByTestId('MessageBubble.speak.back'))
    fireEvent.click(screen.getByTestId('MessageBubble.speak.forward'))
    expect(speaker.skipSpeech.mock.calls).toEqual([[-10], [10]])
  })
})
