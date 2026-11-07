import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { DirectoryGroup, SessionInfo } from '../../../../../shared/types'

vi.mock('../SettingsPanel', () => ({ SettingsPanel: () => null }))

import { SidebarView, type SidebarViewProps } from '../View'

const PROJECT_KEY = '-d-workplace-demo'

function session(id: string): SessionInfo {
  return {
    sessionId: id,
    cwd: '/d/WorkPlace/demo',
    projectKey: PROJECT_KEY,
    title: `Chat ${id}`,
    timestamp: 0,
    lastActivityAt: 0,
    engineId: 'claude'
  }
}

const group = (...ids: string[]): DirectoryGroup => ({
  cwd: '/d/WorkPlace/demo',
  projectKey: PROJECT_KEY,
  folderName: 'demo',
  sessions: ids.map(session)
})

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
    augmentedDirs: [group('a', 'b', 'c')],
    hiddenSessionSet: new Set(),
    hiddenProjectSet: new Set(),
    hasAnyHidden: false,
    showHidden: false,
    expandedDirs: new Set([PROJECT_KEY]),
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
    onClickSession: vi.fn(),
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
    onToggleSelecting: vi.fn(),
    onToggleSelected: vi.fn(),
    onToggleSelectedMany: vi.fn(),
    onSelectAll: vi.fn(),
    onSelectArchived: vi.fn(),
    onClearSelection: vi.fn(),
    onHideSelected: vi.fn(),
    onUnhideSelected: vi.fn(),
    ...overrides
  } as SidebarViewProps
  render(<SidebarView {...props} />)
  return props
}

const row = (id: string): HTMLElement =>
  screen.getAllByTestId('SessionItem').find((el) => el.getAttribute('data-id') === id)!

afterEach(cleanup)

describe('SidebarView bulk select', () => {
  it('shows no checkboxes and no action bar until select mode is on', () => {
    renderView()
    expect(screen.queryAllByTestId('SessionItem.checkbox')).toHaveLength(0)
    expect(screen.queryByTestId('DirectoryItem.checkbox')).toBeNull()
    expect(screen.queryByTestId('Sidebar.bulkBar')).toBeNull()
    expect(screen.getByTestId('Sidebar.selectToggle')).toHaveTextContent('Select')
  })

  it('the Select button turns select mode on and off, and says Done while on', () => {
    const props = renderView()
    fireEvent.click(screen.getByTestId('Sidebar.selectToggle'))
    expect(props.onToggleSelecting).toHaveBeenCalledTimes(1)
    cleanup()
    renderView({ selecting: true })
    expect(screen.getByTestId('Sidebar.selectToggle')).toHaveTextContent('Done')
  })

  it('every chat row gets a checkbox that shows whether it is picked', () => {
    renderView({ selecting: true, selectedIds: new Set(['b']) })
    const boxes = screen.getAllByTestId('SessionItem.checkbox') as HTMLInputElement[]
    expect(boxes).toHaveLength(3)
    expect(within(row('a')).getByRole('checkbox')).not.toBeChecked()
    expect(within(row('b')).getByRole('checkbox')).toBeChecked()
  })

  it('clicking a row picks it and does not open it', () => {
    const props = renderView({ selecting: true })
    fireEvent.click(row('a'))
    expect(props.onToggleSelected).toHaveBeenCalledWith('a')
    expect(props.onClickSession).not.toHaveBeenCalled()
  })

  it('clicking the checkbox picks the chat once, not twice', () => {
    const props = renderView({ selecting: true })
    fireEvent.click(within(row('c')).getByRole('checkbox'))
    expect(props.onToggleSelected).toHaveBeenCalledTimes(1)
    expect(props.onToggleSelected).toHaveBeenCalledWith('c')
  })

  it('outside select mode a click opens the chat as before', () => {
    const props = renderView()
    fireEvent.click(row('a'))
    expect(props.onClickSession).toHaveBeenCalledTimes(1)
    expect(props.onToggleSelected).not.toHaveBeenCalled()
  })

  it('a project box picks all of its chats, and shows when some or all are picked', () => {
    const props = renderView({ selecting: true, selectedIds: new Set(['a']) })
    const box = screen.getByTestId('DirectoryItem.checkbox') as HTMLInputElement
    expect(box.indeterminate).toBe(true)
    expect(box.checked).toBe(false)
    fireEvent.click(box)
    expect(props.onToggleSelectedMany).toHaveBeenCalledWith(['a', 'b', 'c'])
    cleanup()

    renderView({ selecting: true, selectedIds: new Set(['a', 'b', 'c']) })
    const all = screen.getByTestId('DirectoryItem.checkbox') as HTMLInputElement
    expect(all.checked).toBe(true)
    expect(all.indeterminate).toBe(false)
  })

  it('a project box does not fold the project when clicked', () => {
    const onDirClick = vi.fn()
    renderView({ selecting: true, onDirClick })
    fireEvent.click(screen.getByTestId('DirectoryItem.checkbox'))
    expect(onDirClick).not.toHaveBeenCalled()
  })

  describe('the action bar', () => {
    it('counts what is picked and offers All and None', () => {
      const props = renderView({ selecting: true, selectedIds: new Set(['a', 'b']) })
      expect(screen.getByTestId('Sidebar.selectedCount')).toHaveTextContent('2 selected')
      fireEvent.click(screen.getByTestId('Sidebar.selectAll'))
      fireEvent.click(screen.getByTestId('Sidebar.clearSelection'))
      expect(props.onSelectAll).toHaveBeenCalledTimes(1)
      expect(props.onClearSelection).toHaveBeenCalledTimes(1)
    })

    it('hides what is picked, counting only the ones not hidden already', () => {
      const props = renderView({
        selecting: true,
        selectedIds: new Set(['a', 'b', 'c']),
        selectedHiddenCount: 1
      })
      const hide = screen.getByTestId('Sidebar.hideSelected')
      expect(hide).toHaveTextContent('Hide 2')
      fireEvent.click(hide)
      expect(props.onHideSelected).toHaveBeenCalledTimes(1)
    })

    it('cannot hide with nothing picked', () => {
      renderView({ selecting: true })
      expect(screen.getByTestId('Sidebar.hideSelected')).toBeDisabled()
      expect(screen.getByTestId('Sidebar.hideSelected')).toHaveTextContent('Hide 0')
      expect(screen.getByTestId('Sidebar.clearSelection')).toBeDisabled()
    })

    it('offers to unhide only when a picked chat is already hidden', () => {
      renderView({ selecting: true, selectedIds: new Set(['a']), selectedHiddenCount: 0 })
      expect(screen.queryByTestId('Sidebar.unhideSelected')).toBeNull()
      cleanup()
      const props = renderView({
        selecting: true,
        selectedIds: new Set(['a', 'b']),
        selectedHiddenCount: 2
      })
      const unhide = screen.getByTestId('Sidebar.unhideSelected')
      expect(unhide).toHaveTextContent('Unhide 2')
      fireEvent.click(unhide)
      expect(props.onUnhideSelected).toHaveBeenCalledTimes(1)
    })

    it('offers picking the archived chats only when the desktop app has archived some', () => {
      renderView({ selecting: true, hasAnyArchived: false })
      expect(screen.queryByTestId('Sidebar.selectArchived')).toBeNull()
      cleanup()
      const props = renderView({ selecting: true, hasAnyArchived: true })
      fireEvent.click(screen.getByTestId('Sidebar.selectArchived'))
      expect(props.onSelectArchived).toHaveBeenCalledTimes(1)
    })
  })
})
