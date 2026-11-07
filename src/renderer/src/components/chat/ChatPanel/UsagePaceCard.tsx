import { useEffect, useState } from 'react'
import type { UsagePaceData, UsagePaceRow } from '../../../../../shared/types'

export interface UsagePaceCardViewProps {
  rows: UsagePaceRow[]
  checking: boolean
  error: string | null
}

const W = 720
const H = 280
const PAD = { l: 32, r: 10, t: 10, b: 24 }
const WEEK_MS = 7 * 24 * 3_600_000

type Tone = 'good' | 'warn' | 'over'

/** Verdict on the latest reading, in the wording of the scheduled pace check. */
export function paceVerdict(latest: UsagePaceRow): { tone: Tone; text: string } {
  const used = Math.round(latest.percentUsed)
  const elapsed = Math.round(latest.elapsedPct)
  if (latest.projected > 100 && latest.elapsedPct < 90) {
    return {
      tone: 'over',
      text: `On pace to hit the weekly limit: ${used}% used at ${elapsed}% of the week. Ease off.`
    }
  }
  if (latest.projected > 105 && latest.elapsedPct >= 90) {
    return { tone: 'over', text: `Likely to run out before the reset: ${used}% used.` }
  }
  if (latest.projected > 85) {
    return { tone: 'warn', text: `Close to pace: ${used}% used at ${elapsed}% of the week.` }
  }
  return { tone: 'good', text: `Under pace: ${used}% used at ${elapsed}% of the week.` }
}

const TONE_CLASS: Record<Tone, string> = {
  good: 'text-green-400',
  warn: 'text-yellow-400',
  over: 'text-red-400'
}

function formatChecked(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit'
  })
}

/**
 * The projected line: from the latest reading to the end of the week (or the 100% ceiling,
 * whichever comes first) at the rate used so far. Null when there is no rate to extend.
 */
export function projectionEnd(
  latest: UsagePaceRow
): { elapsedPct: number; percent: number } | null {
  if (latest.elapsedPct <= 0 || latest.elapsedPct >= 100 || latest.percentUsed <= 0) return null
  if (latest.projected <= 100) return { elapsedPct: 100, percent: latest.projected }
  return { elapsedPct: (100 * 100) / latest.projected, percent: 100 }
}

/** Seven day slots of the week the reading belongs to, with weekday names in local time. */
export function weekDays(latest: UsagePaceRow): Array<{ label: string; startPct: number }> {
  const weekStart = Date.parse(latest.time) - (latest.elapsedPct / 100) * WEEK_MS
  return Array.from({ length: 7 }, (_, i) => ({
    label: new Date(weekStart + (i * WEEK_MS) / 7 + WEEK_MS / 14).toLocaleDateString(undefined, {
      weekday: 'short'
    }),
    startPct: (i * 100) / 7
  }))
}

