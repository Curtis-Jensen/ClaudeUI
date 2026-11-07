import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/nowhere' } }))

import { readArchivedSessionIds } from '../desktop-archive'

describe('readArchivedSessionIds', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'desktop-archive-'))
    await mkdir(join(dir, 'account-1', 'org-1'), { recursive: true })
    await mkdir(join(dir, 'account-1', 'org-2'), { recursive: true })
  })
  afterEach(() => rm(dir, { recursive: true, force: true }))

  const chat = (org: string, name: string, body: unknown): Promise<void> =>
    writeFile(
      join(dir, 'account-1', org, name),
      typeof body === 'string' ? body : JSON.stringify(body)
    )

  it('lists the transcript id of each archived chat, across organizations', async () => {
    await chat('org-1', 'local_a.json', { cliSessionId: 'aaa', isArchived: true })
    await chat('org-2', 'local_b.json', { cliSessionId: 'bbb', isArchived: true })

    expect((await readArchivedSessionIds(dir)).sort()).toEqual(['aaa', 'bbb'])
  })

  it('leaves out chats that are not archived', async () => {
    await chat('org-1', 'local_a.json', { cliSessionId: 'aaa', isArchived: true })
    await chat('org-1', 'local_c.json', { cliSessionId: 'ccc', isArchived: false })
    await chat('org-1', 'local_d.json', { cliSessionId: 'ddd' })

    expect(await readArchivedSessionIds(dir)).toEqual(['aaa'])
  })

  it('skips files that are broken, not chats, or missing the id', async () => {
    await chat('org-1', 'local_bad.json', '{ not json')
    await chat('org-1', 'notes.json', { cliSessionId: 'zzz', isArchived: true })
    await chat('org-1', 'local_noid.json', { isArchived: true })
    await chat('org-1', 'local_ok.json', { cliSessionId: 'ok', isArchived: true })

    expect(await readArchivedSessionIds(dir)).toEqual(['ok'])
  })

  it('answers with nothing when the desktop app is not there', async () => {
    expect(await readArchivedSessionIds(join(dir, 'missing'))).toEqual([])
  })
})
