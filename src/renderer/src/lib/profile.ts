import { useEffect } from 'react'
import { create } from 'zustand'
import type { ProfileId } from '../../../shared/profile'

/**
 * Whose profile is active: the owner's, or the kid's sandboxed one. Main keeps the truth (it is
 * what enforces the kid profile); this mirrors it for the sidebar. Only the desktop window can
 * switch; the web client has no such call and stays on the owner's profile.
 */
type ProfileState = {
  profile: ProfileId
  /** The kid's sandbox folder, or '' until main has answered. */
  sandboxDir: string
  /** The Chat tab's folder, or '' until main has answered. */
  chatDir: string
  refresh: () => Promise<void>
  switchTo: (profile: ProfileId) => Promise<void>
}

export const useProfile = create<ProfileState>((set) => ({
  profile: 'curtis',
  sandboxDir: '',
  chatDir: '',
  refresh: async () => {
    const read = window.api?.getProfile
    if (!read) return
    try {
      set(await read())
    } catch {
      // Stays as it was.
    }
  },
  switchTo: async (profile) => {
    const write = window.api?.setProfile
    if (!write) return
    set(await write(profile))
  }
}))

/** Loads the profile once when the sidebar mounts. */
export function useProfileRefresh(): void {
  const refresh = useProfile((s) => s.refresh)
  useEffect(() => {
    void refresh()
  }, [refresh])
}

export type AppMode = 'chat' | 'code'

const MODE_KEY = 'claudeui.appMode'

function readMode(): AppMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'chat' ? 'chat' : 'code'
  } catch {
    return 'code'
  }
}

/** The sidebar's Chat / Code toggle: Chat lists only the plain conversations, Code only projects. */
export const useAppMode = create<{ mode: AppMode; setMode: (m: AppMode) => void }>((set) => ({
  mode: readMode(),
  setMode: (mode) => {
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      // The choice just isn't remembered.
    }
    set({ mode })
  }
}))
