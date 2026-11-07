import type { AutomationSchedule } from '../../../../../shared/types'

const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "2:00 PM" in the viewer's locale. */
export function formatClock(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function clockFromParts(hour: number, minute: number): string {
  const d = new Date(2000, 0, 1, hour, minute)
  return formatClock(d)
}

const INT = /^\d+$/

/**
 * Human readback for the "Repeats" row: "Daily at 2:00 PM", "Sundays at 10:00 PM",
 * "Every 3 hours". Cron shapes outside the simple daily/weekly forms fall back to
 * the raw expression so nothing is silently misdescribed.
 */
export function formatRepeats(schedule: AutomationSchedule): string {
  if (schedule.type === 'interval') {
    const ms = schedule.intervalMs ?? 0
    if (ms <= 0) return 'Not scheduled'
    if (ms % MS_PER_DAY === 0) {
      const n = ms / MS_PER_DAY
      return n === 1 ? 'Daily' : `Every ${n} days`
    }
    if (ms % MS_PER_HOUR === 0) {
      const n = ms / MS_PER_HOUR
      return n === 1 ? 'Hourly' : `Every ${n} hours`
    }
    const mins = Math.round(ms / 60_000)
    return `Every ${mins} minutes`
  }

  const expr = schedule.cronExpression?.trim()
  if (!expr) return 'Not scheduled'
  const parts = expr.split(/\s+/)
  if (parts.length !== 5) return expr
  const [minute, hour, dom, month, dow] = parts
  if (!INT.test(minute) || !INT.test(hour) || dom !== '*' || month !== '*') return expr
  const clock = clockFromParts(Number(hour), Number(minute))
  if (dow === '*') return `Daily at ${clock}`
  if (INT.test(dow) && Number(dow) <= 7) return `${WEEKDAYS[Number(dow) % 7]}s at ${clock}`
  if (dow === '1-5') return `Weekdays at ${clock}`
  return expr
}

/** "today at 2:00 PM" / "tomorrow at 2:00 PM" / "Nov 5 at 2:00 PM". */
export function formatNextRun(next: Date, now: Date = new Date()): string {
  const startOfDay = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(next) - startOfDay(now)) / MS_PER_DAY)
  const clock = formatClock(next)
  if (dayDiff === 0) return `today at ${clock}`
  if (dayDiff === 1) return `tomorrow at ${clock}`
  if (dayDiff === -1) return `yesterday at ${clock}`
  const date = next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${date} at ${clock}`
}

/** "Today at 2:11 PM" / "Yesterday at 2:37 PM" / "Oct 31 at 2:25 PM" for the History rows. */
export function formatRunTime(ts: number, now: Date = new Date()): string {
  const text = formatNextRun(new Date(ts), now)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * The first line of the prompt stands in for the description the Claude desktop app
 * keeps separately; automations have no description field of their own.
 */
export function describePrompt(prompt: string): string {
  const first =
    prompt
      .split('\n')
      .find((l) => l.trim().length > 0)
      ?.trim() ?? ''
  return first.length > 160 ? `${first.slice(0, 157)}…` : first
}
