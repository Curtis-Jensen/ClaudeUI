import type { DirectoryGroup } from '../../../shared/types'

/** The project with the newest session activity. Linked worktrees are skipped: they are throwaway. */
export function mostRecentProject(directories: readonly DirectoryGroup[]): DirectoryGroup | null {
  let best: DirectoryGroup | null = null
  let bestAt = -1
  for (const group of directories) {
    if (group.linkedWorktree) continue
    for (const s of group.sessions) {
      if (s.lastActivityAt > bestAt) {
        bestAt = s.lastActivityAt
        best = group
      }
    }
  }
  return best
}
