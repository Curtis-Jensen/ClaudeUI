import type {
  DirectoryGroup,
  PluginViewWithOwner,
  SessionInfo,
  WorktreeInfo,
  ActiveView
} from '../../../../shared/types'
import type { CodexDeletePlan } from '../../../../shared/codex-types'
import type { ClaudeProjectDeletePlan } from '../../../../shared/claude-project-delete'
import { WorktreesModal } from '../WorktreesModal'
import { WorktreeCleanupModal } from '../WorktreeCleanupModal'
import { NavItem, SafeSvgIcon } from './NavItem'
import { DirectoryItem } from './DirectoryItem'
import { NewFolderButton, ProjectFolderRow } from './ProjectFolderRow'
import {
  SESSION_DRAG_TYPE,
  moveSessionToFolder,
  useProjectFolders
} from '../../lib/project-folders'
import { useProfile } from '../../lib/profile'
import { isInsideOrEqual } from '../../../../shared/profile'
import { SessionItem } from './SessionItem'
import { PinnedSessionList } from './PinnedSessionList'
import { SettingsPanel } from './SettingsPanel'
import { DeleteConfirmModal } from './DeleteConfirmModal'

export type DeleteTarget =
  | {
      kind: 'session'
      sessionId: string
      projectKey: string
      title: string
      engineId?: import('../../../../shared/types').EngineId
    }
  | {
      kind: 'project'
      projectKey: string
      folderName: string
      sessionCount: number
      /** Which Claude files the delete removes — the rule main runs, computed
       *  from the same listing, so the dialog can name them. */
      claudeFiles: ClaudeProjectDeletePlan
    }

export interface SidebarViewProps {
  style?: React.CSSProperties
  platform: string
  uiFontScale: number
  activeSessionId: string | null
  activeView: ActiveView
  pluginViews: PluginViewWithOwner[]
  automationBadge: number
  pinnedSessionIds: string[]
  pinnedSessions: SessionInfo[]
  watchingSessions: SessionInfo[]
  augmentedDirs: DirectoryGroup[]
  hiddenSessionSet: Set<string>
  hiddenProjectSet: Set<string>
  hasAnyHidden: boolean
  showHidden: boolean
  /** The Claude desktop app has archived chats: the toggle for listing them is offered. */
  hasAnyArchived?: boolean
  showArchived?: boolean
  onShowArchivedToggle?: () => void
  /** Bulk select: pick many chats with checkboxes, then hide (or unhide) them in one go. */
  selecting?: boolean
  selectedIds?: ReadonlySet<string>
  /** How many of the selected chats are already hidden. */
  selectedHiddenCount?: number
  onToggleSelecting?: () => void
  onToggleSelected?: (sessionId: string) => void
  onToggleSelectedMany?: (sessionIds: string[]) => void
  onSelectAll?: () => void
  onSelectArchived?: () => void
  onClearSelection?: () => void
  onHideSelected?: () => void
  onUnhideSelected?: () => void
  expandedDirs: ReadonlySet<string>
  renamingKey: string | null
  worktreesModalCwd: string | null
  deleteTarget: DeleteTarget | null
  /** The Codex subtree the pending delete would remove; null for every other engine. */
  deletePlan: CodexDeletePlan | null
  cleanupWorktree: { sessionId: string; worktreeInfo: WorktreeInfo } | null
  onToggleCollapse?: () => void
  onNewSession: () => void
  /** The Chat / Code toggle's state; undefined hides the toggle (kid profile, folder unknown). */
  appMode?: 'chat' | 'code'
  onSetAppMode?: (m: 'chat' | 'code') => void
  /** The active profile's name; with `onSwitchProfile`, shows the profile switch. */
  profileLabel?: string
  onSwitchProfile?: () => void
  onNewSessionDblClick: () => void
  onSetActiveView: (v: ActiveView) => void
  onShowHiddenToggle: () => void
  onSetRenamingKey: (key: string | null) => void
  onClickSession: (info: SessionInfo) => void
  onToggleWatch: (info: SessionInfo) => void
  onPin: (sessionId: string) => void
  onUnpin: (sessionId: string) => void
  onReorderPinned: (ids: string[]) => void
  onFinishRename: (sessionId: string, title: string) => void
  onAutoRename: (sessionId: string) => void
  onDirClick: (key: string) => void
  onDirDoubleClick: (group: DirectoryGroup) => void
  onSessionDoubleClick: (info: SessionInfo) => void
  onViewWorktrees: (cwd: string) => void
  onCloseWorktreesModal: () => void
  onHideSession: (info: SessionInfo) => void
  onUnhideSession: (info: SessionInfo) => void
  onDeleteSession: (info: SessionInfo) => void
  onHideProject: (key: string) => void
  onUnhideProject: (key: string) => void
  onDeleteProject: (group: DirectoryGroup) => void
  onConfirmDelete: () => Promise<void>
  onCancelDelete: () => void
  onWorktreeCleanupKeep: () => void
  onWorktreeCleanupRemove: () => void
  onWorktreeCleanupCancel: () => void
}

