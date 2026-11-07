import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sounds = vi.hoisted(() => ({
  isTypingSoundsEnabled: vi.fn(() => true),
  playTypingBurst: vi.fn(),
  stopTypingSounds: vi.fn()
}))
vi.mock('../typing-sounds', () => sounds)
vi.mock('../kokoro-speaker', () => ({ isSpeechPlaying: () => false }))

import { useTypingSounds } from '../use-typing-sounds'

describe('useTypingSounds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sounds.isTypingSoundsEnabled.mockReturnValue(true)
  })

  it('plays one burst when a turn starts, and not again while it runs', () => {
    const view = renderHook(({ running }) => useTypingSounds(running), {
      initialProps: { running: false }
    })
    expect(sounds.playTypingBurst).not.toHaveBeenCalled()

    view.rerender({ running: true })
    view.rerender({ running: true })
    expect(sounds.playTypingBurst).toHaveBeenCalledTimes(1)
  })

  it('plays again at the start of the next turn', () => {
    const view = renderHook(({ running }) => useTypingSounds(running), {
      initialProps: { running: false }
    })
    view.rerender({ running: true })
    view.rerender({ running: false })
    view.rerender({ running: true })
    expect(sounds.playTypingBurst).toHaveBeenCalledTimes(2)
  })

  it('stays silent when the person turned typing sounds off', () => {
    sounds.isTypingSoundsEnabled.mockReturnValue(false)
    renderHook(() => useTypingSounds(true))
    expect(sounds.playTypingBurst).not.toHaveBeenCalled()
  })

  it('cuts the burst short if the chat goes away', () => {
    const view = renderHook(() => useTypingSounds(true))
    view.unmount()
    expect(sounds.stopTypingSounds).toHaveBeenCalledTimes(1)
  })
})
