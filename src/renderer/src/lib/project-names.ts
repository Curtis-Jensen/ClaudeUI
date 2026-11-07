/**
 * Display names the user gave projects in the sidebar.
 *
 * Per client, never replicated, and never touches the folder on disk: it only
 * changes what this client shows. Keyed by the project's key (or its cwd when it
 * has none) and kept in localStorage like the sidebar's folding; storage that is
 * missing or throws just means the folder names show.
 */
import { useSyncExternalStore } from 'react'

const KEY = 'sidebar.projectNames'

function load(): Readonly<Record<string, string>> {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const names: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v) names[k] = v
    }
    return names
  } catch {
    return {}
  }
}

let names: Readonly<Record<string, string>> = load()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Name a project; an empty name clears it, so the folder name shows again. */
export function setProjectName(key: string, name: string): void {
  const trimmed = name.trim()
  const next = { ...names }
  if (trimmed) next[key] = trimmed
  else delete next[key]
  names = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private window or blocked storage: the name lasts for this page only */
  }
  for (const listener of listeners) listener()
}

export function useProjectNames(): Readonly<Record<string, string>> {
  return useSyncExternalStore(subscribe, () => names)
}

/** Test seam: forget the names and re-read storage. */
export function resetProjectNamesForTests(): void {
  names = load()
  for (const listener of listeners) listener()
}
