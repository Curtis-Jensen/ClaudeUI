import { useAutomationStore } from '../../stores/automation-store'
import { AutomationConfig } from './AutomationConfig'
import { ScheduledTask } from './ScheduledTask'
import { AutomationRunHistory } from './AutomationRunHistory'

interface AutomationDetailProps {
  className?: string
}

export function AutomationDetail({ className }: AutomationDetailProps): React.JSX.Element {
  const selectedAutomationId = useAutomationStore((s) => s.selectedAutomationId)
  const selectedRunId = useAutomationStore((s) => s.selectedRunId)
  const editing = useAutomationStore((s) => s.editing)
  const setEditing = useAutomationStore((s) => s.setEditing)
  const automation = useAutomationStore((s) =>
    s.automations.find((a) => a.id === s.selectedAutomationId)
  )

  if (!selectedAutomationId) {
    return (
      <div
        data-testid="AutomationDetail"
        className={`flex items-center justify-center ${className}`}
      >
        <div className="text-center text-text-muted">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-3 opacity-30"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p className="text-sm">Select a scheduled task</p>
          <p className="text-xs mt-1">or create a new one from the left panel</p>
        </div>
      </div>
    )
  }

  if (selectedRunId) {
    return (
      <div data-testid="AutomationDetail" className={className}>
        <AutomationRunHistory />
      </div>
    )
  }

  if (editing || !automation) {
    return (
      <div data-testid="AutomationDetail" className={className}>
        {automation && (
          <button
            data-testid="AutomationDetail.back"
            onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 px-6 pt-3 text-xs text-text-muted hover:text-text-primary transition-colors"
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
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to {automation.name || 'task'}
          </button>
        )}
        <AutomationConfig />
      </div>
    )
  }

  return (
    <div data-testid="AutomationDetail" className={className}>
      <ScheduledTask automation={automation} onEdit={() => setEditing(true)} />
    </div>
  )
}
