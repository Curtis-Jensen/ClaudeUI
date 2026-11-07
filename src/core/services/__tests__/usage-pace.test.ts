import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AccountUsage } from '../../../shared/types'
import {
  computePace,
  currentWeek,
  parseUsageLog,
  readUsagePace,
  recordUsagePace
} from '../usage-pace'

const HOUR = 3_600_000
const resetsAt = '2026-11-09T21:00:00Z'
const weekStart = Date.parse(resetsAt) - 7 * 24 * HOUR

function usage(over: Partial<AccountUsage> = {}): AccountUsage {
  return {
    fiveHour: null,
    sevenDay: { usedPercent: 10, resetsAt },
    sevenDaySonnet: null,
    sevenDayOpus: null,
    sevenDayModels: null,
    extraUsage: null,
    planName: null,
    fetchedAt: 0,
    error: null,
    ...over
  } as AccountUsage
}

describe('computePace', () => {
  it('projects the week from usage so far', () => {
    // 10% used a quarter of the way in → on pace for 40%
    const row = computePace(10, resetsAt, weekStart + (7 * 24 * HOUR) / 4)
    expect(row?.elapsedPct).toBe(25)
    expect(row?.projected).toBe(40)
  })

  it('rejects readings outside the window', () => {
    expect(computePace(10, resetsAt, weekStart - HOUR)).toBeNull()
    expect(computePace(10, resetsAt, Date.parse(resetsAt) + HOUR)).toBeNull()
    expect(computePace(10, 'garbage')).toBeNull()
  })
})

describe('parseUsageLog / currentWeek', () => {
  const csv = [
    'time,percentUsed,elapsedPct,projected',
    '2026-10-30T20:11:23Z,50,62.0,80.6',
    '2026-11-01T21:37:43Z,81,91.45,88.57',
    '2026-11-02T21:11:31+00:00,4,5.47,73.1',
    'not,a,row',
    '2026-11-03T15:15:25Z,10,16.2,61.6'
  ].join('\n')

  it('skips the header and malformed rows', () => {
    expect(parseUsageLog(csv)).toHaveLength(4)
  })

  it('keeps only the rows after the last weekly reset', () => {
    const week = currentWeek(parseUsageLog(csv))
    expect(week.map((r) => r.percentUsed)).toEqual([4, 10])
  })
})

describe('recordUsagePace', () => {
  it('appends a row to an existing log without disturbing it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pace-'))
    const file = join(dir, 'usage-log.csv')
    await writeFile(file, 'time,percentUsed,elapsedPct,projected\n2026-11-02T21:11:31Z,4,5.47,73.1')
    const data = await recordUsagePace(usage(), file, weekStart + 24 * HOUR)
    const text = await readFile(file, 'utf8')
    expect(text.split('\n')).toHaveLength(4) // header, old row, new row, trailing newline
    expect(text).toContain('2026-11-02T21:11:31Z,4,5.47,73.1\n')
    expect(data.weekRows.at(-1)?.percentUsed).toBe(10)
  })

  it('creates the log with a header when none exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pace-'))
    const file = join(dir, 'usage-log.csv')
    await recordUsagePace(usage(), file, weekStart + 24 * HOUR)
    expect(
      (await readFile(file, 'utf8')).startsWith('time,percentUsed,elapsedPct,projected\n')
    ).toBe(true)
    expect((await readUsagePace(file)).weekRows).toHaveLength(1)
  })

  it('refuses a failed or window-less reading rather than logging a zero', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'pace-')), 'log.csv')
    await expect(recordUsagePace(usage({ error: 'offline' }), file)).rejects.toThrow('offline')
    await expect(recordUsagePace(usage({ sevenDay: null }), file)).rejects.toThrow(/weekly/)
  })
})