const NO_SELECTION: ReadonlySet<string> = new Set()

export function SidebarView(props: SidebarViewProps): React.JSX.Element {
  const {
    style,
    platform,
    uiFontScale,
    activeSessionId,
    activeView,
    pluginViews,
    automationBadge,
    pinnedSessionIds,
    pinnedSessions,
    watchingSessions,
    augmentedDirs,
    hiddenSessionSet,
    hiddenProjectSet,
    hasAnyHidden,
    showHidden,
    hasAnyArchived = false,
    showArchived = true,
    onShowArchivedToggle,
    selecting = false,
    selectedIds = NO_SELECTION,
    selectedHiddenCount = 0,
    onToggleSelecting,
    onToggleSelected,
    onToggleSelectedMany,
    onSelectAll,
    onSelectArchived,
    onClearSelection,
    onHideSelected,
    onUnhideSelected,
    expandedDirs,
    renamingKey,
    worktreesModalCwd,
    deleteTarget,
    deletePlan,
    cleanupWorktree,
    onToggleCollapse,
    onNewSession,
    appMode,
    onSetAppMode,
    profileLabel,
    onSwitchProfile,
    onNewSessionDblClick,
    onSetActiveView,
    onShowHiddenToggle,
    onSetRenamingKey,
    onClickSession,
    onToggleWatch,
    onUnpin,
    onReorderPinned,
    onFinishRename,
    onAutoRename,
    onDirClick,
    onDirDoubleClick,
    onSessionDoubleClick,
    onViewWorktrees,
    onCloseWorktreesModal,
    onHideSession,
    onUnhideSession,
    onDeleteSession,
    onHideProject,
    onUnhideProject,
    onDeleteProject,
    onConfirmDelete,
    onCancelDelete,
    onWorktreeCleanupKeep,
    onWorktreeCleanupRemove,
    onWorktreeCleanupCancel
  } = props
  const projectFolders = useProjectFolders()
  const chatDir = useProfile((s) => s.chatDir)

  return (
    <div
      data-testid="Sidebar"
      style={style}
      className={`app-texture shrink-0 h-full flex flex-col select-none ${platform === 'darwin' ? 'bg-bg-secondary/60' : 'bg-bg-secondary/85'}`}
    >
      {/* Traffic light clearance + collapse toggle */}
      <div className="h-12 shrink-0 [-webkit-app-region:drag] relative">
        <button
          data-testid="Sidebar.collapseToggle"
          onClick={onToggleCollapse}
          style={{
            position: 'absolute',
            left: platform === 'darwin' ? 82 / uiFontScale : 8,
            top: 22 / uiFontScale,
            transform: 'translateY(-50%)'
          }}
          className="[-webkit-app-region:no-drag] w-[26px] h-[26px] flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-default"
          title="Collapse sidebar"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
            <path d="M16 15l-3-3 3-3" />
          </svg>
        </button>
      </div>

      {appMode && onSetAppMode && (
        <div
          data-testid="Sidebar.modeToggle"
          style={{ margin: '0 8px 8px' }}
          className="flex gap-1 p-1 rounded-lg bg-bg-hover/60"
        >
          {(['chat', 'code'] as const).map((m) => (
            <button
              key={m}
              data-testid={`Sidebar.mode.${m}`}
              onClick={() => onSetAppMode(m)}
              className={`flex-1 py-1 text-[13px] rounded-md cursor-default transition-colors ${
                appMode === m
                  ? 'bg-bg-primary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {m === 'chat' ? 'Chat' : 'Code'}
            </button>
          ))}
        </div>
      )}

      {/* Top nav */}
      <nav style={{ margin: '0 8px' }} className="flex flex-col gap-px">
        <NavItem
          label="New session"
          onClick={onNewSession}
          onDoubleClick={onNewSessionDblClick}
          icon={
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" />
            </svg>
          }
        />
        {onSwitchProfile && (
          <NavItem
            label={`Profile: ${profileLabel ?? ''} (switch)`}
            onClick={onSwitchProfile}
            icon={
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" />
              </svg>
            }
          />
        )}
        <NavItem
          label="Scheduled"
          active={activeView.type === 'automations'}
          onClick={() => {
            onSetActiveView(
              activeView.type === 'automations' ? { type: 'chat' } : { type: 'automations' }
            )
          }}
          badge={automationBadge}
          icon={
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
        {pluginViews.map((view) => (
          <NavItem
            key={`plugin:${view.pluginId}:${view.id}`}
            label={view.label}
            active={activeView.type === 'plugin' && activeView.pluginId === view.pluginId}
            onClick={() => {
              if (activeView.type === 'plugin' && activeView.pluginId === view.pluginId) {
                onSetActiveView({ type: 'chat' })
              } else {
                onSetActiveView({ type: 'plugin', pluginId: view.pluginId })
              }
            }}
            icon={
              view.icon ? (
                <SafeSvgIcon svg={view.icon} />
              ) : (
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              )
            }
          />
        ))}
      </nav>

      {/* Scrollable sidebar content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Pinned sessions */}
        {pinnedSessions.length > 0 && (
          <div style={{ margin: '20px 8px 0' }}>
            <div style={{ paddingLeft: 5, marginBottom: 3 }}>
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                Pinned
              </span>
            </div>
            <PinnedSessionList
              pinnedSessions={pinnedSessions}
              activeSessionId={activeSessionId}
              onClickSession={onClickSession}
              onToggleWatch={onToggleWatch}
              onUnpin={onUnpin}
              onReorder={onReorderPinned}
              renamingKey={renamingKey}
              renamePrefix="pinned"
              onStartRename={(key) => onSetRenamingKey(key)}
              onFinishRename={onFinishRename}
              onAutoRename={onAutoRename}
              onCancelRename={() => onSetRenamingKey(null)}
              hiddenSessionIds={hiddenSessionSet}
              onHideSession={onHideSession}
              onUnhideSession={onUnhideSession}
              onDeleteSession={onDeleteSession}
              selecting={selecting}
              selectedIds={selectedIds}
              onToggleSelected={onToggleSelected}
            />
          </div>
        )}

        {/* Watching sessions */}
        {watchingSessions.length > 0 && (
          <div style={{ margin: '20px 8px 0' }}>
            <div style={{ paddingLeft: 5, marginBottom: 3 }}>
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                Watching
              </span>
            </div>
            <nav className="flex flex-col gap-px">
              {watchingSessions.map((info) => {
                const sessionHidden = hiddenSessionSet.has(info.sessionId)
                return (
                  <SessionItem
                    key={info.sessionId}
                    info={info}
                    active={info.sessionId === activeSessionId}
                    onClick={() => onClickSession(info)}
                    onToggleWatch={() => onToggleWatch(info)}
                    isRenaming={renamingKey === `watching:${info.sessionId}`}
                    onStartRename={() => onSetRenamingKey(`watching:${info.sessionId}`)}
                    onFinishRename={(title) => onFinishRename(info.sessionId, title)}
                    onAutoRename={() => onAutoRename(info.sessionId)}
                    onCancelRename={() => onSetRenamingKey(null)}
                    hidden={sessionHidden}
                    onHide={!sessionHidden ? () => onHideSession(info) : undefined}
                    onUnhide={sessionHidden ? () => onUnhideSession(info) : undefined}
                    onDelete={info.projectKey ? () => onDeleteSession(info) : undefined}
                    selecting={selecting}
                    selected={selectedIds.has(info.sessionId)}
                    onToggleSelected={() => onToggleSelected?.(info.sessionId)}
                  />
                )
              })}
            </nav>
          </div>
        )}

        {/* Projects accordion */}
        {augmentedDirs.length > 0 && (
          <div style={{ margin: '20px 8px 0' }}>
            <div
              style={{ paddingLeft: 5, marginBottom: 3 }}
              className="flex items-center justify-between pr-1"
            >
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em]">
                Projects
              </span>
              {
                <div className="flex items-center gap-2">
                  {appMode === 'chat' && <NewFolderButton />}
                  <button
                    type="button"
                    data-testid="Sidebar.selectToggle"
                    aria-pressed={selecting}
                    onClick={onToggleSelecting}
                    className="text-[10px] text-text-muted hover:text-text-primary transition-colors cursor-default"
                    title={selecting ? 'Leave select mode' : 'Pick many chats to hide at once'}
                  >
                    {selecting ? 'Done' : 'Select'}
                  </button>
                  {hasAnyArchived && (
                    <button
                      data-testid="Sidebar.showArchivedToggle"
                      aria-pressed={showArchived}
                      onClick={onShowArchivedToggle}
                      className="text-[10px] text-text-muted hover:text-text-primary transition-colors cursor-default"
                      title={
                        showArchived
                          ? 'Showing archived chats too. Click to show only chats that are not archived.'
                          : 'Showing only chats that are not archived. Click to include archived chats.'
                      }
                    >
                      {showArchived ? 'Hide archived' : 'Show archived'}
                    </button>
                  )}
                  {hasAnyHidden && (
                    <button
                      data-testid="Sidebar.showHiddenToggle"
                      onClick={onShowHiddenToggle}
                      className="text-[10px] text-text-muted hover:text-text-primary transition-colors cursor-default"
                      title={showHidden ? 'Hide dimmed items' : 'Show hidden items'}
                    >
                      {showHidden ? 'Hide hidden' : 'Show hidden'}
                    </button>
                  )}
                </div>
              }
            </div>
            {selecting && (
              <div
                data-testid="Sidebar.bulkBar"
                className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-1 pb-1 text-[10px] text-text-muted"
              >
                <span data-testid="Sidebar.selectedCount" className="text-text-primary">
                  {selectedIds.size} selected
                </span>
                <button
                  type="button"
                  data-testid="Sidebar.selectAll"
                  onClick={onSelectAll}
                  className="hover:text-text-primary transition-colors cursor-default"
                >
                  All
                </button>
                {hasAnyArchived && (
                  <button
                    type="button"
                    data-testid="Sidebar.selectArchived"
                    onClick={onSelectArchived}
                    title="Pick every chat the Claude desktop app has archived"
                    className="hover:text-text-primary transition-colors cursor-default"
                  >
                    Archived
                  </button>
                )}
                <button
                  type="button"
                  data-testid="Sidebar.clearSelection"
                  onClick={onClearSelection}
                  disabled={selectedIds.size === 0}
                  className="hover:text-text-primary transition-colors cursor-default disabled:opacity-40"
                >
                  None
                </button>
                <span className="flex-1" />
                {selectedHiddenCount > 0 && (
                  <button
                    type="button"
                    data-testid="Sidebar.unhideSelected"
                    onClick={onUnhideSelected}
                    className="hover:text-text-primary transition-colors cursor-default"
                  >
                    Unhide {selectedHiddenCount}
                  </button>
                )}
                <button
                  type="button"
                  data-testid="Sidebar.hideSelected"
                  onClick={onHideSelected}
                  disabled={selectedIds.size - selectedHiddenCount === 0}
                  className="rounded px-1.5 py-0.5 bg-bg-hover text-text-primary hover:bg-bg-tertiary transition-colors cursor-default disabled:opacity-40"
                >
                  Hide {selectedIds.size - selectedHiddenCount}
                </button>
              </div>
            )}
            <nav
              className="flex flex-col gap-px"
              // Dropping a thread on the plain list takes it back out of its folder.
              onDragOver={(e) => {
                if (appMode === 'chat' && e.dataTransfer.types.includes(SESSION_DRAG_TYPE)) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }
              }}
              onDrop={(e) => {
                const id = e.dataTransfer.getData(SESSION_DRAG_TYPE)
                if (appMode !== 'chat' || !id) return
                e.preventDefault()
                moveSessionToFolder(id, null)
              }}
            >
              {(() => {
                const visibleGroups = augmentedDirs
                  .filter((group) => showHidden || !hiddenProjectSet.has(group.projectKey))
                  // A folder whose chats are all hidden has nothing to show, so it goes too.
                  .filter(
                    (group) =>
                      showHidden || group.sessions.some((s) => !hiddenSessionSet.has(s.sessionId))
                  )
                // Folders belong to the Chat tab only; the Code tab lists projects as it always did.
                const inChat = appMode === 'chat'
                const renderGroup = (
                  group: DirectoryGroup,
                  opts?: { flat?: boolean; keySuffix?: string }
                ): React.JSX.Element => {
                  const projectHidden = !!group.projectKey && hiddenProjectSet.has(group.projectKey)
                  return (
                    <DirectoryItem
                      key={`${group.projectKey || group.cwd}${opts?.keySuffix ?? ''}`}
                      group={group}
                      folders={inChat}
                      // Chat tab: loose chats list bare; a project folder inside the chat folder keeps its header.
                      flat={
                        opts?.flat ??
                        (appMode === 'chat' &&
                          (!chatDir ||
                            !isInsideOrEqual(chatDir, group.cwd) ||
                            isInsideOrEqual(group.cwd, chatDir)))
                      }
                      expanded={expandedDirs.has(group.projectKey || group.cwd)}
                      activeSessionId={activeSessionId}
                      onClick={() => onDirClick(group.projectKey || group.cwd)}
                      onDoubleClick={() => onDirDoubleClick(group)}
                      onSessionClick={onClickSession}
                      onSessionDoubleClick={(info) => {
                        if (!pinnedSessionIds.includes(info.sessionId)) onSessionDoubleClick(info)
                      }}
                      onToggleWatch={onToggleWatch}
                      onViewWorktrees={() => onViewWorktrees(group.cwd)}
                      renamingKey={renamingKey}
                      renamePrefix={`project:${group.projectKey || group.cwd}`}
                      onStartRename={(key) => onSetRenamingKey(key)}
                      onFinishRename={onFinishRename}
                      onAutoRename={onAutoRename}
                      onCancelRename={() => onSetRenamingKey(null)}
                      hidden={projectHidden}
                      onHide={
                        group.projectKey && !projectHidden
                          ? () => onHideProject(group.projectKey)
                          : undefined
                      }
                      onUnhide={
                        group.projectKey && projectHidden
                          ? () => onUnhideProject(group.projectKey)
                          : undefined
                      }
                      onDelete={group.projectKey ? () => onDeleteProject(group) : undefined}
                      hiddenSessionIds={hiddenSessionSet}
                      showHidden={showHidden}
                      selecting={selecting}
                      selectedIds={selectedIds}
                      onToggleSelected={onToggleSelected}
                      onToggleProject={onToggleSelectedMany}
                      onHideSession={onHideSession}
                      onUnhideSession={onUnhideSession}
                      onDeleteSession={onDeleteSession}
                    />
                  )
                }
                if (!inChat) return <>{visibleGroups.map((group) => renderGroup(group))}</>

                const sessionFolder = (id: string): string | undefined =>
                  projectFolders.sessionAssignments[id]
                const projectFolder = (group: DirectoryGroup): string | undefined =>
                  projectFolders.assignments[group.projectKey || group.cwd]
                // A thread filed in a folder leaves its project's list; a project left with
                // none of its threads shows nothing.
                const looseGroups = visibleGroups
                  .map((group) => ({
                    ...group,
                    sessions: group.sessions.filter((info) => !sessionFolder(info.sessionId))
                  }))
                  .filter(
                    (group, i) =>
                      group.sessions.length > 0 || visibleGroups[i].sessions.length === 0
                  )
                return (
                  <>
                    {looseGroups
                      .filter((group) => !projectFolder(group))
                      .map((group) => renderGroup(group))}
                    {projectFolders.folders.map((folder) => {
                      const projects = looseGroups.filter(
                        (group) => projectFolder(group) === folder.id
                      )
                      const threadGroups = visibleGroups
                        .map((group) => ({
                          ...group,
                          sessions: group.sessions.filter(
                            (info) => sessionFolder(info.sessionId) === folder.id
                          )
                        }))
                        .filter((group) => group.sessions.length > 0)
                      const count =
                        projects.reduce((n, group) => n + group.sessions.length, 0) +
                        threadGroups.reduce((n, group) => n + group.sessions.length, 0)
                      return (
                        <ProjectFolderRow key={folder.id} folder={folder} count={count}>
                          {projects.map((group) => renderGroup(group))}
                          {threadGroups.map((group) =>
                            renderGroup(group, { flat: true, keySuffix: `@${folder.id}` })
                          )}
                        </ProjectFolderRow>
                      )
                    })}
                  </>
                )
              })()}
            </nav>
          </div>
        )}
      </div>

      {/* Settings panel + Footer */}
      <SettingsPanel />

      {/* Worktrees management modal */}
      {worktreesModalCwd && (
        <WorktreesModal cwd={worktreesModalCwd} onClose={onCloseWorktreesModal} />
      )}

      {/* Delete confirmation modal (session or project) */}
      {deleteTarget && (
        <DeleteConfirmModal
          kind={deleteTarget.kind}
          name={deleteTarget.kind === 'session' ? deleteTarget.title : deleteTarget.folderName}
          path={
            deleteTarget.kind !== 'session'
              ? `~/.claude/projects/${deleteTarget.projectKey}/`
              : // Only a Claude session has a file under `~/.claude/projects`:
                // Codex and opencode keep theirs in the engine's own store, pi
                // under `~/.pi`. Naming one here would be a fabricated path, so
                // for every other engine the session id is the honest detail.
                deleteTarget.engineId && deleteTarget.engineId !== 'claude'
                ? deleteTarget.sessionId
                : `~/.claude/projects/${deleteTarget.projectKey}/${deleteTarget.sessionId}.jsonl`
          }
          sessionCount={deleteTarget.kind === 'project' ? deleteTarget.sessionCount : undefined}
          branches={
            deleteTarget.kind === 'session' && deleteTarget.engineId === 'codex'
              ? (deletePlan?.nodes.filter((node) => node.depth > 0) ?? [])
              : undefined
          }
          sessionPaths={
            deleteTarget.kind === 'project'
              ? deleteTarget.claudeFiles.sessionFiles.map(
                  (f) => `~/.claude/projects/${f.projectKey}/${f.sessionId}.jsonl`
                )
              : undefined
          }
          folderKept={deleteTarget.kind === 'project' && !deleteTarget.claudeFiles.removeDir}
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      )}

      {/* Worktree cleanup modal (on session removal) */}
      {cleanupWorktree && (
        <WorktreeCleanupModal
          worktreeInfo={cleanupWorktree.worktreeInfo}
          onKeep={onWorktreeCleanupKeep}
          onRemove={onWorktreeCleanupRemove}
          onCancel={onWorktreeCleanupCancel}
        />
      )}
    </div>
  )
}
