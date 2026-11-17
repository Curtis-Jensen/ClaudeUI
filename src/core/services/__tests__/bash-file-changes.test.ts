/**
 * @vitest-environment node
 *
 * Real git, real folders: the snapshots run against a fake home folder, so the
 * shadow repositories and saved diffs land in a temp folder, not ~/.claude.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { tmpdir } from 'node:os'

// Read only when the module under test calls homedir(), after `home` is set.
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => home }
})

import { BashFileChanges, pathsInCommand, savedFileDiffs, splitGitDiff } from '../bash-file-changes'

const home = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), 'bash-file-changes-')))
const project = path.join(home, 'project')

beforeEach(() => {
  fs.rmSync(project, { recursive: true, force: true })
  fs.mkdirSync(path.join(project, 'sub'), { recursive: true })
  fs.writeFileSync(path.join(project, 'keep.txt'), 'one\ntwo\n')
  fs.writeFileSync(path.join(project, 'sub', 'gone.txt'), 'bye\n')
})

afterAll(() => fs.rmSync(home, { recursive: true, force: true }))

describe('BashFileChanges', () => {
  it('reports the files a command changed, added and deleted, with their diffs', async () => {
    const changes = new BashFileChanges(project)
    await changes.beforeCommand('toolu_a', 'sed -i "" s/two/2/ keep.txt')
    fs.writeFileSync(path.join(project, 'keep.txt'), 'one\n2\n')
    fs.writeFileSync(path.join(project, 'new.txt'), 'hello\n')
    fs.rmSync(path.join(project, 'sub', 'gone.txt'))
    await changes.afterCommand('toolu_a')

    const diffs = changes.take('toolu_a')!
    const byPath = Object.fromEntries(diffs.map((d) => [d.path, d]))
    expect(byPath[path.join(project, 'keep.txt')]).toMatchObject({
      changeType: 'update',
      additions: 1,
      deletions: 1
    })
    expect(byPath[path.join(project, 'keep.txt')].patch).toContain('+2')
    expect(byPath[path.join(project, 'new.txt')]).toMatchObject({ changeType: 'add', additions: 1 })
    expect(byPath[path.join(project, 'sub', 'gone.txt')]).toMatchObject({ changeType: 'delete' })
    // Taken once: the result that carries them is sent once.
    expect(changes.take('toolu_a')).toBeUndefined()
    // Kept for when the chat is reopened from history.
    expect(savedFileDiffs('toolu_a')).toHaveLength(3)
  })

  it('reports nothing for a command that changed nothing', async () => {
    const changes = new BashFileChanges(project)
    await changes.beforeCommand('toolu_b', 'ls')
    await changes.afterCommand('toolu_b')
    expect(changes.take('toolu_b')).toBeUndefined()
  })

  it('sees a file outside the folder when the command names it by path', async () => {
    const outside = path.join(home, 'elsewhere.conf')
    fs.writeFileSync(outside, 'a=1\n')
    const changes = new BashFileChanges(project)
    await changes.beforeCommand('toolu_c', `sed -i "" s/1/2/ ${outside}`)
    fs.writeFileSync(outside, 'a=2\n')
    await changes.afterCommand('toolu_c')
    expect(changes.take('toolu_c')).toEqual([
      expect.objectContaining({ path: outside, changeType: 'update', additions: 1, deletions: 1 })
    ])
  })

  it('leaves the project’s own git repository untouched', async () => {
    const repo = path.join(tmpdir(), `bash-file-changes-repo-${process.pid}`)
    fs.rmSync(repo, { recursive: true, force: true })
    fs.mkdirSync(repo)
    const { execFileSync } = await import('node:child_process')
    execFileSync('git', ['init', '-q'], { cwd: repo })
    fs.writeFileSync(path.join(repo, 'a.txt'), 'x\n')
    const changes = new BashFileChanges(repo)
    await changes.beforeCommand('toolu_d', 'echo y > a.txt')
    fs.writeFileSync(path.join(repo, 'a.txt'), 'y\n')
    await changes.afterCommand('toolu_d')
    expect(changes.take('toolu_d')).toHaveLength(1)
    // Nothing staged in the real index.
    expect(execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: repo }).toString()).toBe(
      ''
    )
    fs.rmSync(repo, { recursive: true, force: true })
  })
})

describe('pathsInCommand', () => {
  it('finds absolute and home paths, not relative ones', () => {
    expect(
      pathsInCommand('cat > /etc/x.conf <<EOF && sed -i "" s/a/b/ ~/notes.md rel.txt')
    ).toEqual(['/etc/x.conf', path.join(home, 'notes.md')])
  })
})

describe('splitGitDiff', () => {
  it('skips a nested repository’s commit moving', () => {
    const output = [
      'diff --git a/vendor b/vendor',
      'index 1111111..2222222 160000',
      '--- a/vendor',
      '+++ b/vendor',
      '@@ -1 +1 @@',
      '-Subproject commit 1111111',
      '+Subproject commit 2222222',
      ''
    ].join('\n')
    expect(splitGitDiff(output, '/r')).toEqual([])
  })
})
