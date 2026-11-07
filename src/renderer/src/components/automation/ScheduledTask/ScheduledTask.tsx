import { useCallback, useEffect } from 'react'
import { useAutomationStore } from '../../../stores/automation-store'
import type { Automation, AutomationRun } from '../../../../../shared/types'
import { ScheduledTaskView } from './View'

interface ScheduledTaskProps {
  automation: Automation
  onEdit: () => void
}

export function ScheduledTask({ automation, onEdit }: ScheduledTaskProps): React.JSX.Element {
  const runs = useAutomationStore((s) => s.runs[automation.id])
  const setRuns = useAutomationStore((s) => s.setRuns)
  const selectRun = useAutomationStore((s) => s.selectRun)
  const hasRunningRun = runs?.some((r) => r.status === 'running') ?? false

  useEffect(() => {
    if (runs !== undefined) return
    let cancelled = false
    window.api
      .listAutomationRuns(automation.id)
      .then((r: AutomationRun[]) => {
        if (!cancelled) setRuns(automation.id, r)
      })
      .catch(() => {
        if (!cancelled) setRuns(automation.id, [])
      })
    return () => {
      cancelled = true
    }
  }, [automation.id, runs, setRuns])

  const handleToggle = useCallback(
    (enabled: boolean) => {
      window.api.toggleAutomation(automation.id, enabled)
    },
    [automation.id]
  )

  const handleRunNow = useCallback(() => {
    window.api.runAutomationNow(automation.id)
  }, [automation.id])

  const handleStop = useCallback(() => {
    window.api.cancelAutomationRun(automation.id)
    const running = runs?.find((r) => r.status === 'running')
    if (running) window.api.dismissAutomationRun(automation.id, running.id)
  }, [automation.id, runs])

  const handleDelete = useCallback(() => {
    if (confirm(`Delete "${automation.name}"? This cannot be undone.`)) {
      window.api.deleteAutomation(automation.id)
      useAutomationStore.getState().selectAutomation(null)
    }
  }, [automation.id, automation.name])

  const handleSelectRun = useCallback(
    (runId: string) => selectRun(automation.id, runId),
    [automation.id, selectRun]
  )

  return (
    <ScheduledTaskView
      automation={automation}
      runs={runs}
      hasRunningRun={hasRunningRun}
      onToggleEnabled={handleToggle}
      onRunNow={handleRunNow}
      onStopRun={handleStop}
      onEdit={onEdit}
      onDelete={handleDelete}
      onSelectRun={handleSelectRun}
    />
  )
}
