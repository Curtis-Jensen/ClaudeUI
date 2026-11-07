/**
 * Weekly usage pace log.
 *
 * The Claude desktop app's "Usage pace check" scheduled task appends a row to
 * `~/.claude/usage-log.csv` each time it runs (time,percentUsed,elapsedPct,projected)
 * and builds its dashboard from that file. ClaudeUI reads and appends to the SAME
 * file, so a check taken here shows up in that dashboard too, and the other way round.
 */

import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { AccountUsage, UsagePaceData, UsagePaceRow } from '../../shared/types'

export const USAGE_PACE_LOG = join(homedir(), '.claude', 'usage-log.csv')
const HEADER = 'time,percentUsed,elapsedPct,projected'
const WEEK_MS = 7 * 24 * 3_600_000

/** Pace of one reading: how far through the week, and where the week lands at this rate. */
export function computePace(
  usedPercent: number,
  resetsAtIso: string,
  now: number = Date.now()
): UsagePaceRow | null {
  const resetsAt = Date.parse(resetsAtIso)
  if (!Number.isFinite(resetsAt) || !Number.isFinite(usedPercent)) return null
  const elapsed = ((now - (resetsAt - WEEK_MS)) / WEEK_MS) * 100
  // A reading from outside its own week has nothing sensible to project from.
  if (elapsed <= 0 || elapsed > 100) return null
  return {
    time: new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    percentUsed: Math.round(usedPercent * 10) / 10,
    elapsedPct: Math.round(elapsed * 100) / 100,
    projected: Math.round((usedPercent / elapsed) * 100 * 100) / 100
  }
}

export function parseUsageLog(csv: string): UsagePaceRow[] {
  const rows: UsagePaceRow[] = []
  for (const line of csv.split('\n').slice(1)) {
    const [time, used, elapsed, projected] = line.trim().split(',')
    const row = {
      time,
      percentUsed: Number(used),
      elapsedPct: Number(elapsed),
      projected: Number(projected)
    }
    if (!time || !Number.isFinite(Date.parse(time))) continue
    if (![row.percentUsed, row.elapsedPct, row.projected].every(Number.isFinite)) continue
    rows.push(row)
  }
  return rows
}

/** Rows of the week in progress: a drop in percent used marks the weekly reset. */
export function currentWeek(rows: UsagePaceRow[]): UsagePaceRow[] {
  let start = 0
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].percentUsed < rows[i - 1].percentUsed) start = i
  }
  return rows.slice(start)
}

export async function readUsagePace(file: string = USAGE_PACE_LOG): Promise<UsagePaceData> {
  let csv = ''
  try {
    csv = await readFile(file, 'utf8')
  } catch {
    // no log yet — the first check creates it
  }
  return { weekRows: currentWeek(parseUsageLog(csv)) }
}

/** Take a reading from `usage`, append it to the log and return the refreshed data. */
export async function recordUsagePace(
  usage: AccountUsage,
  file: string = USAGE_PACE_LOG,
  now: number = Date.now()
): Promise<UsagePaceData> {
  if (usage.error) throw new Error(usage.error)
  const week = usage.sevenDay
  if (!week?.resetsAt) throw new Error('No weekly usage window reported for this account')
  const row = computePace(week.usedPercent, week.resetsAt, now)
  if (!row) throw new Error('Could not place this reading inside its weekly window')

  let existing = ''
  try {
    existing = await readFile(file, 'utf8')
  } catch {
    await mkdir(dirname(file), { recursive: true })
  }
  const prefix = existing === '' ? `${HEADER}\n` : existing.endsWith('\n') ? '' : '\n'
  await appendFile(
    file,
    `${prefix}${row.time},${row.percentUsed},${row.elapsedPct},${row.projected}\n`
  )
  return readUsagePace(file)
}
