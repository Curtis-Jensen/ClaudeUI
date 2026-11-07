/**
 * Which project folders this client has open (expanded) in the sidebar.
 *
 * Per client, never replicated. Kept in localStorage so the open folders survive
 * an app restart and the mobile drawer, which unmounts the sidebar every time it
 * closes; storage that is missing or throws just means everything starts closed.
 */
import { useSyncExternalStore } from 'react'

const KEY = 'sidebar.expandedDirs'

function load(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
    )
  } catch {
    return new Set()
  }
}

let expanded: ReadonlySet<string> = load()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function toggleDirExpanded(projectKey: string): void {
  const next = new Set(expanded)
  if (!next.delete(projectKey)) next.add(projectKey)
  expanded = next
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]))
  } catch {
    /* private window or blocked storage: the open folders last for this page only */
  }
  for (const listener of listeners) listener()
}

/** Open a folder without ever closing it; a no-op when it is already open. */
export function expandDir(projectKey: string): void {
  if (expanded.has(projectKey)) return
  toggleDirExpanded(projectKey)
}

export function useExpandedDirs(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => expanded)
}
