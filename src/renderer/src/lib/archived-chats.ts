import { useEffect } from 'react'
import { create } from 'zustand'

/**
 * Chats the Claude desktop app has archived, and whether the sidebar lists them. Showing them is
 * what the sidebar always did, so it is the default; hiding them leaves only the chats that are
 * not archived. The choice is remembered on this device. ClaudeUI has no archive of its own: the
 * list comes from the desktop app (read-only), so with it absent there is nothing to hide.
 */
const STORAGE_KEY = 'claudeui.showArchivedChats'

function readShow(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

function writeShow(show: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, show ? '1' : '0')
  } catch {
    // Private mode: the choice just will not be remembered.
  }
}

type ArchivedChatsState = {
  /** Transcript ids of the chats the desktop app has archived. */
  ids: ReadonlySet<string>
  /** Whether archived chats are listed in the sidebar. */
  show: boolean
  refresh: () => Promise<void>
  toggle: () => void
}

export const useArchivedChats = create<ArchivedChatsState>((set, get) => ({
  ids: new Set(),
  show: readShow(),
  refresh: async () => {
    // Only the desktop window can read the desktop app's files; the web client has no such call.
    const read = window.api?.desktopArchivedIds
    if (!read) return
    try {
      const next = await read()
      const current = get().ids
      const same = next.length === current.size && next.every((id) => current.has(id))
      if (!same) set({ ids: new Set(next) })
    } catch {
      // The list stays as it was.
    }
  },
  toggle: () => {
    const show = !get().show
    writeShow(show)
    set({ show })
    // Hiding them: take a fresh look first, so a chat archived a moment ago goes too.
    if (!show) void get().refresh()
  }
}))

/** Reads the archived list on start, and again whenever the window is focused. */
export function useArchivedChatsRefresh(): void {
  const refresh = useArchivedChats((s) => s.refresh)
  useEffect(() => {
    void refresh()
    const onFocus = (): void => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])
}
