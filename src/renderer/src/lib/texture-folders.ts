import { create } from 'zustand'
import { ASSIGNABLE_TEXTURES, TEXTURE_FOLDERS, type TextureKind } from './app-texture'

/**
 * The folders the look picker groups backgrounds into. The layout starts as the one in
 * app-texture.ts, and the person can rename folders, add and delete them, and move a background
 * from one folder to another. Their layout is kept on this device.
 */
export type TextureFolder = { name: string; kinds: TextureKind[] }

const STORAGE_KEY = 'claudeui.textureFolders'

const defaultFolders = (): TextureFolder[] =>
  TEXTURE_FOLDERS.map((folder) => ({ name: folder.name, kinds: [...folder.kinds] }))

/**
 * Makes a stored layout safe to use: drops folders with no usable name or a name already taken,
 * keeps each texture in one folder only, and puts any texture that is in no folder back in the
 * folder the built-in layout gave it (or the first folder). So a texture added to the code later
 * still shows up, and a stored layout can never lose one.
 */
export function reconcileFolders(stored: unknown): TextureFolder[] {
  const folders: TextureFolder[] = []
  const placed = new Set<TextureKind>()
  if (Array.isArray(stored)) {
    for (const entry of stored) {
      if (!entry || typeof entry !== 'object') continue
      const { name, kinds } = entry as { name?: unknown; kinds?: unknown }
      if (typeof name !== 'string' || !name.trim() || !Array.isArray(kinds)) continue
      const clean = name.trim()
      if (folders.some((folder) => folder.name === clean)) continue
      const own: TextureKind[] = []
      for (const kind of kinds) {
        if (!ASSIGNABLE_TEXTURES.includes(kind) || placed.has(kind)) continue
        placed.add(kind)
        own.push(kind)
      }
      folders.push({ name: clean, kinds: own })
    }
  }
  // Nothing usable was stored (a first run, say): start from the shipped folders, empty, so that
  // every texture goes back to its own folder below.
  if (!folders.length) {
    folders.push(...TEXTURE_FOLDERS.map((folder) => ({ name: folder.name, kinds: [] })))
  }
  for (const kind of ASSIGNABLE_TEXTURES) {
    if (placed.has(kind)) continue
    const home = TEXTURE_FOLDERS.find((folder) => folder.kinds.includes(kind))?.name
    const target = folders.find((folder) => folder.name === home) ?? folders[0]
    if (target) target.kinds.push(kind)
    else folders.push({ name: 'Backgrounds', kinds: [kind] })
    placed.add(kind)
  }
  return folders
}

function read(): TextureFolder[] {
  try {
    return reconcileFolders(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return reconcileFolders(null)
  }
}

function write(folders: TextureFolder[] | null): void {
  try {
    if (folders) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(folders))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private mode: the layout just will not be remembered.
  }
}

type TextureFoldersState = {
  folders: readonly TextureFolder[]
  /** Give a folder a new name. Ignored if the name is empty or already used. */
  renameFolder: (from: string, to: string) => void
  /** Add an empty folder. Ignored if the name is empty or already used. */
  addFolder: (name: string) => void
  /** Delete a folder; its backgrounds move to the first folder that is left. */
  deleteFolder: (name: string) => void
  /** Move a background into a folder, out of whichever folder it was in. */
  moveTexture: (kind: TextureKind, to: string) => void
  /** Back to the layout the app ships with. */
  resetFolders: () => void
}

export const useTextureFolders = create<TextureFoldersState>((set, get) => {
  const commit = (folders: TextureFolder[]): void => {
    write(folders)
    set({ folders })
  }
  return {
    folders: read(),
    renameFolder: (from, to) => {
      const name = to.trim()
      const folders = get().folders
      if (!name || (name !== from && folders.some((folder) => folder.name === name))) return
      commit(folders.map((folder) => (folder.name === from ? { ...folder, name } : folder)))
    },
    addFolder: (name) => {
      const clean = name.trim()
      const folders = get().folders
      if (!clean || folders.some((folder) => folder.name === clean)) return
      commit([...folders, { name: clean, kinds: [] }])
    },
    deleteFolder: (name) => {
      const folders = get().folders
      const rest = folders.filter((folder) => folder.name !== name)
      if (rest.length === folders.length || !rest.length) return
      const orphans = folders.find((folder) => folder.name === name)?.kinds ?? []
      commit(
        rest.map((folder, i) =>
          i === 0 ? { ...folder, kinds: [...folder.kinds, ...orphans] } : folder
        )
      )
    },
    moveTexture: (kind, to) => {
      const folders = get().folders
      if (!folders.some((folder) => folder.name === to)) return
      commit(
        folders.map((folder) => ({
          ...folder,
          kinds:
            folder.name === to
              ? [...folder.kinds.filter((k) => k !== kind), kind]
              : folder.kinds.filter((k) => k !== kind)
        }))
      )
    },
    resetFolders: () => {
      write(null)
      set({ folders: defaultFolders() })
    }
  }
})
