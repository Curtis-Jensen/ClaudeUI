/**
 * Folders the user made in the sidebar to tuck projects away in.
 *
 * Per client, never replicated, and purely a view: a folder never touches the
 * project on disk or the chats in it, and nothing here reaches a model, so
 * filing a project costs no tokens. Kept in localStorage like the sidebar's
 * folding; storage that is missing or throws just means no folders show.
 *
 * Folders are flat (no folders in folders). A project, or a single thread, is in
 * at most one. Projects are keyed by the project's key (or its cwd when it has
 * none), like project names; threads by session id.
 */
import { useSyncExternalStore } from 'react'

const KEY = 'sidebar.projectFolders'

/** dataTransfer type a thread row carries while it is dragged toward a folder. */
export const SESSION_DRAG_TYPE = 'application/x-claudeui-session'

export interface ProjectFolder {
  id: string
  name: string
  /** Folders start folded: they exist to get projects out of the way. */
  open: boolean
}

export interface ProjectFolders {
  folders: readonly ProjectFolder[]
  /** project key → folder id */
  assignments: Readonly<Record<string, string>>
  /** session id → folder id, for a thread filed on its own */
  sessionAssignments: Readonly<Record<string, string>>
}

const EMPTY: ProjectFolders = { folders: [], assignments: {}, sessionAssignments: {} }

function cleanAssignmentMap(raw: unknown, ids: ReadonlySet<string>): Record<string, string> {
  const out: Record<string, string> = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, folderId] of Object.entries(raw)) {
      if (typeof folderId === 'string' && ids.has(folderId)) out[key] = folderId
    }
  }
  return out
}

function load(): ProjectFolders {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return EMPTY
    const { folders, assignments, sessionAssignments } = parsed as Partial<Record<string, unknown>>
    const cleanFolders: ProjectFolder[] = []
    if (Array.isArray(folders)) {
      for (const f of folders) {
        if (f && typeof f.id === 'string' && typeof f.name === 'string' && f.name) {
          cleanFolders.push({ id: f.id, name: f.name, open: f.open === true })
        }
      }
    }
    const ids = new Set(cleanFolders.map((f) => f.id))
    return {
      folders: cleanFolders,
      assignments: cleanAssignmentMap(assignments, ids),
      sessionAssignments: cleanAssignmentMap(sessionAssignments, ids)
    }
  } catch {
    return EMPTY
  }
}

let state: ProjectFolders = load()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function commit(next: ProjectFolders): void {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private window or blocked storage: the folders last for this page only */
  }
  for (const listener of listeners) listener()
}

/** Make a folder; returns its id, or null for a blank name. */
export function createProjectFolder(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const id = `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  commit({ ...state, folders: [...state.folders, { id, name: trimmed, open: true }] })
  return id
}

export function renameProjectFolder(id: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  commit({
    ...state,
    folders: state.folders.map((f) => (f.id === id ? { ...f, name: trimmed } : f))
  })
}

/** Remove a folder; the projects and threads in it go back to the main list, none are deleted. */
export function deleteProjectFolder(id: string): void {
  const without = (map: Readonly<Record<string, string>>): Record<string, string> =>
    Object.fromEntries(Object.entries(map).filter(([, folderId]) => folderId !== id))
  commit({
    folders: state.folders.filter((f) => f.id !== id),
    assignments: without(state.assignments),
    sessionAssignments: without(state.sessionAssignments)
  })
}

export function toggleProjectFolderOpen(id: string): void {
  commit({
    ...state,
    folders: state.folders.map((f) => (f.id === id ? { ...f, open: !f.open } : f))
  })
}

/** File a project in a folder, or pass null to bring it back to the main list. */
export function moveProjectToFolder(projectKey: string, folderId: string | null): void {
  const assignments = { ...state.assignments }
  if (folderId && state.folders.some((f) => f.id === folderId)) assignments[projectKey] = folderId
  else delete assignments[projectKey]
  commit({ ...state, assignments })
}

/** File one thread in a folder, or pass null to bring it back to its project. */
export function moveSessionToFolder(sessionId: string, folderId: string | null): void {
  const sessionAssignments = { ...state.sessionAssignments }
  if (folderId && state.folders.some((f) => f.id === folderId)) {
    sessionAssignments[sessionId] = folderId
  } else delete sessionAssignments[sessionId]
  commit({ ...state, sessionAssignments })
}

export function useProjectFolders(): ProjectFolders {
  return useSyncExternalStore(subscribe, () => state)
}

/** Test seam: forget the folders and re-read storage. */
export function resetProjectFoldersForTests(): void {
  state = load()
  for (const listener of listeners) listener()
}
