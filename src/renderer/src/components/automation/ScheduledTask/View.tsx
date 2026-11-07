import { useState } from 'react'
import type { Automation, AutomationRun } from '../../../../../shared/types'
import { computeNextRuns } from '../AutomationConfig/utils'
import { describePrompt, formatNextRun, formatRepeats, formatRunTime } from './utils'

export interface ScheduledTaskViewProps {
  automation: Automation
  runs: AutomationRun[] | undefined
  hasRunningRun: boolean
  onToggleEnabled: (enabled: boolean) => void
  onRunNow: () => void
  onStopRun: () => void
  onEdit: () => void
  onDelete: () => void
  onSelectRun: (runId: string) => void
}

const INSTRUCTIONS_COLLAPSED_LINES = 4

export function ScheduledTaskView({
  automation,
  runs,
  hasRunningRun,
  onToggleEnabled,
  onRunNow,
  onStopRun,
  onEdit,
  onDelete,
  onSelectRun
}: ScheduledTaskViewProps): React.JSX.Element {
  const [showAll, setShowAll] = useState(false)
  const next = automation.enabled
    ? computeNextRuns(automation.schedule, automation.lastRunAt, 1)[0]
    : undefined
  const instructionLines = automation.prompt.split('\n').length
  const canExpand =
    instructionLines > INSTRUCTIONS_COLLAPSED_LINES || automation.prompt.length > 320

  return (
    <div data-testid="ScheduledTask" className="flex flex-col h-full">
      <div className="shrink-0 h-12 flex items-center justify-between px-8 border-b border-border/30">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-text-muted">Scheduled tasks</span>
          <span className="text-text-muted">/</span>
          <span data-testid="ScheduledTask.title" className="text-text-primary truncate">
            {automation.name}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <IconButton testId="ScheduledTask.edit" title="Edit" onClick={onEdit}>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
          </IconButton>
          <IconButton testId="ScheduledTask.delete" title="Delete" onClick={onDelete}>
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
          </IconButton>
          {hasRunningRun ? (
            <button
              data-testid="ScheduledTask.stop"
              onClick={onStopRun}
              className="ml-2 px-3 py-1.5 text-sm rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              data-testid="ScheduledTask.runNow"
              onClick={onRunNow}
              className="ml-2 flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-text-primary text-bg-primary hover:opacity-90 transition-opacity"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21" />
              </svg>
              Run now
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="grid gap-x-12 gap-y-8 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="flex flex-col gap-7 min-w-0">
            <Field label="Description">
              <p className="text-[15px] text-text-primary">
                {describePrompt(automation.prompt) || 'No description'}
              </p>
            </Field>

            <Field label="Status">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  data-testid="ScheduledTask.toggle"
                  role="switch"
                  aria-checked={automation.enabled}
                  onClick={() => onToggleEnabled(!automation.enabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    automation.enabled ? 'bg-blue-500' : 'bg-bg-tertiary'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                      automation.enabled ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
                <StatusPill
                  enabled={automation.enabled}
                  running={hasRunningRun}
                  failed={automation.lastRunStatus === 'error'}
                />
                <span data-testid="ScheduledTask.nextRun" className="text-sm text-text-muted">
                  {next ? `Next run: ${formatNextRun(next)}` : automation.enabled ? '' : 'Paused'}
                </span>
              </div>
            </Field>

            <Field label="Folder">
              <div
                data-testid="ScheduledTask.folder"
                title={automation.cwd}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 text-sm text-text-primary"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  className="shrink-0 text-text-muted"
                >
                  <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                <span className="truncate" dir="rtl">
                  <bdi>{automation.cwd}</bdi>
                </span>
              </div>
            </Field>

            <Field label="Repeats">
              <p data-testid="ScheduledTask.repeats" className="text-[15px] text-text-primary">
                {formatRepeats(automation.schedule)}
              </p>
            </Field>

            <Field label="Always allowed">
              {automation.permissions.allow.length === 0 ? (
                <p className="text-sm text-text-muted">
                  Approvals you grant during a run appear here.
                </p>
              ) : (
                <ul data-testid="ScheduledTask.allowed" className="flex flex-col gap-1">
                  {automation.permissions.allow.map((rule) => (
                    <li key={rule} className="text-sm font-mono text-text-secondary">
                      {rule}
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          </div>

          <div className="flex flex-col gap-8 min-w-0">
            <Field label="Instructions">
              <div
                data-testid="ScheduledTask.instructions"
                className={`text-[15px] text-text-muted whitespace-pre-wrap break-words ${
                  showAll ? '' : 'line-clamp-4'
                }`}
              >
                {automation.prompt}
              </div>
              {canExpand && (
                <button
                  data-testid="ScheduledTask.showAll"
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-2 flex items-center gap-1.5 text-sm text-text-primary hover:opacity-80"
                >
                  {showAll ? 'Show less' : 'Show all'}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={showAll ? 'rotate-180' : ''}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}
            </Field>

            <Field label="History">
              <HistoryList runs={runs} onSelectRun={onSelectRun} />
            </Field>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h3 className="text-[15px] text-text-muted mb-2">{label}</h3>
      {children}
    </section>
  )
}

function IconButton({
  testId,
  title,
  onClick,
  children
}: {
  testId: string
  title: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      data-testid={testId}
      title={title}
      aria-label={title}
      onClick={onClick}
      className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  )
}

function StatusPill({
  enabled,
  running,
  failed
}: {
  enabled: boolean
  running: boolean
  failed: boolean
}): React.JSX.Element {
  const [label, tone] = running
    ? (['Running', 'text-blue-400 border-blue-500/40'] as const)
    : !enabled
      ? (['Paused', 'text-text-muted border-border/60'] as const)
      : failed
        ? (['Last run failed', 'text-red-400 border-red-500/40'] as const)
        : (['Active', 'text-green-400 border-green-500/40'] as const)
  return (
    <span
      data-testid="ScheduledTask.status"
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-sm rounded-full border ${tone}`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        {!failed && !running && enabled && <polyline points="8 12 11 15 16 9" />}
      </svg>
      {label}
    </span>
  )
}

function HistoryList({
  runs,
  onSelectRun
}: {
  runs: AutomationRun[] | undefined
  onSelectRun: (runId: string) => void
}): React.JSX.Element {
  if (!runs) return <p className="text-sm text-text-muted">Loading…</p>
  if (runs.length === 0) return <p className="text-sm text-text-muted">No runs yet.</p>
  return (
    <ul data-testid="ScheduledTask.history" className="flex flex-col gap-1.5">
      {runs.map((run) => (
        <li key={run.id}>
          <button
            data-testid="ScheduledTask.historyRow"
            data-id={run.id}
            onClick={() => onSelectRun(run.id)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-bg-secondary/60 hover:bg-bg-hover text-left transition-colors"
          >
            <RunIcon status={run.status} />
            <span className="text-[15px] text-text-primary">{formatRunTime(run.startedAt)}</span>
            <span className="ml-auto">
              <RunTrailing run={run} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function RunIcon({ status }: { status: AutomationRun['status'] }): React.JSX.Element {
  const tone =
    status === 'error' ? 'text-red-400' : status === 'running' ? 'text-blue-400' : 'text-text-muted'
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={`shrink-0 ${tone}`}
      data-status={status}
    >
      <circle cx="12" cy="12" r="10" />
      {status === 'success' && <polyline points="8 12 11 15 16 9" />}
      {status === 'error' && <path d="M15 9l-6 6M9 9l6 6" />}
      {status === 'running' && <circle cx="12" cy="12" r="3" fill="currentColor" />}
    </svg>
  )
}

function RunTrailing({ run }: { run: AutomationRun }): React.JSX.Element | null {
  if (run.status === 'running') return <span className="text-sm text-blue-400">Running</span>
  if (run.status === 'error') {
    return (
      <span title={run.error} className="text-sm text-red-400">
        Failed
      </span>
    )
  }
  return <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" aria-label="Completed" />
}
