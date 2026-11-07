/** Layer 1 — View unit tests for the ScheduledTask overview page. */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ScheduledTaskView, type ScheduledTaskViewProps } from '../View'
import type { Automation, AutomationRun } from '../../../../../../shared/types'

function makeAutomation(overrides: Partial<Automation> = {}): Automation {
  return {
    id: 'a1',
    name: 'Usage pace check',
    prompt: 'Check weekly usage\nline two\nline three\nline four\nline five',
    cwd: '/Users/me/scratch',
    schedule: { type: 'cron', cronExpression: '0 14 * * *' },
    permissions: { allow: ['Read'], deny: [] },
    enabled: true,
    lastRunAt: null,
    lastRunStatus: null,
    createdAt: 0,
    ...overrides
  }
}

function makeRun(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: 'r1',
    automationId: 'a1',
    startedAt: Date.now() - 60_000,
    finishedAt: Date.now(),
    status: 'success',
    totalCostUsd: null,
    ...overrides
  }
}

function makeProps(overrides: Partial<ScheduledTaskViewProps> = {}): ScheduledTaskViewProps {
  return {
    automation: makeAutomation(),
    runs: [],
    hasRunningRun: false,
    onToggleEnabled: vi.fn(),
    onRunNow: vi.fn(),
    onStopRun: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onSelectRun: vi.fn(),
    ...overrides
  }
}

describe('ScheduledTaskView', () => {
  it('shows the breadcrumb, description, repeats and folder', () => {
    render(<ScheduledTaskView {...makeProps()} />)
    expect(screen.getByTestId('ScheduledTask.title').textContent).toBe('Usage pace check')
    expect(screen.getByText('Check weekly usage')).toBeTruthy()
    expect(screen.getByTestId('ScheduledTask.repeats').textContent).toMatch(/^Daily at /)
    expect(screen.getByTestId('ScheduledTask.folder').textContent).toContain('/Users/me/scratch')
  })

  it('shows the next run only while enabled', () => {
    const { rerender } = render(<ScheduledTaskView {...makeProps()} />)
    expect(screen.getByTestId('ScheduledTask.nextRun').textContent).toMatch(/^Next run: /)
    rerender(
      <ScheduledTaskView {...makeProps({ automation: makeAutomation({ enabled: false }) })} />
    )
    expect(screen.getByTestId('ScheduledTask.nextRun').textContent).toBe('Paused')
    expect(screen.getByTestId('ScheduledTask.status').textContent).toBe('Paused')
  })

  it('toggle flips the enabled flag', () => {
    const props = makeProps()
    render(<ScheduledTaskView {...props} />)
    fireEvent.click(screen.getByTestId('ScheduledTask.toggle'))
    expect(props.onToggleEnabled).toHaveBeenCalledWith(false)
  })

  it('Run now becomes Stop while a run is in flight', () => {
    const props = makeProps()
    const { rerender } = render(<ScheduledTaskView {...props} />)
    fireEvent.click(screen.getByTestId('ScheduledTask.runNow'))
    expect(props.onRunNow).toHaveBeenCalled()
    rerender(<ScheduledTaskView {...props} hasRunningRun />)
    expect(screen.queryByTestId('ScheduledTask.runNow')).toBeNull()
    fireEvent.click(screen.getByTestId('ScheduledTask.stop'))
    expect(props.onStopRun).toHaveBeenCalled()
  })

  it('edit and delete call back', () => {
    const props = makeProps()
    render(<ScheduledTaskView {...props} />)
    fireEvent.click(screen.getByTestId('ScheduledTask.edit'))
    fireEvent.click(screen.getByTestId('ScheduledTask.delete'))
    expect(props.onEdit).toHaveBeenCalled()
    expect(props.onDelete).toHaveBeenCalled()
  })

  it('Show all expands long instructions', () => {
    render(<ScheduledTaskView {...makeProps()} />)
    const body = screen.getByTestId('ScheduledTask.instructions')
    expect(body.className).toContain('line-clamp-4')
    fireEvent.click(screen.getByTestId('ScheduledTask.showAll'))
    expect(body.className).not.toContain('line-clamp-4')
  })

  it('hides Show all for short instructions', () => {
    render(
      <ScheduledTaskView {...makeProps({ automation: makeAutomation({ prompt: 'short' }) })} />
    )
    expect(screen.queryByTestId('ScheduledTask.showAll')).toBeNull()
  })

  it('lists history rows and opens one on click', () => {
    const props = makeProps({
      runs: [makeRun({ id: 'r1' }), makeRun({ id: 'r2', status: 'error', error: 'boom' })]
    })
    render(<ScheduledTaskView {...props} />)
    const rows = screen.getAllByTestId('ScheduledTask.historyRow')
    expect(rows).toHaveLength(2)
    expect(within(rows[1]).getByText('Failed')).toBeTruthy()
    fireEvent.click(rows[0])
    expect(props.onSelectRun).toHaveBeenCalledWith('r1')
  })

  it('says so when there is nothing to show', () => {
    render(
      <ScheduledTaskView
        {...makeProps({ automation: makeAutomation({ permissions: { allow: [], deny: [] } }) })}
      />
    )
    expect(screen.getByText('No runs yet.')).toBeTruthy()
    expect(screen.getByText(/Approvals you grant during a run appear here/)).toBeTruthy()
  })
})
