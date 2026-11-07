import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import type { DirectoryGroup, SessionInfo } from '../../../../shared/types'
import { SessionItem } from './SessionItem'
import { useContextMenu } from '../../hooks/useContextMenu'
import { useSessionStore } from '../../stores/session-store'
import { setProjectName, useProjectNames } from '../../lib/project-names'
import {
  SESSION_DRAG_TYPE,
  moveProjectToFolder,
  useProjectFolders
} from '../../lib/project-folders'
import { groupHeadIdOf, groupSessions } from '../../lib/session-links'
import {
  expandParents,
  toggleParentCollapsed,
  useCollapsedParents
} from '../../lib/collapsed-parents'

export const DirectoryItem = memo(function DirectoryItem({
  group,
  expanded,
  activeSessionId,
  onClick,
  onDoubleClick,
  onSessionClick,
  onSessionDoubleClick,
  onToggleWatch,
  onViewWorktrees,
  renamingKey,
  renamePrefix,
  onStartRename,
  onFinishRename,
  onAutoRename,
  onCancelRename,
  onHide,
  onUnhide,
  onDelete,
  hidden,
  hiddenSessionIds,
  showHidden,
  onHideSession,
  onUnhideSession,
  onDeleteSession,
  selecting = false,
  selectedIds,
  onToggleSelected,
  onToggleProject,
  flat = false,
  folders = false
}: {
  group: DirectoryGroup
  expanded: boolean
  activeSessionId: string | null
  onClick: () => void
  onDoubleClick: () => void
  onSessionClick: (info: SessionInfo) => void
  onSessionDoubleClick: (info: SessionInfo) => void
  onToggleWatch: (info: SessionInfo) => void
  onViewWorktrees?: () => void
  renamingKey: string | null
  renamePrefix: string
  onStartRename: (key: string) => void
  onFinishRename: (id: string, title: string) => void
  onAutoRename: (id: string) => void
  onCancelRename: () => void
  /** Hide this project from the sidebar */
  onHide?: () => void
  /** Unhide a previously hidden project */
  onUnhide?: () => void
  /** Permanently delete the project directory */
  onDelete?: () => void
  /** Project is currently hidden — rendered dimmed */
  hidden?: boolean
  /** Hidden session IDs (for per-row styling) */
  hiddenSessionIds?: Set<string>
  /** When true, hidden sessions still render (dimmed) */
  showHidden?: boolean
  onHideSession?: (info: SessionInfo) => void
  onUnhideSession?: (info: SessionInfo) => void
  onDeleteSession?: (info: SessionInfo) => void
  /** Bulk-select mode: rows and the project show checkboxes. */
  selecting?: boolean
  selectedIds?: ReadonlySet<string>
  onToggleSelected?: (sessionId: string) => void
  /** Select, or deselect, every chat the project shows. */
  onToggleProject?: (sessionIds: string[]) => void
  /** No folder header: the chats list directly, ungrouped (the Chat tab, where the folder is an implementation detail). */
  flat?: boolean
  /** Chat tab only: thread rows can be dragged into a sidebar folder, and the menu can file the project. */
  folders?: boolean
}): React.JSX.Element {
  const menu = useContextMenu()
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The user's own name for the project, shown in place of the folder name.
  const projectNames = useProjectNames()
  const nameKey = group.projectKey || group.cwd
  const displayName = projectNames[nameKey] ?? group.folderName
  const projectFolders = useProjectFolders()
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const renameDoneRef = useRef(false)

  // Groups (slices 1b and 5): sessions grouped with the one they were started or
  // handed off from sit one level under that group's head, in start order.
  const sessionLinks = useSessionStore((s) => s.sessionLinks)
  const sessionRefs = useSessionStore((s) => s.sessionRefs)
  const collapsedParents = useCollapsedParents()
  // Opening a session (a card's Open, the continued-in bar, a click elsewhere)
  // unfolds its group, so the active row is never hidden in a fold. Keyed on the
  // head, not the links, so folding it again afterwards sticks.
  const activeHere = group.sessions.some((s) => s.sessionId === activeSessionId)
  const activeHead = useMemo(
    () =>
      activeHere && activeSessionId
        ? groupHeadIdOf({ sessionLinks, sessionRefs }, activeSessionId)
        : null,
    [activeHere, activeSessionId, sessionLinks, sessionRefs]
  )
  useEffect(() => {
    if (activeHead) expandParents([activeHead])
  }, [activeHead])
  const rows = useMemo(
    () =>
      groupSessions(
        group.sessions.filter((info) => showHidden || !hiddenSessionIds?.has(info.sessionId)),
        { sessionLinks, sessionRefs },
        collapsedParents
      ),
    [group.sessions, showHidden, hiddenSessionIds, sessionLinks, sessionRefs, collapsedParents]
  )

  const handleClick = useCallback(() => {
    // Delay single-click to distinguish from double-click
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null
      onClick()
    }, 150)
  }, [onClick])

  const handleDoubleClick = useCallback(() => {
    // Cancel pending single-click so the directory doesn't toggle
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    onDoubleClick()
  }, [onDoubleClick])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    }
  }, [])

  // The chats this project shows right now, for its select-all box.
  const rowIds = rows.map(({ info }) => info.sessionId)
  const pickedCount = rowIds.filter((id) => selectedIds?.has(id)).length
  const allSelected = rowIds.length > 0 && pickedCount === rowIds.length
  const someSelected = pickedCount > 0

  return (
    <div data-testid="DirectoryItem" data-id={group.projectKey || group.cwd}>
      {!flat && (
        <div
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={menu.open}
          style={{ padding: '0 5px' }}
          className={`flex items-center gap-2.5 h-8 rounded-md text-[13px] cursor-default transition-colors text-text-secondary hover:text-text-primary hover:bg-bg-hover ${hidden ? 'opacity-45 italic' : ''}`}
        >
          {selecting && (
            <input
              type="checkbox"
              data-testid="DirectoryItem.checkbox"
              aria-label={`Select every chat in ${displayName}`}
              checked={allSelected}
              disabled={rowIds.length === 0}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected
              }}
              onChange={() => onToggleProject?.(rowIds)}
              // The header folds the project on a click; the box must not.
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="shrink-0 w-[14px] h-[14px] cursor-pointer accent-[color:var(--thread-color,#fb923c)]"
            />
          )}
          <span className="shrink-0 text-text-muted">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
            >
              <path d="M8 5l8 7-8 7z" />
            </svg>
          </span>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-text-muted"
          >
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
          {renaming ? (
            <input
              data-testid="DirectoryItem.renameInput"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  renameDoneRef.current = true
                  setProjectName(nameKey, nameDraft)
                  setRenaming(false)
                } else if (e.key === 'Escape') {
                  renameDoneRef.current = true
                  setRenaming(false)
                }
              }}
              onBlur={() => {
                if (!renameDoneRef.current) setRenaming(false)
              }}
              placeholder={group.folderName}
              className="flex-1 min-w-0 bg-transparent border-b border-accent text-[13px] text-text-primary outline-none placeholder:text-text-muted/50"
            />
          ) : (
            <span className="truncate flex-1" title={group.cwd || group.folderName}>
              {displayName}
            </span>
          )}
          <span className="text-[10px] text-text-muted">{group.sessions.length}</span>
          {/* The right-click menu for touch screens, where iOS never fires a context-menu.
            Not rendered on pointer devices: right-click covers them and the button would
            take row width from every project. */}
          <button
            type="button"
            data-testid="DirectoryItem.menu"
            aria-label="Project menu"
            aria-haspopup="menu"
            aria-expanded={menu.isOpen}
            // The menu's outside-click handler would close it on this mousedown, and the click
            // would then reopen it: stop the mousedown so the click toggles.
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              if (menu.isOpen) {
                menu.close()
                return
              }
              const rect = e.currentTarget.getBoundingClientRect()
              menu.openAt(rect.left, rect.bottom)
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="shrink-0 w-8 h-8 -mr-1 hidden [@media(hover:none)]:flex items-center justify-center rounded text-text-muted cursor-default"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        </div>
      )}
      {(expanded || flat) && (
        <div className={flat ? '' : 'ml-3'}>
          {rows.map(({ info, depth, memberCount, collapsed }) => {
            const sessionHidden = !!hiddenSessionIds?.has(info.sessionId)
            return (
              <SessionItem
                key={info.sessionId}
                info={info}
                depth={depth}
                memberCount={memberCount}
                membersCollapsed={collapsed}
                onToggleMembers={() => toggleParentCollapsed(info.sessionId)}
                draggable={folders}
                onDragStart={
                  folders
                    ? (e) => {
                        e.dataTransfer.setData(SESSION_DRAG_TYPE, info.sessionId)
                        e.dataTransfer.effectAllowed = 'move'
                      }
                    : undefined
                }
                active={info.sessionId === activeSessionId}
                onClick={() => onSessionClick(info)}
                onDoubleClick={() => onSessionDoubleClick(info)}
                onToggleWatch={() => onToggleWatch(info)}
                isRenaming={renamingKey === `${renamePrefix}:${info.sessionId}`}
                onStartRename={() => onStartRename(`${renamePrefix}:${info.sessionId}`)}
                onFinishRename={(title) => onFinishRename(info.sessionId, title)}
                onAutoRename={() => onAutoRename(info.sessionId)}
                onCancelRename={onCancelRename}
                selecting={selecting}
                selected={!!selectedIds?.has(info.sessionId)}
                onToggleSelected={() => onToggleSelected?.(info.sessionId)}
                hidden={sessionHidden}
                onHide={
                  !sessionHidden && onHideSession && info.projectKey
                    ? () => onHideSession(info)
                    : undefined
                }
                onUnhide={
                  sessionHidden && onUnhideSession ? () => onUnhideSession(info) : undefined
                }
                onDelete={
                  onDeleteSession && info.projectKey ? () => onDeleteSession(info) : undefined
                }
              />
            )
          })}
        </div>
      )}

      {/* Context menu */}
      {menu.isOpen && (
        <div
          ref={menu.ref}
          role="menu"
          className="fixed z-50 min-w-[160px] py-1 rounded-lg bg-bg-tertiary border border-border shadow-lg"
          style={menu.style}
        >
          {onViewWorktrees && (
            <button
              role="menuitem"
              onClick={() => {
                menu.close()
                onViewWorktrees()
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors text-left cursor-default"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-text-muted"
              >
                <circle cx="12" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="6" r="3" />
                <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
                <path d="M12 12v3" />
              </svg>
              View worktrees
            </button>
          )}
          <button
            role="menuitem"
            onClick={() => {
              menu.close()
              onDoubleClick()
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors text-left cursor-default"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="shrink-0 text-text-muted"
            >
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" />
            </svg>
            New session here
          </button>
          <button
            role="menuitem"
            data-testid="DirectoryItem.rename"
            onClick={() => {
              menu.close()
              renameDoneRef.current = false
              setNameDraft(projectNames[nameKey] ?? '')
              setRenaming(true)
            }}
            className="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-default"
          >
            Rename project...
          </button>
          {folders && projectFolders.folders.length > 0 && (
            <div role="separator" className="h-px bg-border my-1" />
          )}
          {(folders ? projectFolders.folders : []).map((folder) => {
            const here = projectFolders.assignments[nameKey] === folder.id
            return (
              <button
                key={folder.id}
                role="menuitem"
                data-testid="DirectoryItem.moveToFolder"
                disabled={here}
                onClick={() => {
                  menu.close()
                  moveProjectToFolder(nameKey, folder.id)
                }}
                className="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-default disabled:opacity-40"
              >
                {here ? `In folder: ${folder.name}` : `Move to ${folder.name}`}
              </button>
            )
          })}
          {folders && projectFolders.assignments[nameKey] && (
            <button
              role="menuitem"
              data-testid="DirectoryItem.removeFromFolder"
              onClick={() => {
                menu.close()
                moveProjectToFolder(nameKey, null)
              }}
              className="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-default"
            >
              Remove from folder
            </button>
          )}
          {(onHide || onUnhide || onDelete) && (
            <div role="separator" className="h-px bg-border my-1" />
          )}
          {onHide && !hidden && (
            <button
              role="menuitem"
              onClick={() => {
                menu.close()
                onHide()
              }}
              className="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-default"
            >
              Hide project
            </button>
          )}
          {onUnhide && hidden && (
            <button
              role="menuitem"
              onClick={() => {
                menu.close()
                onUnhide()
              }}
              className="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-default"
            >
              Unhide project
            </button>
          )}
          {onDelete && (
            <button
              role="menuitem"
              data-testid="DirectoryItem.delete"
              onClick={() => {
                menu.close()
                onDelete()
              }}
              className="w-full text-left px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-colors cursor-default"
            >
              Delete project...
            </button>
          )}
        </div>
      )}
    </div>
  )
})
