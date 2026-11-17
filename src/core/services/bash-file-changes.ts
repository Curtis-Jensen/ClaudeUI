/**
 * Bash file changes — the files a Bash command changed, as unified diffs.
 *
 * Edit and Write carry their change in their input, so their cards show a diff.
 * A Bash command (`sed -i`, `cat > file`, a script) carries none, so its card
 * showed only the command. This takes a snapshot right before the command runs
 * (a PreToolUse hook, which cli.js awaits) and another right after (PostToolUse),
 * and hands the difference to the tool result as `fileDiffs`, which the command
 * card renders with the same DiffViewer the Edit card uses.
 *
 * A snapshot is a git tree in a SHADOW repository kept under
 * `~/.claude/ui/bash-snapshots/` — never the project's own `.git`, whose index,
 * stash and history are left alone. Its index persists between snapshots, so
 * after the first one git only re-hashes files whose stat changed. One shadow per
 * root: the session folder's repository (or the folder itself), plus any git
 * repository nested a few levels inside it, since git stops at a nested `.git`.
 * The project's `.gitignore` applies; build and dependency folders are skipped.
 *
 * Files outside every root that the command names by absolute or `~/` path are
 * read before and after directly, so `sed -i ~/.zshrc` shows too.
 *
 * Best effort by design: a snapshot that is slow, fails or runs into another's
 * lock yields no diffs, never a delayed or failed command. Anything else that
 * writes into the folder while the command runs shows up as its change.
 */

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { createTwoFilesPatch } from 'diff'
import type { FileDiff } from '../../shared/types'
import { logger } from './logger'

/** A snapshot that has not finished by then is dropped, and the command runs without one. */
const SNAPSHOT_TIMEOUT_MS = 4000
const MAX_FILES = 30
/** A larger patch keeps its path and counts but not its text, which the card could not show usefully. */
const MAX_PATCH_CHARS = 200_000
const MAX_NESTED_REPOS = 20
const NESTED_REPO_DEPTH = 3
const MAX_OUTSIDE_FILES = 20
const MAX_OUTSIDE_FILE_BYTES = 512 * 1024

const SKIPPED_DIRS = new Set(['node_modules', '.venv', 'venv', '__pycache__', '.cache', '.next'])
const SHADOW_EXCLUDES = [
  'node_modules/',
  '.venv/',
  'venv/',
  '__pycache__/',
  '.cache/',
  '.next/',
  '.DS_Store',
  // Logs are written by running servers, not by the command being shown.
  '*.log'
].join('\n')

interface RootSnapshot {
  root: string
  gitDir: string
  tree: string
}

interface Snapshot {
  roots: RootSnapshot[]
  /** Outside-root file → its text, or null when it did not exist. */
  outside: Map<string, string | null>
}

function shadowBase(): string {
  return path.join(os.homedir(), '.claude', 'ui', 'bash-snapshots')
}

/**
 * A reloaded chat is rebuilt from cli.js's transcript, which has no diffs in it,
 * so each command's diffs are also kept here, one file per tool call.
 */
function savedDiffsFile(toolUseId: string): string | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(toolUseId)) return undefined
  return path.join(os.homedir(), '.claude', 'ui', 'bash-diffs', `${toolUseId}.json`)
}

function saveDiffs(toolUseId: string, diffs: FileDiff[]): void {
  const file = savedDiffsFile(toolUseId)
  if (!file) return
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(diffs))
  } catch (err) {
    logger.warn('[bash-file-changes] could not save diffs', String(err))
  }
}

/** The diffs a past Bash call saved, for rebuilding its card from history. */
export function savedFileDiffs(toolUseId: string): FileDiff[] | undefined {
  const file = savedDiffsFile(toolUseId)
  if (!file || !fs.existsSync(file)) return undefined
  try {
    const diffs = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
    return Array.isArray(diffs) && diffs.length > 0 ? (diffs as FileDiff[]) : undefined
  } catch {
    return undefined
  }
}

function git(gitDir: string, root: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-c', 'core.quotepath=false', '-c', 'core.autocrlf=false', ...args],
      {
        cwd: root,
        env: {
          ...process.env,
          GIT_DIR: gitDir,
          GIT_WORK_TREE: root,
          GIT_INDEX_FILE: path.join(gitDir, 'index'),
          GIT_OPTIONAL_LOCKS: '0'
        },
        maxBuffer: 64 * 1024 * 1024,
        // Generous: a big folder's FIRST snapshot hashes every file and must be
        // let finish, so the later ones are fast. The command never waits on it
        // past SNAPSHOT_TIMEOUT_MS; this only stops a hung git holding the queue.
        timeout: 120_000
      },
      (err, stdout) => (err ? reject(err) : resolve(stdout))
    )
  })
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    p,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))
  ])
}

