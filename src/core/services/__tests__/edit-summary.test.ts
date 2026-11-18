/**
 * @vitest-environment node
 *
 * The Explain box lets a model read the project, so what it may read is the
 * thing to pin: Read, Grep and Glob, inside the project folder, and nothing else.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// The service only needs these for the model call itself; the guards under test are pure.
vi.mock('../../sdk', () => ({ query: vi.fn() }))
vi.mock('../../sdk/host-token', () => ({ ensureHostTokenFresh: vi.fn() }))
vi.mock('../claude-session', () => ({ getSdkExecutableOpts: () => ({}) }))
vi.mock('../logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('../persisted-sessions-dir', () => ({ PERSISTED_SESSIONS_DIR: '/tmp/persisted' }))

import { readOnlyInside, readableRoot } from '../edit-summary'

const ctx = { signal: new AbortController().signal }
let root: string

beforeAll(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'edit-summary-')))
  fs.writeFileSync(path.join(root, 'a.ts'), 'x')
})
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('readableRoot', () => {
  it('accepts an existing absolute directory', () => {
    expect(readableRoot(root)).toBe(root)
  })

  it('refuses a missing path, a file, a relative path and an empty string', () => {
    expect(readableRoot(path.join(root, 'nope'))).toBeNull()
    expect(readableRoot(path.join(root, 'a.ts'))).toBeNull()
    expect(readableRoot('relative/dir')).toBeNull()
    expect(readableRoot('')).toBeNull()
  })
})

describe('readOnlyInside', () => {
  it.each(['Read', 'Grep', 'Glob'])('allows %s on a path inside the project', async (tool) => {
    const decide = readOnlyInside(root)
    const input = { file_path: path.join(root, 'a.ts'), path: root, pattern: '**/*.ts' }
    expect((await decide(tool, input, ctx)).behavior).toBe('allow')
  })

  it('allows Grep with no path (it defaults to the project folder)', async () => {
    expect((await readOnlyInside(root)('Grep', { pattern: 'foo' }, ctx)).behavior).toBe('allow')
  })

  it.each(['Bash', 'Edit', 'Write', 'NotebookEdit', 'WebFetch', 'Task'])(
    'denies %s',
    async (tool) => {
      expect((await readOnlyInside(root)(tool, { command: 'ls' }, ctx)).behavior).toBe('deny')
    }
  )

  it('denies reading outside the project, by absolute path or by ..', async () => {
    const decide = readOnlyInside(root)
    expect((await decide('Read', { file_path: '/etc/hosts' }, ctx)).behavior).toBe('deny')
    expect((await decide('Read', { file_path: '../secret' }, ctx)).behavior).toBe('deny')
    expect((await decide('Grep', { pattern: 'x', path: path.dirname(root) }, ctx)).behavior).toBe(
      'deny'
    )
  })

  it('denies a Glob pattern that climbs out of the project', async () => {
    expect((await readOnlyInside(root)('Glob', { pattern: '../**/*' }, ctx)).behavior).toBe('deny')
  })

  it('does not treat a sibling folder with the same prefix as inside', async () => {
    const sibling = `${root}-other/a.ts`
    expect((await readOnlyInside(root)('Read', { file_path: sibling }, ctx)).behavior).toBe('deny')
  })
})
