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
    hasAnyHidden: false,
    showHidden: false,
    expandedDirs: new Set([group.projectKey]),
    renamingKey: null,
    worktreesModalCwd: null,
    deleteTarget: null,
    deletePlan: null,
    cleanupWorktree: null,
    onNewSession: noop,
    onNewSessionDblClick: noop,
    onSetActiveView: noop,
    onShowHiddenToggle: noop,
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

  it('sits beside the hidden toggle, which still works', () => {
    const onShowHiddenToggle = vi.fn()
    renderView({ hasAnyArchived: true, hasAnyHidden: true, onShowHiddenToggle })
    expect(screen.getByTestId('Sidebar.showArchivedToggle')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('Sidebar.showHiddenToggle'))
    expect(onShowHiddenToggle).toHaveBeenCalledTimes(1)
  })
})
