import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { textureCss } from '../app-texture'
import { assignedTexture, peekUpcomingChatId, takeUpcomingChatId, useThreadLooks } from '../thread-look'
import { threadAccent, threadHue } from '../thread-theme'
import { useThreadTheme } from '../use-thread-theme'

const root = (): CSSStyleDeclaration => document.documentElement.style
const clear = (): void => {
  for (const name of [...root()]) root().removeProperty(name)
}

describe('useThreadTheme', () => {
  afterEach(clear)

  it('colors the window for the thread in the dark theme', () => {
    renderHook(() => useThreadTheme('thread-a', 'dark'))
    const hue = threadHue('thread-a')
    expect(root().getPropertyValue('--thread-color')).toBe(threadAccent(hue))
    expect(root().getPropertyValue('--color-bg-primary')).toBe(`hsl(${hue} 68% 9%)`)
  })

  it('changes color when another thread comes into view', () => {
    const view = renderHook(({ id }) => useThreadTheme(id, 'dark'), {
      initialProps: { id: 'thread-a' }
    })
    const first = root().getPropertyValue('--color-bg-primary')
    // Find a thread whose hue differs, whatever the hash happens to give.
    let other = 'thread-b'
    for (let i = 0; threadHue(other) === threadHue('thread-a'); i++) other = `thread-${i}`
    view.rerender({ id: other })
    expect(root().getPropertyValue('--color-bg-primary')).not.toBe(first)
  })

  it('in another theme only the accent follows the thread; that theme keeps its backgrounds', () => {
    renderHook(() => useThreadTheme('thread-a', 'dark'))
    renderHook(() => useThreadTheme('thread-a', 'light'))
    expect(root().getPropertyValue('--thread-color')).not.toBe('')
    expect(root().getPropertyValue('--color-bg-primary')).toBe('')
  })

  it('with no thread yet, shows the color the next chat will be created with', () => {
    renderHook(() => useThreadTheme(null, 'dark'))
    expect(root().getPropertyValue('--thread-color')).toBe(
      threadAccent(threadHue(peekUpcomingChatId()))
    )
  })

  it('keeps one color from the welcome screen, through picking a project, to the first reply', () => {
    const welcome = renderHook(() => useThreadTheme(null, 'dark'))
    const shown = root().getPropertyValue('--thread-color')
    welcome.unmount()
    const chatId = takeUpcomingChatId()
    renderHook(() => useThreadTheme(chatId, 'dark'))
    expect(root().getPropertyValue('--thread-color')).toBe(shown)
    useThreadLooks.getState().carry(chatId, 'engine-session-id')
    renderHook(() => useThreadTheme('engine-session-id', 'dark'))
    expect(root().getPropertyValue('--thread-color')).toBe(shown)
  })
})

describe('useThreadTheme — color and texture of a chat', () => {
  const image = (): string => document.documentElement.style.getPropertyValue('--app-texture')
  const size = (): string => document.documentElement.style.getPropertyValue('--app-texture-size')

  beforeEach(() => useThreadLooks.setState({ overrides: {} }))
  afterEach(() => {
    for (const name of [...document.documentElement.style]) {
      document.documentElement.style.removeProperty(name)
    }
    useThreadLooks.setState({ overrides: {} })
  })

  it('gives the dark theme the texture the chat was given', () => {
    renderHook(() => useThreadTheme('thread-a', 'dark'))
    const css = textureCss(assignedTexture('thread-a'), threadHue('thread-a'))!
    expect(image()).toBe(css.image)
    expect(size()).toBe(css.size)
  })

  it('different chats get different textures', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const view = renderHook(() => useThreadTheme(`thread-${i}`, 'dark'))
      seen.add(size() + image().length)
      view.unmount()
    }
    expect(seen.size).toBeGreaterThan(3)
  })

  it('a texture the person picked replaces it', () => {
    useThreadLooks.setState({ overrides: { 'thread-a': { texture: 'rain' } } })
    renderHook(() => useThreadTheme('thread-a', 'dark'))
    expect(size()).toBe(textureCss('rain', threadHue('thread-a'))!.size)
  })

  it('"none" removes the texture', () => {
    useThreadLooks.setState({ overrides: { 'thread-a': { texture: 'none' } } })
    renderHook(() => useThreadTheme('thread-a', 'dark'))
    expect(image()).toBe('')
  })

  it('changing the texture or color while the chat is open takes effect at once', () => {
    renderHook(() => useThreadTheme('thread-a', 'dark'))
    const before = {
      image: image(),
      accent: document.documentElement.style.getPropertyValue('--thread-color')
    }
    act(() =>
      useThreadLooks.getState().setColor('thread-a', threadHue('thread-a') === 300 ? 225 : 300)
    )
    expect(document.documentElement.style.getPropertyValue('--thread-color')).not.toBe(
      before.accent
    )
    expect(image()).not.toBe(before.image)
    act(() => useThreadLooks.getState().setTexture('thread-a', 'zigzag'))
    expect(image()).not.toBe(before.image)
  })

  it('a color the person picked tints the background too', () => {
    useThreadLooks.setState({ overrides: { 'thread-a': { hue: 300 } } })
    renderHook(() => useThreadTheme('thread-a', 'dark'))
    expect(document.documentElement.style.getPropertyValue('--color-bg-primary')).toBe(
      'hsl(300 68% 9%)'
    )
  })

  it('leaves the light and monokai themes plain', () => {
    renderHook(() => useThreadTheme('thread-a', 'light'))
    expect(image()).toBe('')
  })
})
