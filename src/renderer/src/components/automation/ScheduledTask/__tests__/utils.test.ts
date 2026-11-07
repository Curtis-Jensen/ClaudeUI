import { describe, expect, it } from 'vitest'
import { describePrompt, formatNextRun, formatRepeats, formatRunTime } from '../utils'

const clock = (h: number, m: number): string =>
  new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

describe('formatRepeats', () => {
  it('reads a fixed daily cron as "Daily at"', () => {
    expect(formatRepeats({ type: 'cron', cronExpression: '11 14 * * *' })).toBe(
      `Daily at ${clock(14, 11)}`
    )
  })

  it('reads a single weekday cron as plural weekday', () => {
    expect(formatRepeats({ type: 'cron', cronExpression: '0 22 * * 0' })).toBe(
      `Sundays at ${clock(22, 0)}`
    )
  })

  it('reads 1-5 as weekdays', () => {
    expect(formatRepeats({ type: 'cron', cronExpression: '30 9 * * 1-5' })).toBe(
      `Weekdays at ${clock(9, 30)}`
    )
  })

  it('falls back to the raw expression for shapes it cannot describe', () => {
    expect(formatRepeats({ type: 'cron', cronExpression: '*/5 * * * *' })).toBe('*/5 * * * *')
  })

  it('describes intervals', () => {
    expect(formatRepeats({ type: 'interval', intervalMs: 3 * 3_600_000 })).toBe('Every 3 hours')
    expect(formatRepeats({ type: 'interval', intervalMs: 86_400_000 })).toBe('Daily')
    expect(formatRepeats({ type: 'interval', intervalMs: 15 * 60_000 })).toBe('Every 15 minutes')
  })

  it('reports an unset schedule', () => {
    expect(formatRepeats({ type: 'cron', cronExpression: '' })).toBe('Not scheduled')
    expect(formatRepeats({ type: 'interval', intervalMs: 0 })).toBe('Not scheduled')
  })
})

describe('formatNextRun / formatRunTime', () => {
  const now = new Date(2026, 10, 2, 16, 0)

  it('labels today, tomorrow and yesterday relative to now', () => {
    expect(formatNextRun(new Date(2026, 10, 2, 18, 0), now)).toBe(`today at ${clock(18, 0)}`)
    expect(formatNextRun(new Date(2026, 10, 3, 14, 0), now)).toBe(`tomorrow at ${clock(14, 0)}`)
    expect(formatNextRun(new Date(2026, 10, 1, 14, 0), now)).toBe(`yesterday at ${clock(14, 0)}`)
  })

  it('capitalises history rows', () => {
    expect(formatRunTime(new Date(2026, 10, 2, 14, 11).getTime(), now)).toBe(
      `Today at ${clock(14, 11)}`
    )
  })
})

describe('describePrompt', () => {
  it('uses the first non-empty line', () => {
    expect(describePrompt('\n\n  Check usage  \nthen more')).toBe('Check usage')
  })

  it('truncates long lines', () => {
    expect(describePrompt('x'.repeat(300))).toHaveLength(158)
  })
})
