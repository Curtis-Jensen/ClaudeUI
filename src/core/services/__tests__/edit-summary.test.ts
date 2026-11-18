/**
 * @vitest-environment node
 *
 * The Explain box lets a model read the project, so what it may read is the
 * thing to pin: Read, Grep and Glob, inside the project folder, and nothing else.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
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

import { query } from '../../sdk'
import { generateEditSummary, isReadOnlyShell, readOnlyInside, readableRoot } from '../edit-summary'

const mockQuery = vi.mocked(query)
beforeEach(() => mockQuery.mockReset())

/** A stand-in for the model call that yields these frames, then stays open like the real stream. */
function frames(...items: Array<Record<string, unknown>>): ReturnType<typeof query> {
  async function* run(): AsyncGenerator<Record<string, unknown>> {
    for (const item of items) yield item
    await new Promise(() => {}) // never closes, as the real stream does until aborted
  }
  return run() as unknown as ReturnType<typeof query>
}

/** The options the nth model call was made with. */
function optionsOfCall(n: number): Record<string, unknown> {
  return (mockQuery.mock.calls[n][0] as unknown as { options: Record<string, unknown> }).options
}

const answer = (text: string): Record<string, unknown> => ({
  type: 'assistant',
  message: { content: [{ type: 'text', text }] }
})

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

describe('isReadOnlyShell', () => {
  it.each([
    'git log --oneline -5',
    'git show HEAD~1',
    'git diff src/a.ts',
    'git blame src/a.ts',
    'git status',
    'git grep -n "fooBar"',
    'git ls-files src',
    'git rev-parse HEAD'
  ])('allows %s', (command) => {
    expect(isReadOnlyShell(command)).toBe(true)
  })

  it.each([
    'git commit -m x',
    'git push',
    'git checkout main',
    'git reset --hard',
    'git log; rm -rf .',
    'git log && ls',
    'git log | sh',
    'git log > out.txt',
    'git log $(whoami)',
    'git log `id`',
    'git diff --output=/tmp/x',
    'git diff -o x',
    'git diff --no-index a b',
    'git diff --ext-diff',
    'git grep -O less foo',
    'git log -- /etc/passwd',
    'git show ../other:file',
    'ls',
    'cat package.json',
    'rm a.ts',
    'curl http://example.com',
    ''
  ])('refuses %s', (command) => {
    expect(isReadOnlyShell(command)).toBe(false)
  })
})

describe('generateEditSummary', () => {
  const sessionCtx = { cwd: '', sessionId: 'abc-123', modelId: 'claude-opus-5-5' }

  it('forks the session on its own model, in plan mode, with the read-only guard', async () => {
    mockQuery.mockReturnValueOnce(frames(answer('It renames a value.')))
    const result = await generateEditSummary('a.ts', 'x', 'y', 'Explain this edit.', [], {
      ...sessionCtx,
      cwd: root
    })

    expect(result).toMatchObject({ text: 'It renames a value.', error: null })
    const options = optionsOfCall(0)
    expect(options).toMatchObject({
      cwd: root,
      resume: 'abc-123',
      forkSession: true,
      persistSession: false,
      permissionMode: 'plan',
      model: 'claude-opus-5-5',
      settingSources: ['user', 'project', 'local']
    })
    expect(options.canUseTool).toBeTypeOf('function')
    expect(options.systemPrompt).toMatchObject({ type: 'preset', preset: 'claude_code' })
  })

  it('stops at the first answer without waiting for the stream to close', async () => {
    mockQuery.mockReturnValueOnce(frames({ type: 'system' }, answer('Done quickly.')))
    const started = Date.now()
    const result = await generateEditSummary('a.ts', 'x', 'y', 'q', [], {
      ...sessionCtx,
      cwd: root
    })
    expect(result.text).toBe('Done quickly.')
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('does not take a turn that looked something up for the answer', async () => {
    mockQuery.mockReturnValueOnce(
      frames(
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'Let me check.' },
              { type: 'tool_use', name: 'Read', input: { file_path: 'a.ts' } }
            ]
          }
        },
        answer('The real answer.')
      )
    )
    const result = await generateEditSummary('a.ts', 'x', 'y', 'q', [], {
      ...sessionCtx,
      cwd: root
    })
    expect(result.text).toBe('The real answer.')
    expect(result.log.some((line) => line.includes('tool: Read'))).toBe(true)
  })

  it('retries as a plain read-only helper when the fork fails', async () => {
    mockQuery.mockImplementationOnce(() => {
      throw new Error('no such session')
    })
    mockQuery.mockReturnValueOnce(frames(answer('From the plain helper.')))
    const result = await generateEditSummary('a.ts', 'x', 'y', 'q', [], {
      ...sessionCtx,
      cwd: root
    })

    expect(result).toMatchObject({ text: 'From the plain helper.', error: null })
    expect(result.log.some((line) => line.includes('fork failed'))).toBe(true)
    const second = optionsOfCall(1)
    expect(second).toMatchObject({ model: 'sonnet', tools: ['Read', 'Grep', 'Glob'] })
    expect(second.resume).toBeUndefined()
  })

  it('does not fork without a session, and has no tools without a usable folder', async () => {
    mockQuery.mockReturnValueOnce(frames(answer('Plain answer.')))
    await generateEditSummary('a.ts', 'x', 'y', 'q', [], {
      cwd: '',
      sessionId: null,
      modelId: null
    })
    const options = optionsOfCall(0)
    expect(options.resume).toBeUndefined()
    expect(options).toMatchObject({ tools: [], maxTurns: 1, cwd: '/tmp/persisted' })
  })

  it('reports why when nothing comes back', async () => {
    mockQuery.mockReturnValueOnce(frames({ type: 'result', result: '' }))
    const result = await generateEditSummary('a.ts', 'x', 'y', 'q', [], {
      cwd: '',
      sessionId: null,
      modelId: null
    })
    expect(result).toMatchObject({ text: null, error: 'The model returned no text' })
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

  it('allows a read-only git command through Bash, and only that', async () => {
    const decide = readOnlyInside(root)
    expect((await decide('Bash', { command: 'git log --oneline -3' }, ctx)).behavior).toBe('allow')
    expect((await decide('Bash', { command: 'git push' }, ctx)).behavior).toBe('deny')
    expect((await decide('Bash', { command: 'git log; rm -rf .' }, ctx)).behavior).toBe('deny')
    expect((await decide('Bash', {}, ctx)).behavior).toBe('deny')
  })

  it.each(['Edit', 'Write', 'NotebookEdit', 'WebFetch', 'Task', 'mcp__ynab__deleteTransaction'])(
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
