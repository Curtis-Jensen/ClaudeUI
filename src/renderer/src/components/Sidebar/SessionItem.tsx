import { useState, useEffect, useRef, memo } from 'react'
import { useSessionStore } from '../../stores/session-store'
import { useThreadLooks } from '../../lib/thread-look'
import { threadAccent, threadHue, threadRowStyle } from '../../lib/thread-theme'
import { useShallow } from 'zustand/react/shallow'
import type { ChatMessage, SessionInfo } from '../../../../shared/types'
import { PermissionsDialog } from '../PermissionsDialog'
import { useContextMenu } from '../../hooks/useContextMenu'
import { countDotTasks } from '../../lib/task-types'
import { deriveSessionDotState } from './StatusDot'
import { originLinkOf, sessionTitleOf } from '../../lib/session-links'
import { useIsMobile } from '../../hooks/useIsMobile'
import { linkedWorktreeFor } from '../../../../shared/linked-worktree'
import { useBranchPr } from '../../lib/branch-pr-state'
import { BranchPrIcon } from './BranchPrIcon'

function lastMessageIsReply(messages: ChatMessage[] | undefined): boolean {
  const last = messages?.[messages.length - 1]
  return (
    last?.role === 'assistant' &&
    last.content.some((b) => b.type === 'text' && b.text.trim().length > 0)
  )
}

