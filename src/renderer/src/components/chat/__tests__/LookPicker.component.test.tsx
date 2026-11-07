import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ASSIGNABLE_TEXTURES,
  TEXTURE_FOLDERS,
  TEXTURE_KINDS,
  textureCss
} from '../../../lib/app-texture'
import { assignedTexture, resolveLook, useThreadLooks } from '../../../lib/thread-look'
import { THREAD_HUES, threadHue } from '../../../lib/thread-theme'
import { useSessionStore } from '../../../stores/session-store'
import { LookPicker } from '../LookPicker'

const ID = 'chat-a'
const look = () => {
  const { overrides, favorites } = useThreadLooks.getState()
  return resolveLook(ID, overrides, favorites)
}
const openPanel = (): void => {
  fireEvent.click(screen.getByTestId('LookPicker.button'))
}

describe('LookPicker', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useThreadLooks.setState({ overrides: {}, favorites: [] })
    useSessionStore.setState({ activeSessionId: ID })
  })
  afterEach(() => {
    cleanup()
    useSessionStore.setState({ activeSessionId: null })
  })

  it('is just a button until it is opened', () => {
    render(<LookPicker />)
    expect(screen.getByTestId('LookPicker.button')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('LookPicker.panel')).toBeNull()
  })

  it('opens a panel with every texture to pick from, "none" included', () => {
    render(<LookPicker />)
    openPanel()
    const panel = screen.getByTestId('LookPicker.panel')
    expect(panel).toBeInTheDocument()
    for (const kind of TEXTURE_KINDS) {
      expect(within(panel).getByTestId(`LookPicker.texture.${kind}`)).toBeInTheDocument()
    }
    expect(ASSIGNABLE_TEXTURES.length).toBeGreaterThanOrEqual(11)
  })

  it("shows each texture as a preview, drawn in this chat's color", () => {
    render(<LookPicker />)
    openPanel()
    const tile = screen.getByTestId('LookPicker.texture.stars').querySelector('span') as HTMLElement
    // jsdom drops background-image values this long (the stars picture is ~80KB), so the color is checked on the generated CSS.
    const css = textureCss('stars', threadHue(ID))!
    expect(css.image).toContain('data:image/svg+xml')
    expect(decodeURIComponent(css.image)).toContain(`hsl(${threadHue(ID)} `)
    expect(tile).toBeInTheDocument()
  })

  it('marks the texture this chat has now', () => {
    render(<LookPicker />)
    openPanel()
    const own = assignedTexture(ID)
    expect(screen.getByTestId(`LookPicker.texture.${own}`)).toHaveAttribute('aria-pressed', 'true')
    const others = TEXTURE_KINDS.filter((k) => k !== own)
    for (const kind of others) {
      expect(screen.getByTestId(`LookPicker.texture.${kind}`)).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    }
  })

  it('a click on a texture gives it to this chat, and the panel stays open to try another', () => {
    render(<LookPicker />)
    openPanel()
    fireEvent.click(screen.getByTestId('LookPicker.texture.rain'))
    expect(look().texture).toBe('rain')
    expect(screen.getByTestId('LookPicker.texture.rain')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByTestId('LookPicker.texture.none'))
    expect(look().texture).toBe('none')
    expect(screen.getByTestId('LookPicker.panel')).toBeInTheDocument()
  })

  it('offers every thread color as a swatch, and marks the current one', () => {
    render(<LookPicker />)
    openPanel()
    for (const hue of THREAD_HUES) {
      expect(screen.getByTestId(`LookPicker.color.${hue}`)).toBeInTheDocument()
    }
    expect(screen.getByTestId(`LookPicker.color.${threadHue(ID)}`)).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('a click on a color gives it to this chat', () => {
    render(<LookPicker />)
    openPanel()
    const other = THREAD_HUES.find((h) => h !== threadHue(ID))!
    fireEvent.click(screen.getByTestId(`LookPicker.color.${other}`))
    expect(look().hue).toBe(other)
    expect(screen.getByTestId(`LookPicker.color.${other}`)).toHaveAttribute('aria-pressed', 'true')
  })

  it('changes only the chat in view', () => {
    render(<LookPicker />)
    openPanel()
    fireEvent.click(screen.getByTestId('LookPicker.texture.grid'))
    expect(Object.keys(useThreadLooks.getState().overrides)).toEqual([ID])
  })

  it('reset is greyed out while the chat looks as it started, and brings that look back', () => {
    render(<LookPicker />)
    openPanel()
    const reset = screen.getByTestId('LookPicker.reset')
    expect(reset).toBeDisabled()

    const start = look()
    fireEvent.click(
      screen.getByTestId(`LookPicker.texture.${start.texture === 'grid' ? 'rain' : 'grid'}`)
    )
    expect(reset).toBeEnabled()
    fireEvent.click(reset)
    expect(look()).toEqual(start)
    expect(reset).toBeDisabled()
  })

  it('closes on the button again', () => {
    render(<LookPicker />)
    openPanel()
    openPanel()
    expect(screen.queryByTestId('LookPicker.panel')).toBeNull()
  })

  it('closes on a click outside it, but not on a click inside', () => {
    render(
      <>
        <div data-testid="elsewhere" />
        <LookPicker />
      </>
    )
    openPanel()
    fireEvent.pointerDown(screen.getByTestId('LookPicker.texture.rain'))
    expect(screen.getByTestId('LookPicker.panel')).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByTestId('elsewhere'))
    expect(screen.queryByTestId('LookPicker.panel')).toBeNull()
  })

  it('closes on Escape, and that Escape goes no further', () => {
    render(<LookPicker />)
    openPanel()
    const later = vi.fn()
    window.addEventListener('keydown', later)
    const press = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    act(() => {
      document.body.dispatchEvent(press)
    })
    window.removeEventListener('keydown', later)
    expect(screen.queryByTestId('LookPicker.panel')).toBeNull()
    expect(press.defaultPrevented).toBe(true)
  })

  it('tells the menu around it when it opens and closes', () => {
    const onOpenChange = vi.fn()
    render(<LookPicker onOpenChange={onOpenChange} />)
    openPanel()
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    openPanel()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('tells the menu it is closed if it goes away while open', () => {
    const onOpenChange = vi.fn()
    const view = render(<LookPicker onOpenChange={onOpenChange} />)
    openPanel()
    view.unmount()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('leaves Enter to the chat, anywhere in the button and the panel', () => {
    render(<LookPicker />)
    expect(screen.getByTestId('LookPicker.button')).toHaveAttribute('data-enter-sends')
    openPanel()
    expect(screen.getByTestId('LookPicker.panel')).toHaveAttribute('data-enter-sends')
  })

  it('does nothing without a chat', () => {
    useSessionStore.setState({ activeSessionId: null })
    render(<LookPicker />)
    expect(screen.getByTestId('LookPicker.button')).toBeDisabled()
  })
  it('puts every real texture in exactly one folder', () => {
    const inFolders = TEXTURE_FOLDERS.flatMap((f) => f.kinds)
    expect([...inFolders].sort()).toEqual([...ASSIGNABLE_TEXTURES].sort())
  })

  it('stars and unstars a texture, and counts the stars on its folder', () => {
    render(<LookPicker />)
    openPanel()
    fireEvent.click(screen.getByTestId('LookPicker.favorite.hearts'))
    expect(useThreadLooks.getState().favorites).toEqual(['hearts'])
    expect(screen.getByTestId('LookPicker.favorite.hearts')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('LookPicker.folder.Holidays')).toHaveTextContent('★ 1')
    fireEvent.click(screen.getByTestId('LookPicker.favorite.hearts'))
    expect(useThreadLooks.getState().favorites).toEqual([])
  })

  it('can star "no texture" too, so new chats may have none', () => {
    render(<LookPicker />)
    openPanel()
    fireEvent.click(screen.getByTestId('LookPicker.favorite.none'))
    expect(useThreadLooks.getState().favorites).toEqual(['none'])
    expect(screen.getByTestId('LookPicker.favorite.none')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByTestId('LookPicker.favorite.none'))
    expect(useThreadLooks.getState().favorites).toEqual([])
  })

  it('starring does not change a texture the person already picked', () => {
    render(<LookPicker />)
    openPanel()
    fireEvent.click(screen.getByTestId('LookPicker.texture.rain'))
    fireEvent.click(screen.getByTestId('LookPicker.favorite.hearts'))
    expect(look().texture).toBe('rain')
  })

  it('clears every star', () => {
    render(<LookPicker />)
    openPanel()
    fireEvent.click(screen.getByTestId('LookPicker.favorite.hearts'))
    fireEvent.click(screen.getByTestId('LookPicker.clearFavorites'))
    expect(useThreadLooks.getState().favorites).toEqual([])
    expect(screen.queryByTestId('LookPicker.clearFavorites')).toBeNull()
  })

  it('hands a chat that was never given a texture only a starred one', () => {
    useThreadLooks.setState({ favorites: ['hearts', 'leaves'] })
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      expect(['hearts', 'leaves']).toContain(assignedTexture(id, ['hearts', 'leaves']))
    }
    expect(look().texture === 'hearts' || look().texture === 'leaves').toBe(true)
  })

  it('keeps the stars across a reload', async () => {
    useThreadLooks.getState().toggleFavorite('eggs')
    vi.resetModules()
    const fresh = await import('../../../lib/thread-look')
    expect(fresh.useThreadLooks.getState().favorites).toEqual(['eggs'])
  })
})
