import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { ASSIGNABLE_TEXTURES, TEXTURE_KINDS, type TextureKind } from './app-texture'
import { hashText, THREAD_COLORS, threadHue } from './thread-theme'

/**
 * How one chat looks: its color and its background texture. A chat that has never been touched
 * gets both from its id, a color and a texture picked as if at random but the same every time,
 * so it keeps them. The look picker in the face menu can set either one for that chat; the
 * change is kept on this device, and a reset goes back to the look the chat was given.
 */
export type ThreadLook = { hue: number; texture: TextureKind }

/**
 * The id the next new chat will be created with. The welcome screen is colored from it, so the
 * chat keeps that color when a project is picked; each chat that takes it gets a fresh one next.
 */
let upcomingChatId = uuid()

export function peekUpcomingChatId(): string {
  return upcomingChatId
}

export function takeUpcomingChatId(): string {
  const taken = upcomingChatId
  upcomingChatId = uuid()
  return taken
}

/** What a person has changed for a chat; anything missing is the chat's own. */
type Override = { hue?: number; texture?: TextureKind }

const STORAGE_KEY = 'claudeui.threadLooks'

const FAVORITES_KEY = 'claudeui.textureFavorites'

const HIDDEN_KEY = 'claudeui.textureHidden'

/**
 * The texture a chat is given, picked from its id. Once any textures are starred, only those are
 * handed out, "no texture" included if it is starred; with nothing starred, every real texture is.
 */
export function assignedTexture(
  sessionId: string | null | undefined,
  favorites: readonly TextureKind[] = [],
  hidden: readonly TextureKind[] = []
): TextureKind {
  const starred = TEXTURE_KINDS.filter((kind) => favorites.includes(kind))
  const visible = ASSIGNABLE_TEXTURES.filter((kind) => !hidden.includes(kind))
  const pool = starred.length ? starred : visible.length ? visible : ASSIGNABLE_TEXTURES
  if (!sessionId) return starred.length ? pool[0] : 'stars'
  return pool[hashText(`${sessionId}:texture`) % pool.length]
}

export function resolveLook(
  sessionId: string | null | undefined,
  overrides: Readonly<Record<string, Override>>,
  favorites: readonly TextureKind[] = [],
  hidden: readonly TextureKind[] = []
): ThreadLook {
  const own = sessionId ? overrides[sessionId] : undefined
  return {
    hue: own?.hue ?? threadHue(sessionId),
    texture: own?.texture ?? assignedTexture(sessionId, favorites, hidden)
  }
}

function read(): Record<string, Override> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (!parsed || typeof parsed !== 'object') return {}
    const clean: Record<string, Override> = {}
    for (const [id, value] of Object.entries(parsed as Record<string, Override>)) {
      const hue = typeof value?.hue === 'number' ? value.hue : undefined
      const texture = TEXTURE_KINDS.find((kind) => kind === value?.texture)
      if (hue !== undefined || texture) clean[id] = { hue, texture }
    }
    return clean
  } catch {
    return {}
  }
}

function readFavorites(): TextureKind[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]')
    return Array.isArray(parsed) ? TEXTURE_KINDS.filter((kind) => parsed.includes(kind)) : []
  } catch {
    return []
  }
}

function readHidden(): TextureKind[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(HIDDEN_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? TEXTURE_KINDS.filter((kind) => kind !== 'none' && parsed.includes(kind))
      : []
  } catch {
    return []
  }
}

function writeHidden(hidden: readonly TextureKind[]): void {
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden))
  } catch {
    // Private mode: the deletions just will not be remembered.
  }
}

function writeFavorites(favorites: readonly TextureKind[]): void {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  } catch {
    // Private mode: the stars just will not be remembered.
  }
}

function write(overrides: Record<string, Override>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    // Private mode: the choice just will not be remembered.
  }
}

type ThreadLooksState = {
  overrides: Readonly<Record<string, Override>>
  /** The starred textures, in menu order. Chats that were never given one pick only from these. */
  favorites: readonly TextureKind[]
  /** Star or unstar a texture. Chats whose texture was chosen by hand keep it. */
  toggleFavorite: (texture: TextureKind) => void
  /** Textures the person deleted: gone from the picker and never handed out to new chats. */
  hidden: readonly TextureKind[]
  /** Delete a texture from the picker. Chats that already use it keep it. */
  hideTexture: (texture: TextureKind) => void
  /** Bring every deleted texture back. */
  restoreHidden: () => void
  /** Unstar everything, so every texture is handed out again. */
  clearFavorites: () => void
  /** Give this chat a texture ("none" included), whatever it had. */
  setTexture: (sessionId: string, texture: TextureKind) => void
  /** Give this chat one of the thread colors, whatever it had. */
  setColor: (sessionId: string, hue: number) => void
  /** A chat that was renamed keeps the look it had under its old id. */
  carry: (oldId: string, newId: string) => void
  /** Back to the look the chat was given. */
  reset: (sessionId: string) => void
}

export const useThreadLooks = create<ThreadLooksState>((set, get) => {
  const change = (sessionId: string, patch: Override): void => {
    const next = { ...get().overrides, [sessionId]: { ...get().overrides[sessionId], ...patch } }
    write(next)
    set({ overrides: next })
  }
  return {
    overrides: read(),
    favorites: readFavorites(),
    hidden: readHidden(),
    hideTexture: (texture) => {
      if (texture === 'none' || !TEXTURE_KINDS.includes(texture)) return
      const hidden = TEXTURE_KINDS.filter((k) => k === texture || get().hidden.includes(k))
      const favorites = get().favorites.filter((k) => k !== texture)
      writeHidden(hidden)
      writeFavorites(favorites)
      set({ hidden, favorites })
    },
    restoreHidden: () => {
      writeHidden([])
      set({ hidden: [] })
    },
    toggleFavorite: (texture) => {
      if (!TEXTURE_KINDS.includes(texture)) return
      const current = get().favorites
      const next = TEXTURE_KINDS.filter((kind) =>
        kind === texture ? !current.includes(kind) : current.includes(kind)
      )
      writeFavorites(next)
      set({ favorites: next })
    },
    clearFavorites: () => {
      writeFavorites([])
      set({ favorites: [] })
    },
    setTexture: (sessionId, texture) => {
      if (TEXTURE_KINDS.includes(texture)) change(sessionId, { texture })
    },
    setColor: (sessionId, hue) => {
      if (THREAD_COLORS.includes(hue)) change(sessionId, { hue })
    },
    carry: (oldId, newId) => {
      if (oldId === newId) return
      const { hue, texture } = resolveLook(oldId, get().overrides, get().favorites, get().hidden)
      change(newId, { hue, texture })
    },
    reset: (sessionId) => {
      if (!get().overrides[sessionId]) return
      const next = { ...get().overrides }
      delete next[sessionId]
      write(next)
      set({ overrides: next })
    }
  }
})