export const SessionItem = memo(function SessionItem({
  info,
  active,
  onClick,
  onDoubleClick,
  onPin,
  onUnpin,
  onRemove,
  isRenaming,
  onStartRename,
  onFinishRename,
  onCancelRename,
  onAutoRename,
  onHide,
  onUnhide,
  onDelete,
  hidden,
  draggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  depth = 0,
  memberCount = 0,
  membersCollapsed = false,
  onToggleMembers,
  selecting = false,
  selected = false,
  onToggleSelected
}: {
  info: SessionInfo
  active: boolean
  onClick: () => void
  onDoubleClick?: () => void
  onToggleWatch?: () => void
  onPin?: () => void
  onUnpin?: () => void
  onRemove?: () => void
  isRenaming?: boolean
  onStartRename?: () => void
  onFinishRename?: (title: string) => void
  onCancelRename?: () => void
  onAutoRename?: () => void
  /** Hide this session from the sidebar (persists to config) */
  onHide?: () => void
  /** Restore a previously hidden session */
  onUnhide?: () => void
  /** Permanently delete the session from disk (opens confirm modal upstream) */
  onDelete?: () => void
  /** When true, renders in a dimmed/italic style */
  hidden?: boolean
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  /** 1 for a member drawn under its group's head in the project list, else 0 (slices 1b, 5). */
  depth?: number
  /** Members of the group this row heads, in the same list. */
  memberCount?: number
  membersCollapsed?: boolean
  /** Fold or unfold the group (the toggle shows only on a head with members). */
  onToggleMembers?: () => void
  /** Bulk-select mode: the row shows a checkbox and a click picks it instead of opening it. */
  selecting?: boolean
  selected?: boolean
  onToggleSelected?: () => void
}): React.JSX.Element {
  // The chat's color, the one its face, window border and background use: its own, unless the
  // person changed it. Only this row's change redraws this row.
  const chosenHue = useThreadLooks((s) => s.overrides[info.sessionId]?.hue)
  const hue = chosenHue ?? threadHue(info.sessionId)
  const rowColors = threadRowStyle(hue, active)

  // Self-subscribe to session status fields — avoids parent needing the full sessions map
  const { isRunning, isSdkActive, isWatching, needsAttention, hasSummary, runningSubagents } =
    useSessionStore(
      useShallow((s) => {
        const sess = s.sessions[info.sessionId]
        return {
          isRunning: sess?.status?.state === 'running',
          isSdkActive: !!sess?.sdkActive,
          isWatching: !!sess?.isWatching,
          needsAttention: !!sess?.needsAttention,
          // A finished reply to review: the thread ends on an assistant message with text, not
          // on the user's own prompt or a tool call mid-turn.
          hasSummary: lastMessageIsReply(sess?.messages),
          // A count, not the record map, so useShallow skips the rows whose tasks didn't change.
          runningSubagents: sess ? countDotTasks(sess.activeTasks, !!sess.sdkActive) : 0
        }
      })
    )
  // A recorded entry (EnterWorktree / session.moved / created here), or the session's cwd being a
  // linked worktree per the directory listing (any engine, any layout). The live session's cwd
  // wins over the listing's, which can lag a brand-new session.
  const isWorktree = useSessionStore(
    (s) =>
      !!s.worktreeInfoMap[info.sessionId] ||
      linkedWorktreeFor(s.directories, s.sessions[info.sessionId]?.cwd || info.cwd) !== null
  )
  const pr = useBranchPr(useSessionStore((s) => s.sessions[info.sessionId]?.cwd || info.cwd))
  // The link to the session that started this one, when there is one (slices 1b, 5):
  // the hint names it on every row (grouped or not), and the menu moves the row in or
  // out of the group.
  const { grouped, kind, canGroup, originTitle } = useSessionStore(
    useShallow((s) => {
      const link = originLinkOf(s, info.sessionId)
      return {
        grouped: link?.link.grouped === true,
        kind: link?.link.kind ?? 'started',
        // "Add to group" needs an origin that is still a session in the sidebar.
        canGroup: link !== null && link.originId !== null,
        originTitle: link?.originId ? sessionTitleOf(s, link.originId) : ''
      }
    })
  )
  const originHint = originTitle
    ? `${kind === 'handoff' ? 'continued from' : 'started from'} ${originTitle}`
    : ''
  const isMobile = useIsMobile()
  const menu = useContextMenu()
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)
  const renameCommittedRef = useRef(false)
  const [permissionsOpen, setPermissionsOpen] = useState(false)

  const dotState = deriveSessionDotState({
    active,
    needsAttention,
    isRunning,
    isSdkActive,
    isWatching,
    runningSubagents
  })

  // Right-side icon overlay is sized to its actual icon count. Each icon ≈20px
  // (icon + gap) tightly wrapped, plus 5px right padding, plus a 40px blur-in
  // transition zone extending to the left.
  const canArchive = !!onHide && !hidden
  const rightIconCount = (isWorktree ? 1 : 0) + (onPin || onUnpin ? 1 : 0) + (canArchive ? 1 : 0)
  const blurWidthPx = rightIconCount * 20 + 45
  // What the icons themselves take at the right edge (the 40px blur-in zone is
  // only a fade): the room an in-flow control at the row's end must leave.
  const stripWidthPx = rightIconCount > 0 ? rightIconCount * 20 + 5 : 0
  const blurTransitionPct = Math.round((40 / blurWidthPx) * 100)

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameRef.current) {
      renameCommittedRef.current = false
      setRenameValue(info.title)
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [isRenaming])

  const handleRenameKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      renameCommittedRef.current = true
      onFinishRename?.(renameValue)
    } else if (e.key === 'Escape') {
      renameCommittedRef.current = true
      onCancelRename?.()
    }
  }

  return (
    <>
      <div
        data-testid="SessionItem"
        data-id={info.sessionId}
        data-dot-state={dotState}
        data-shine={dotState === 'attention' && hasSummary && !isRunning && runningSubagents === 0}
        onClick={selecting ? onToggleSelected : onClick}
        onDoubleClick={selecting ? undefined : onDoubleClick}
        onContextMenu={menu.open}
        draggable={selecting ? false : draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDrop={onDrop}
        data-depth={depth}
        data-thread-color={threadAccent(hue)}
        style={{
          padding: '0 5px',
          ...(depth > 0 ? { paddingLeft: 5 + depth * 14 } : {}),
          ...(rowColors as React.CSSProperties)
        }}
        className={`
          group relative flex items-center gap-2.5 h-8 rounded-md text-[13px] cursor-default transition
          ${active ? 'text-text-primary bg-bg-tertiary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}
          ${hidden ? 'opacity-45 italic' : ''}
          hover:brightness-110
          ${active ? 'z-10 scale-[1.03] shadow-[0_4px_14px_rgba(0,0,0,0.5)]' : ''}
          ${selecting && selected ? 'bg-bg-hover text-text-primary' : ''}
          ${isWorktree ? 'isolate' : ''}
        `}
      >
        {/* Worktree tint (always visible): strongest at the right edge, fully transparent 30% in
            from it. Behind the row's content (z -10 inside this row's stacking context, above the
            row's own background) and under the hover icon backdrop, which paints later. */}
        {isWorktree && (
          <div
            data-testid="SessionItem.worktreeTint"
            aria-hidden="true"
            className="absolute inset-0 -z-10 rounded-md pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to left, var(--color-worktree-tint) 0%, transparent 30%)'
            }}
          />
        )}
        {selecting && (
          <input
            type="checkbox"
            data-testid="SessionItem.checkbox"
            aria-label={`Select ${info.title}`}
            checked={selected}
            onChange={() => onToggleSelected?.()}
            // The row toggles on a click; the box must not toggle it a second time.
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="shrink-0 w-[14px] h-[14px] cursor-pointer accent-[color:var(--thread-color,#fb923c)]"
          />
        )}
        {onRemove && (
          <span className="shrink-0 w-[14px] h-[14px] flex items-center justify-center">
            <span
              data-testid="SessionItem.remove"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="hidden group-hover:flex items-center justify-center w-[14px] h-[14px] rounded text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              title="Remove from recent"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </span>
          </span>
        )}
        {isRenaming ? (
          <input
            data-testid="SessionItem.renameInput"
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={() => {
              setTimeout(() => {
                if (!renameCommittedRef.current) onCancelRename?.()
              }, 0)
            }}
            placeholder="Session name"
            className="flex-1 min-w-0 bg-transparent border-b border-accent text-[13px] text-text-primary outline-none placeholder:text-text-muted/50"
          />
        ) : (
          <span
            data-testid="SessionItem.title"
            className="overflow-hidden whitespace-nowrap flex-1 min-w-0 flex items-center gap-1"
            style={{
              WebkitMaskImage:
                'linear-gradient(to right, black calc(100% - 12px), transparent 100%)',
              maskImage: 'linear-gradient(to right, black calc(100% - 12px), transparent 100%)'
            }}
            title={originHint ? `${info.title} (${originHint})` : info.title}
          >
            {info.title}
            {originHint && (
              <span
                data-testid="SessionItem.originHint"
                data-grouped={grouped}
                className={`ml-1.5 text-[10px] text-text-muted ${grouped ? '' : 'opacity-60'}`}
              >
                {originHint}
              </span>
            )}
          </span>
        )}
        {pr.state !== 'none' && <BranchPrIcon state={pr.state} url={pr.url} />}
        {(dotState === 'running' || dotState === 'subagents') && (
          <svg
            data-testid="SessionItem.gear"
            aria-label="Working"
            role="img"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="#000"
            className="session-gear absolute right-[7px] top-1/2 -mt-2 pointer-events-none"
          >
            <title>Working</title>
            <path d="M19.4 13a7.6 7.6 0 000-2l2.1-1.6a.5.5 0 00.1-.6l-2-3.5a.5.5 0 00-.6-.2l-2.5 1a7.3 7.3 0 00-1.7-1l-.4-2.6a.5.5 0 00-.5-.4h-4a.5.5 0 00-.5.4l-.4 2.6a7.3 7.3 0 00-1.7 1l-2.5-1a.5.5 0 00-.6.2l-2 3.5a.5.5 0 00.1.6L4.6 11a7.6 7.6 0 000 2l-2.1 1.6a.5.5 0 00-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.2.4.5.4h4c.3 0 .5-.2.5-.4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 00-.1-.6L19.4 13zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" />
          </svg>
        )}
        {memberCount > 0 && onToggleMembers && (
          <button
            type="button"
            data-testid="SessionItem.toggleMembers"
            data-collapsed={membersCollapsed}
            aria-expanded={!membersCollapsed}
            aria-label={`${membersCollapsed ? 'Show' : 'Hide'} ${memberCount} grouped ${memberCount === 1 ? 'session' : 'sessions'}`}
            title={membersCollapsed ? 'Show grouped sessions' : 'Hide grouped sessions'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleMembers()
            }}
            // Clear of the hover strip: it floats over the row's right edge and its
            // icons (Watch, Pin) would take the clicks meant for the toggle's right half.
            style={{ marginRight: isRenaming ? 0 : stripWidthPx }}
            className={`shrink-0 h-8 flex items-center justify-center gap-0.5 text-[10px] text-text-muted hover:text-text-primary transition-colors cursor-pointer ${
              isMobile ? 'min-w-[40px]' : 'min-w-[28px]'
            }`}
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={`transition-transform ${membersCollapsed ? '' : 'rotate-90'}`}
            >
              <path d="M8 5l8 7-8 7z" />
            </svg>
            {memberCount}
          </button>
        )}
        {/* Backdrop blur underlay (hover-only) — width scales to the actual icon count so the
            tinted strip is no wider than needed. Progressively blurs + darkens the text so
            icons stand out against a uniform field. */}
        {!isRenaming && rightIconCount > 0 && (
          <div
            className="absolute right-0 top-0 h-full pointer-events-none rounded-r-md opacity-0 group-hover:opacity-100 transition-opacity session-icon-backdrop"
            style={{
              width: `${blurWidthPx}px`,
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)',
              maskImage: `linear-gradient(to right, transparent 0, black ${blurTransitionPct}%)`,
              WebkitMaskImage: `linear-gradient(to right, transparent 0, black ${blurTransitionPct}%)`
            }}
          />
        )}
        {/* Icon overlay (hover-only) — floats over the blurred backdrop */}
        {!isRenaming && (
          <div className="absolute right-[5px] top-0 h-full flex items-center gap-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
            {isWorktree && (
              <span className="shrink-0 text-mode-edit opacity-100" title="Worktree session">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="18" r="3" />
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="18" cy="6" r="3" />
                  <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
                  <path d="M12 12v3" />
                </svg>
              </span>
            )}
            {canArchive && (
              <span
                data-testid="SessionItem.archive"
                // Archiving is frequent, so a single click does nothing: it takes a double-click.
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  onHide?.()
                }}
                className="shrink-0 text-text-primary opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
                title="Double-click to archive (hide) this session"
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
                >
                  <rect x="2" y="3" width="20" height="5" rx="1" />
                  <path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8" />
                  <path d="M10 12h4" />
                </svg>
              </span>
            )}
            {onPin && (
              <span
                data-testid="SessionItem.pin"
                onClick={(e) => {
                  e.stopPropagation()
                  onPin()
                }}
                className="shrink-0 text-text-primary opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
                title="Pin session"
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
                >
                  <path d="M12 17v5" />
                  <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
                </svg>
              </span>
            )}
            {onUnpin && (
              <span
                data-testid="SessionItem.unpin"
                onClick={(e) => {
                  e.stopPropagation()
                  onUnpin()
                }}
                className="shrink-0 text-text-primary opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
                title="Unpin session"
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
                >
                  <path d="M12 17v5" />
                  <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
                </svg>
              </span>
            )}
          </div>
        )}
      </div>
      {menu.isOpen && (
        <div
          ref={menu.ref}
          className="fixed z-[9999] py-1 rounded-lg bg-bg-tertiary border border-border shadow-lg grid"
          style={menu.style}
        >
          <button
            onClick={() => {
              menu.close()
              onStartRename?.()
            }}
            className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-default"
          >
            Rename session
          </button>
          <button
            onClick={() => {
              menu.close()
              onAutoRename?.()
            }}
            disabled={info.engineId === 'codex'}
            className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-default"
          >
            Auto rename
          </button>
          <button
            onClick={() => {
              menu.close()
              setPermissionsOpen(true)
            }}
            disabled={info.engineId === 'codex'}
            className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-default"
          >
            Edit permissions
          </button>
          {grouped && (
            <button
              data-testid="SessionItem.detach"
              onClick={() => {
                menu.close()
                void window.api.setSessionGrouped(info.sessionId, false)
              }}
              className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-default"
            >
              Detach from group
            </button>
          )}
          {!grouped && canGroup && (
            <button
              data-testid="SessionItem.attach"
              onClick={() => {
                menu.close()
                void window.api.setSessionGrouped(info.sessionId, true)
              }}
              className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-default"
            >
              Add to group
            </button>
          )}
          {isSdkActive && (
            <button
              onClick={() => {
                menu.close()
                window.api.cancelSession(info.sessionId)
              }}
              className="w-full text-left px-3 py-1.5 text-[13px] text-red-400 hover:bg-bg-hover hover:text-red-300 transition-colors cursor-default"
            >
              Disconnect
            </button>
          )}
          {(onHide || onUnhide || onDelete) && <div className="h-px bg-border my-1" />}
          {onHide && !hidden && (
            <button
              onClick={() => {
                menu.close()
                onHide()
              }}
              className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-default"
            >
              Hide session
            </button>
          )}
          {onUnhide && hidden && (
            <button
              onClick={() => {
                menu.close()
                onUnhide()
              }}
              className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-default"
            >
              Unhide session
            </button>
          )}
          {onDelete && (
            <button
              data-testid="SessionItem.delete"
              onClick={() => {
                menu.close()
                onDelete()
              }}
              className="w-full text-left px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-colors cursor-default"
            >
              Delete session...
            </button>
          )}
        </div>
      )}
      <PermissionsDialog
        open={permissionsOpen}
        onClose={() => setPermissionsOpen(false)}
        cwd={info.cwd}
      />
    </>
  )
})
