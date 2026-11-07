/**
 * Each chat row is filled with its chat's color, the same one the face, the window border and
 * the background use, so you can tell the chats apart in the sidebar at a glance. The text on it
 * is a very dark shade of the same hue so it stays readable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { SessionInfo } from '../../../../../shared/types'
import { useThreadLooks } from '../../../lib/thread-look'
import { THREAD_HUES, threadAccent, threadHue, threadRowStyle } from '../../../lib/thread-theme'
import { SessionItem } from '../SessionItem'

const chat = (sessionId: string): SessionInfo => ({
  sessionId,
  cwd: '/d/WorkPlace/demo',
  projectKey: '-d-workplace-demo',
  title: `Chat ${sessionId}`,
  timestamp: 0,
  lastActivityAt: 0
})

const row = (): HTMLElement => screen.getByTestId('SessionItem')
/** What the browser makes of a color, for comparing with what the row ended up with. */
const asCss = (color: string): string => {
  const probe = document.createElement('span')
  probe.style.background = color
  return probe.style.background
}

beforeEach(() => {
  window.localStorage.clear()
  useThreadLooks.setState({ overrides: {} })
})
afterEach(cleanup)

describe('SessionItem thread color', () => {
  it("fills the whole row with the chat's own color", () => {
    render(<SessionItem info={chat('chat-a')} active={false} onClick={() => {}} />)
    expect(row().style.background).toBe(
      asCss(threadRowStyle(threadHue('chat-a'), false).background)
    )
    expect(row().getAttribute('data-thread-color')).toBe(threadAccent(threadHue('chat-a')))
  })

  it('has no stripe any more: the row itself is the color', () => {
    render(<SessionItem info={chat('chat-a')} active={false} onClick={() => {}} />)
    expect(screen.queryByTestId('SessionItem.color')).toBeNull()
  })

  it('sets the text colors for the row, white', () => {
    render(<SessionItem info={chat('chat-a')} active={false} onClick={() => {}} />)
    expect(row().style.getPropertyValue('--color-text-primary')).toBe('#ffffff')
    expect(row().style.getPropertyValue('--color-text-secondary')).toBe('#ffffff')
    expect(row().style.getPropertyValue('--color-text-muted')).toBe('rgba(255, 255, 255, 0.7)')
  })

  it('differs from chat to chat', () => {
    const colors = new Set<string | null>()
    for (let i = 0; i < 40; i++) {
      const view = render(
        <SessionItem info={chat(`chat-${i}-z${i * 5}`)} active={false} onClick={() => {}} />
      )
      colors.add(screen.getByTestId('SessionItem').getAttribute('data-thread-color'))
      view.unmount()
    }
    expect(colors.size).toBeGreaterThanOrEqual(6)
  })

  it('follows a color the person picked for the chat, at once', () => {
    render(<SessionItem info={chat('chat-a')} active={false} onClick={() => {}} />)
    const picked = THREAD_HUES.find((h) => h !== threadHue('chat-a'))!
    act(() => useThreadLooks.getState().setColor('chat-a', picked))
    expect(row().getAttribute('data-thread-color')).toBe(threadAccent(picked))
    expect(row().style.background).toBe(asCss(threadRowStyle(picked, false).background))
  })

  it("another chat's change does not touch this row", () => {
    render(<SessionItem info={chat('chat-a')} active={false} onClick={() => {}} />)
    const before = row().getAttribute('data-thread-color')
    act(() => useThreadLooks.getState().setColor('chat-b', 300))
    expect(row().getAttribute('data-thread-color')).toBe(before)
  })

  it('the chat that is open is a touch brighter and popped out', () => {
    const { rerender } = render(
      <SessionItem info={chat('chat-a')} active={false} onClick={() => {}} />
    )
    const idle = row().style.background
    expect(row().className).not.toContain('scale-[1.03]')
    rerender(<SessionItem info={chat('chat-a')} active onClick={() => {}} />)
    expect(row().style.background).not.toBe(idle)
    expect(row().className).toContain('scale-[1.03]')
  })

  it('a click on the row still opens the chat', () => {
    let opened = 0
    render(<SessionItem info={chat('chat-a')} active={false} onClick={() => (opened += 1)} />)
    row().click()
    expect(opened).toBe(1)
  })
})

describe('threadRowStyle', () => {
  it('keeps the text white and the fill dark, whatever the hue', () => {
    const lightness = (value: string): number => Number(/ (\d+)%\)$/.exec(value)?.[1])
    for (const hue of THREAD_HUES) {
      const style = threadRowStyle(hue, true)
      expect(lightness(style.background)).toBeLessThanOrEqual(35)
      expect(style['--color-text-primary']).toBe('#ffffff')
      expect(style['--color-text-secondary']).toBe('#ffffff')
    }
  })

  it('is brighter for the open chat', () => {
    const lightness = (value: string): number => Number(/ (\d+)%\)$/.exec(value)?.[1])
    expect(lightness(threadRowStyle(27, true).background)).toBeGreaterThan(
      lightness(threadRowStyle(27, false).background)
    )
  })
})