export function UsagePaceCardView({
  rows,
  checking,
  error
}: UsagePaceCardViewProps): React.JSX.Element {
  const latest = rows.at(-1)
  const verdict = latest ? paceVerdict(latest) : null
  const x = (pct: number): number => PAD.l + ((W - PAD.l - PAD.r) * pct) / 100
  const y = (pct: number): number => H - PAD.b - ((H - PAD.t - PAD.b) * Math.min(pct, 100)) / 100
  const points = rows.map((r) => `${x(r.elapsedPct)},${y(r.percentUsed)}`).join(' ')

  return (
    <div
      data-testid="UsagePaceCard"
      className="w-full max-w-[760px] rounded-xl border border-border bg-bg-tertiary/60 p-6 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-text-secondary">Weekly usage pace</span>
        {checking && (
          <span data-testid="UsagePaceCard.checking" className="text-[12px] text-text-muted">
            Checking…
          </span>
        )}
      </div>

      {latest ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Used" value={`${Math.round(latest.percentUsed)}%`} />
            <Stat label="Week elapsed" value={`${Math.round(latest.elapsedPct)}%`} />
            <Stat
              label="Projected"
              value={`${Math.round(latest.projected)}%`}
              className={verdict ? TONE_CLASS[verdict.tone] : ''}
            />
          </div>

          <svg
            data-testid="UsagePaceCard.chart"
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto min-h-[200px]"
            role="img"
            aria-label="Usage so far this week against an even pace"
          >
            {latest &&
              weekDays(latest).map((d) => (
                <g key={d.startPct} className="text-text-muted" data-testid="UsagePaceCard.day">
                  <line
                    x1={x(d.startPct)}
                    x2={x(d.startPct)}
                    y1={PAD.t}
                    y2={H - PAD.b}
                    stroke="currentColor"
                    strokeOpacity="0.18"
                  />
                  <text
                    x={x(d.startPct + 100 / 14)}
                    y={H - 7}
                    textAnchor="middle"
                    fontSize="11"
                    fill="currentColor"
                  >
                    {d.label}
                  </text>
                </g>
              ))}
            {[0, 50, 100].map((t) => (
              <g key={t} className="text-text-muted">
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="currentColor"
                  strokeOpacity="0.18"
                />
                <text x={PAD.l - 4} y={y(t) + 3} textAnchor="end" fontSize="11" fill="currentColor">
                  {t}
                </text>
              </g>
            ))}
            <line
              x1={x(0)}
              y1={y(0)}
              x2={x(100)}
              y2={y(100)}
              stroke="currentColor"
              strokeDasharray="4 3"
              className="text-text-muted"
              strokeOpacity="0.7"
            />
            {(() => {
              const end = projectionEnd(latest)
              if (!end) return null
              return (
                <line
                  data-testid="UsagePaceCard.projection"
                  x1={x(latest.elapsedPct)}
                  y1={y(latest.percentUsed)}
                  x2={x(end.elapsedPct)}
                  y2={y(end.percent)}
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray="2 4"
                  strokeLinecap="round"
                  className={verdict ? TONE_CLASS[verdict.tone] : 'text-accent'}
                />
              )
            })()}
            {rows.length > 1 && (
              <polyline
                points={points}
                fill="none"
                strokeWidth="2.5"
                strokeLinejoin="round"
                className="text-accent"
                stroke="currentColor"
              />
            )}
            <circle
              cx={x(latest.elapsedPct)}
              cy={y(latest.percentUsed)}
              r="5"
              className="text-accent"
              fill="currentColor"
            />
          </svg>
          <div className="flex items-center gap-4 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <i className="inline-block w-3.5 border-t-2 border-accent" /> Used
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block w-3.5 border-t-2 border-dashed border-text-muted" /> Even
              pace
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block w-3.5 border-t-2 border-dotted border-text-muted" />{' '}
              Projected
            </span>
            <span className="ml-auto">Checked {formatChecked(latest.time)}</span>
          </div>
          {verdict && (
            <p
              data-testid="UsagePaceCard.verdict"
              className={`text-[12px] ${TONE_CLASS[verdict.tone]}`}
            >
              {verdict.text}
            </p>
          )}
        </>
      ) : (
        <p className="text-[12px] text-text-muted">No readings yet this week.</p>
      )}

      {error && (
        <p data-testid="UsagePaceCard.error" className="text-[12px] text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  className = ''
}: {
  label: string
  value: string
  className?: string
}): React.JSX.Element {
  return (
    <div className="rounded-lg bg-bg-primary/50 px-2.5 py-2">
      <div className={`text-[20px] font-mono tabular-nums ${className}`}>{value}</div>
      <div className="text-[11px] text-text-muted">{label}</div>
    </div>
  )
}

/** A reading is taken when a new thread opens; reopening within this window just re-reads the log. */
const CHECK_COOLDOWN_MS = 60_000
let lastCheckAt = 0

export function UsagePaceCard(): React.JSX.Element {
  const [rows, setRows] = useState<UsagePaceRow[]>([])
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const due = Date.now() - lastCheckAt > CHECK_COOLDOWN_MS
    if (due) lastCheckAt = Date.now()
    setChecking(due)
    const load: Promise<UsagePaceData> = due
      ? window.api.checkUsagePace()
      : window.api.getUsagePace()
    load
      .then((d: UsagePaceData) => {
        if (!cancelled) setRows(d.weekRows)
      })
      .catch(async (err: unknown) => {
        if (cancelled) return
        if (due) setError(err instanceof Error ? err.message : String(err))
        // a failed check still shows whatever the log already holds
        try {
          const d = await window.api.getUsagePace()
          if (!cancelled) setRows(d.weekRows)
        } catch {
          // the log is optional; the card falls back to its empty state
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return <UsagePaceCardView rows={rows} checking={checking} error={error} />
}
