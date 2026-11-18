import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DirectoryGroup } from '../../../../../shared/types'

vi.mock('../SettingsPanel', () => ({ SettingsPanel: () => null }))

import { SidebarView, type SidebarViewProps } from '../View'

const group: DirectoryGroup = {
  cwd: '/d/WorkPlace/demo',
  projectKey: '-d-workplace-demo',
  folderName: 'demo',
  sessions: []
}

function renderView(overrides: Partial<SidebarViewProps> = {}): SidebarViewProps {
  const noop = (): void => {}
  const props = {
    platform: 'darwin',
    uiFontScale: 1,
    activeSessionId: null,
    activeView: { type: 'chat' },
    pluginViews: [],
    automationBadge: 0,
    pinnedSessionIds: [],
    pinnedSessions: [],
    watchingSessions: [],
    recentSessions: [],
    augmentedDirs: [group],
    hiddenSessionSet: new Set(),
    hiddenProjectSet: new Set(),
    hasHiddenProjects: false,
    revealedHidden: new Set(),
    showHiddenProjects: false,
    expandedDirs: new Set([group.projectKey]),
    renamingKey: null,
    worktreesModalCwd: null,
    deleteTarget: null,
    deletePlan: null,
    cleanupWorktree: null,
    onNewSession: noop,
    onNewSessionDblClick: noop,
    onSetActiveView: noop,
    onToggleRevealHidden: noop,
    onToggleShowHiddenProjects: noop,
    onSetRenamingKey: noop,
    onClickSession: noop,
    onToggleWatch: noop,
    onPin: noop,
    onUnpin: noop,
    onReorderPinned: noop,
    onFinishRename: noop,
    onAutoRename: noop,
    onRemoveRecent: noop,
    onDirClick: noop,
    onDirDoubleClick: noop,
    onSessionDoubleClick: noop,
    onViewWorktrees: noop,
    onCloseWorktreesModal: noop,
    onHideSession: noop,
    onUnhideSession: noop,
    onDeleteSession: noop,
    onHideProject: noop,
    onUnhideProject: noop,
    onDeleteProject: noop,
    onConfirmDelete: async () => {},
    onCancelDelete: noop,
    onWorktreeCleanupKeep: noop,
    onWorktreeCleanupRemove: noop,
    onWorktreeCleanupCancel: noop,
    ...overrides
  } as SidebarViewProps
  render(<SidebarView {...props} />)
  return props
}

afterEach(cleanup)

describe('SidebarView archived toggle', () => {
  it('is not offered when no chat is archived', () => {
    renderView({ hasAnyArchived: false })
    expect(screen.queryByTestId('Sidebar.showArchivedToggle')).toBeNull()
  })

  it('offers hiding archived chats while they are shown', () => {
    renderView({ hasAnyArchived: true, showArchived: true })
    const toggle = screen.getByTestId('Sidebar.showArchivedToggle')
    expect(toggle).toHaveTextContent('Hide archived')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers bringing them back while they are hidden', () => {
    renderView({ hasAnyArchived: true, showArchived: false })
    const toggle = screen.getByTestId('Sidebar.showArchivedToggle')
    expect(toggle).toHaveTextContent('Show archived')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('a click hands the toggle upstream', () => {
    const onShowArchivedToggle = vi.fn()
    renderView({ hasAnyArchived: true, onShowArchivedToggle })
    fireEvent.click(screen.getByTestId('Sidebar.showArchivedToggle'))
    expect(onShowArchivedToggle).toHaveBeenCalledTimes(1)
  })

  it('no longer has a project-wide hidden toggle in the header', () => {
    renderView({ hasAnyArchived: true, hasHiddenProjects: true })
    expect(screen.getByTestId('Sidebar.showArchivedToggle')).toBeInTheDocument()
    expect(screen.queryByTestId('Sidebar.showHiddenToggle')).toBeNull()
  })

  it('right-clicking the Projects header offers to show hidden projects', () => {
    const onToggleShowHiddenProjects = vi.fn()
    renderView({ hasHiddenProjects: true, onToggleShowHiddenProjects })
    fireEvent.contextMenu(screen.getByText('Projects'))
    fireEvent.click(screen.getByTestId('Sidebar.showHiddenProjects'))
    expect(onToggleShowHiddenProjects).toHaveBeenCalledTimes(1)
  })

  it('a project menu reveals the hidden chats of that project', () => {
    const onToggleRevealHidden = vi.fn()
    const withChats = {
      ...group,
      sessions: [{ sessionId: 's1' }, { sessionId: 's2' }]
    } as DirectoryGroup
    renderView({
      augmentedDirs: [withChats],
      hiddenSessionSet: new Set(['s2']),
      expandedDirs: new Set(),
      onToggleRevealHidden
    })
    fireEvent.contextMenu(screen.getByTestId('DirectoryItem').firstElementChild as Element)
    fireEvent.click(screen.getByTestId('DirectoryItem.showHidden'))
    expect(onToggleRevealHidden).toHaveBeenCalledWith(group.projectKey || group.cwd)
  })
})