/** The home folder and anything above it are too big to snapshot. */
function tooBroad(dir: string): boolean {
  const home = os.homedir()
  return dir === path.parse(dir).root || dir === home || home.startsWith(dir + path.sep)
}

function isInside(file: string, dir: string): boolean {
  return file === dir || file.startsWith(dir + path.sep)
}

function topLevel(dir: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile('git', ['rev-parse', '--show-toplevel'], { cwd: dir }, (err, stdout) =>
      resolve(err ? undefined : path.resolve(stdout.trim()))
    )
  })
}

function findNestedRepos(root: string): string[] {
  const found: string[] = []
  const walk = (dir: string, depth: number): void => {
    if (depth > NESTED_REPO_DEPTH || found.length >= MAX_NESTED_REPOS) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name))
        continue
      const child = path.join(dir, entry.name)
      if (fs.existsSync(path.join(child, '.git'))) found.push(child)
      walk(child, depth + 1)
    }
  }
  walk(root, 1)
  return found
}

/** Absolute and `~/` paths written in the command — the only outside files it can be seen to touch. */
export function pathsInCommand(command: string): string[] {
  const home = os.homedir()
  const out = new Set<string>()
  for (const m of command.matchAll(/(?:^|[\s'"=<>|;&(])((?:~\/|\/)[^\s'"<>|;&()`$]+)/g)) {
    const raw = m[1]
    out.add(path.resolve(raw.startsWith('~/') ? path.join(home, raw.slice(2)) : raw))
    if (out.size >= MAX_OUTSIDE_FILES) break
  }
  return [...out]
}

function readText(file: string): string | null | undefined {
  try {
    const stat = fs.statSync(file)
    if (!stat.isFile() || stat.size > MAX_OUTSIDE_FILE_BYTES) return undefined
    const text = fs.readFileSync(file, 'utf8')
    return text.includes('\0') ? undefined : text
  } catch {
    // Not there (yet): a file the command may create.
    return null
  }
}

function countLines(patch: string): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const line of patch.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++
  }
  return { additions, deletions }
}

/** Split `git diff` output into one FileDiff per file, paths made absolute against the root. */
export function splitGitDiff(output: string, root: string): FileDiff[] {
  const files: FileDiff[] = []
  for (const chunk of output.split(/^(?=diff --git )/m)) {
    if (!chunk.startsWith('diff --git ')) continue
    // A nested repository's commit moving is not a file change; its own root shows the files.
    if (/^[-+]Subproject commit /m.test(chunk)) continue
    const minus = chunk.match(/^--- (?:a\/)?(.+)$/m)?.[1]
    const plus = chunk.match(/^\+\+\+ (?:b\/)?(.+)$/m)?.[1]
    const header = chunk.slice('diff --git a/'.length, chunk.indexOf('\n'))
    const rel =
      (plus && plus !== '/dev/null' ? plus : minus && minus !== '/dev/null' ? minus : null) ??
      header.slice(0, Math.floor((header.length - ' b/'.length) / 2))
    const changeType: FileDiff['changeType'] = /^new file mode /m.test(chunk)
      ? 'add'
      : /^deleted file mode /m.test(chunk)
        ? 'delete'
        : 'update'
    const counts = countLines(chunk)
    files.push({
      path: path.join(root, rel),
      patch: chunk.length > MAX_PATCH_CHARS ? '' : chunk,
      changeType,
      ...counts
    })
  }
  return files
}

export class BashFileChanges {
  private rootsPromise: Promise<{ root: string; gitDir: string }[]> | undefined
  private readonly before = new Map<string, Promise<Snapshot | undefined>>()
  private readonly ready = new Map<string, FileDiff[]>()
  /** Snapshots share one index per root, so they take turns (two at once would hit its lock). */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(readonly cwd: string) {}

  /** Take the first snapshot early so the first command does not wait for a full hash of the folder. */
  warm(): void {
    void this.snapshot([]).catch(() => undefined)
  }

  /** PreToolUse: snapshot before the command runs. Resolves within the timeout either way. */
  async beforeCommand(toolUseId: string, command: string): Promise<void> {
    const taking = this.snapshot(pathsInCommand(command)).catch((err) => {
      logger.warn('[bash-file-changes] snapshot before failed', String(err))
      return undefined
    })
    const settled = withTimeout(taking, SNAPSHOT_TIMEOUT_MS)
    this.before.set(toolUseId, settled)
    await settled
  }

  /** PostToolUse: snapshot again and keep the difference for the tool result. */
  async afterCommand(toolUseId: string): Promise<void> {
    const beforePromise = this.before.get(toolUseId)
    this.before.delete(toolUseId)
    const before = beforePromise ? await beforePromise : undefined
    if (!before) return
    try {
      const diffs = await withTimeout(this.diffSince(before), SNAPSHOT_TIMEOUT_MS)
      if (diffs && diffs.length > 0) {
        const kept = diffs.slice(0, MAX_FILES)
        this.ready.set(toolUseId, kept)
        saveDiffs(toolUseId, kept)
      }
    } catch (err) {
      logger.warn('[bash-file-changes] snapshot after failed', String(err))
    }
  }

  /** The diffs for a finished command, once: the result that carries them is sent only once. */
  take(toolUseId: string): FileDiff[] | undefined {
    const diffs = this.ready.get(toolUseId)
    this.ready.delete(toolUseId)
    this.before.delete(toolUseId)
    return diffs
  }

  private roots(): Promise<{ root: string; gitDir: string }[]> {
    this.rootsPromise ??= (async () => {
      const cwd = path.resolve(this.cwd)
      const main = (await topLevel(cwd)) ?? cwd
      if (tooBroad(main)) return []
      const dirs = [main, ...findNestedRepos(main)]
      return Promise.all(dirs.map((root) => this.shadowFor(root)))
    })()
    return this.rootsPromise
  }

  private async shadowFor(root: string): Promise<{ root: string; gitDir: string }> {
    const id = createHash('sha1').update(root).digest('hex').slice(0, 16)
    const gitDir = path.join(shadowBase(), id)
    if (!fs.existsSync(path.join(gitDir, 'HEAD'))) {
      fs.mkdirSync(gitDir, { recursive: true })
      await new Promise<void>((resolve, reject) =>
        execFile('git', ['init', '-q', '--bare', gitDir], (err) => (err ? reject(err) : resolve()))
      )
      fs.mkdirSync(path.join(gitDir, 'info'), { recursive: true })
      fs.writeFileSync(path.join(gitDir, 'info', 'exclude'), SHADOW_EXCLUDES + '\n')
      fs.writeFileSync(path.join(gitDir, 'ROOT'), root + '\n')
    }
    return { root, gitDir }
  }

  private snapshot(commandPaths: string[]): Promise<Snapshot> {
    const run = this.queue.then(() => this.takeSnapshot(commandPaths))
    this.queue = run.catch(() => undefined)
    return run
  }

  private async takeSnapshot(commandPaths: string[]): Promise<Snapshot> {
    const roots = await this.roots()
    const snaps = await Promise.all(
      roots.map(async ({ root, gitDir }) => {
        await git(gitDir, root, ['add', '-A', '--ignore-errors', '.'])
        const tree = (await git(gitDir, root, ['write-tree'])).trim()
        return { root, gitDir, tree }
      })
    )
    const outside = new Map<string, string | null>()
    for (const file of commandPaths) {
      if (roots.some(({ root }) => isInside(file, root))) continue
      const text = readText(file)
      if (text !== undefined) outside.set(file, text)
    }
    return { roots: snaps, outside }
  }

  private async diffSince(before: Snapshot): Promise<FileDiff[]> {
    const after = await this.snapshot([...before.outside.keys()])
    const files: FileDiff[] = []
    for (const prev of before.roots) {
      const next = after.roots.find((r) => r.root === prev.root)
      if (!next || next.tree === prev.tree) continue
      const output = await git(prev.gitDir, prev.root, [
        'diff',
        '--no-color',
        '--no-ext-diff',
        '--no-renames',
        prev.tree,
        next.tree
      ])
      files.push(...splitGitDiff(output, prev.root))
    }
    for (const [file, oldText] of before.outside) {
      const newText = after.outside.get(file) ?? null
      if (newText === oldText) continue
      const patch = createTwoFilesPatch(
        oldText === null ? '/dev/null' : file,
        newText === null ? '/dev/null' : file,
        oldText ?? '',
        newText ?? ''
      )
      files.push({
        path: file,
        patch: patch.length > MAX_PATCH_CHARS ? '' : patch,
        changeType: oldText === null ? 'add' : newText === null ? 'delete' : 'update',
        ...countLines(patch)
      })
    }
    return files
  }
}
