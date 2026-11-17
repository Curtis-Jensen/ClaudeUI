/**
 * Tool calls are not shown in the chat (the owner's choice): only code edits are.
 * A file edit or write always shows; a shell command shows only when it changed
 * files, and then as those files' diffs (see `asChangedFilesView`). Anything else
 * (reads, searches, MCP calls, ...) is hidden. Cards that need the person always
 * show: waiting on their approval, blocked or flagged by the permission judge, or
 * a plan or question asked of them.
 */

import type { FileDiff } from '../../../../../shared/types'
import type { EngineToolMap, ToolKind, ToolView } from '../../../../../shared/tool-kinds'

export function isHiddenShellCall(
  toolMap: EngineToolMap,
  toolName: string,
  result: { fileDiffs?: FileDiff[] } | undefined,
  needsPerson: boolean
): boolean {
  const kind = toolMap.kindOf(toolName)
  if (needsPerson) return false
  if (kind === 'fileEdit' || kind === 'fileWrite' || kind === 'plan' || kind === 'question') {
    return false
  }
  if (kind === 'command') return !(result?.fileDiffs && result.fileDiffs.length > 0)
  return true
}

/** A finished command that changed files renders as an edit card of those files. */
export function asChangedFilesView(
  kind: ToolKind,
  view: ToolView
): { kind: ToolKind; view: ToolView } {
  if (kind !== 'command' || view.kind !== 'command' || !view.files?.length) return { kind, view }
  const files: FileDiff[] = view.files
  return {
    kind: 'fileEdit',
    view: {
      kind: 'fileEdit',
      path: files.length === 1 ? files[0].path : `${files.length} files`,
      before: '',
      after: '',
      files
    }
  }
}
