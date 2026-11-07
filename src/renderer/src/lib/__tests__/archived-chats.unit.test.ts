import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useArchivedChats } from '../archived-chats'

const reset = (): void => {
  window.localStorage.clear()
  useArchivedChats.setState({ ids: new Set(), show: true })
}

describe('archived chats', () => {
  beforeEach(() => {
    reset()
    delete (window as unknown as { api?: unknown }).api
  })

  it('lists archived chats unless switched off: what the sidebar always did', () => {
    expect(useArchivedChats.getState().show).toBe(true)
  })

  it('a toggle switches between listing and hiding them, and remembers the choice', () => {
    useArchivedChats.getState().toggle()
    expect(useArchivedChats.getState().show).toBe(false)
    expect(window.localStorage.getItem('claudeui.showArchivedChats')).toBe('0')

    useArchivedChats.getState().toggle()
    expect(useArchivedChats.getState().show).toBe(true)
    expect(window.localStorage.getItem('claudeui.showArchivedChats')).toBe('1')
  })

  it('reads the archived ids from the desktop app', async () => {
    ;(window as unknown as { api: unknown }).api = {
      desktopArchivedIds: vi.fn().mockResolvedValue(['aaa', 'bbb'])
    }
    await useArchivedChats.getState().refresh()
    expect([...useArchivedChats.getState().ids].sort()).toEqual(['aaa', 'bbb'])
  })

  it('does not replace the list when nothing changed', async () => {
    ;(window as unknown as { api: unknown }).api = {
      desktopArchivedIds: vi.fn().mockResolvedValue(['aaa'])
    }
    await useArchivedChats.getState().refresh()
    const first = useArchivedChats.getState().ids
    await useArchivedChats.getState().refresh()
    expect(useArchivedChats.getState().ids).toBe(first)
  })

  it('does nothing where the call does not exist, as in the web client', async () => {
    ;(window as unknown as { api: unknown }).api = {}
    await expect(useArchivedChats.getState().refresh()).resolves.toBeUndefined()
    expect(useArchivedChats.getState().ids.size).toBe(0)
  })

  it('keeps the old list when reading fails', async () => {
    useArchivedChats.setState({ ids: new Set(['kept']) })
    ;(window as unknown as { api: unknown }).api = {
      desktopArchivedIds: vi.fn().mockRejectedValue(new Error('gone'))
    }
    await useArchivedChats.getState().refresh()
    expect([...useArchivedChats.getState().ids]).toEqual(['kept'])
  })

  it('takes a fresh look when hiding, so a chat archived a moment ago goes too', async () => {
    const read = vi.fn().mockResolvedValue(['new'])
    ;(window as unknown as { api: unknown }).api = { desktopArchivedIds: read }
    useArchivedChats.getState().toggle() // now hiding
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1))
    expect([...useArchivedChats.getState().ids]).toEqual(['new'])
  })
})
