import fs from 'fs'
import path from 'path'
import { query as sdkQuery } from '../sdk'
import { ensureHostTokenFresh } from '../sdk/host-token'
import type { CanUseTool, QueryOptions } from '../sdk/types'
import {
  EDIT_SUMMARY_TIMEOUT_MS,
  type EditChatTurn,
  type EditExplainContext,
  type EditSummaryResult
} from '../../shared/edit-summary'
import { getSdkExecutableOpts } from './claude-session'
import { logger } from './logger'
import { PERSISTED_SESSIONS_DIR } from './persisted-sessions-dir'

/** The plain helper's whole prompt: used when there is no session to fork. */
const EDIT_CHAT_SYSTEM_PROMPT =
  'You explain code edits to someone who does not read code easily. You are given the file name and the text before and after one edit, then a question about it (the first is always "Explain this edit."), possibly after earlier questions and answers. Answer in plain English, in one to three short sentences unless the question asks for more. Say what changed and why it matters. No code unless asked, no file paths, no preamble, no markdown.'

/** Added to the plain helper when the project folder is readable. */
const READ_ACCESS_PROMPT =
  'You can read the project the edit belongs to with the Read, Grep and Glob tools. Use them only when the question needs more context than the edit shows (what calls this code, what a name means, how a file is used), read only what you need, and never describe the tool use itself, just answer. You cannot change anything.'

/**
 * Appended to the full Claude Code prompt when the explainer is a fork of the
 * session that made the edit: the same agent, asked a side question.
 */
const FORK_APPEND_PROMPT =
  'You are answering a side question from the person reviewing an edit, not continuing the task. Everything above is the conversation that led to it, so use what you already know about why it was made. They do not read code easily: answer in plain English, in one to three short sentences unless the question asks for more, saying what changed and why it matters. No code unless asked, no preamble, no markdown. You may look things up in the project (read files, search, git history) when it helps, but you cannot change anything and must not describe the lookups, just answer.'

/** Per side, so a huge edit stays quick and cheap. */
const MAX_SIDE_CHARS = 4000

/** Read-only tools that need no command check. */
const READ_TOOLS = ['Read', 'Grep', 'Glob', 'LS', 'NotebookRead']

/** Turns allowed when it may look things up: a few lookups, then the answer. */
const MAX_TURNS_WITH_LOOKUPS = 12

/** The real path of `cwd` when it is an existing absolute directory, else null. */
export function readableRoot(cwd: string): string | null {
  try {
    if (!path.isAbsolute(cwd) || !fs.statSync(cwd).isDirectory()) return null
    return fs.realpathSync(cwd)
  } catch {
    return null
  }
}

function isInside(root: string, target: string): boolean {
  const resolved = path.resolve(root, target)
  return resolved === root || resolved.startsWith(root + path.sep)
}

/** The git subcommands that only read. */
const READ_ONLY_GIT = /^git (log|show|diff|blame|status|ls-files|grep|rev-parse|shortlog)( |$)/

/** Anything that chains, redirects, substitutes or escapes a quote. */
const SHELL_META = /[;&|<>`$()\n\r\\{}]/

/**
 * Flags that make an otherwise read-only git command write a file, run a
 * program, or read outside the repository.
 */
const DANGEROUS_GIT_FLAG =
  /(^|\s)(--output\S*|-o\S*|--ext-diff|--textconv|--no-index|--open-files-in-pager\S*|-O\S*|--exec\S*|--git-dir\S*|--work-tree\S*)(\s|=|$)/

/**
 * True for one plain, read-only git command (log, show, diff, blame, status,
 * ls-files, grep, rev-parse, shortlog) with no chaining, redirects, writing or
 * program-running flags, and no path that leaves the project.
 */
export function isReadOnlyShell(command: string): boolean {
  const trimmed = command.trim()
  if (!trimmed || SHELL_META.test(trimmed)) return false
  if (!READ_ONLY_GIT.test(trimmed)) return false
  if (DANGEROUS_GIT_FLAG.test(trimmed)) return false
  // Absolute paths and .. could point outside the project.
  return !trimmed.split(/\s+/).some((word) => word.startsWith('/') || word.includes('..'))
}

/**
 * The guard on everything the explainer does: the read-only tools, on paths
 * inside the project, plus read-only git. Nothing else, whatever the engine's
 * permission mode would have allowed.
 */
export function readOnlyInside(root: string): CanUseTool {
  return async (toolName, input) => {
    if (toolName === 'Bash') {
      return typeof input.command === 'string' && isReadOnlyShell(input.command)
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: 'Only read-only git commands are available here' }
    }
    if (!READ_TOOLS.includes(toolName)) {
      return { behavior: 'deny', message: `${toolName} is not available here` }
    }
    const target = input.file_path ?? input.path ?? input.notebook_path
    if (typeof target === 'string' && !isInside(root, target)) {
      return { behavior: 'deny', message: 'That path is outside the project' }
    }
    const pattern = input.pattern
    if (toolName === 'Glob' && typeof pattern === 'string' && pattern.includes('..')) {
      return { behavior: 'deny', message: 'That pattern leaves the project' }
    }
    return { behavior: 'allow', updatedInput: input }
  }
}

/**
 * One answer about one file edit. Run when an edit card opens (the explanation)
 * and again for each follow-up question, which carries the earlier turns as
 * `history`.
 *
 * With a session to fork (`context.sessionId`) the explainer is that
 * conversation's agent asked a side question: the same transcript, the full
 * Claude Code prompt, the user's, project and local settings and the session's
 * own model, in plan mode (the engine itself refuses edits). Whatever the mode,
 * `readOnlyInside` limits it to reads inside the project and read-only git. If
 * the fork fails it retries as a plain read-only helper started in the project
 * folder, or a single tool-less turn when there is no usable folder.
 *
 * Same shape as `generateCommitMessage`: `persistSession: false`, so nothing
 * lands in the sidebar or the session's history. Never throws: the result
 * carries the error and a timestamped trace (also written to the app log).
 */
export async function generateEditSummary(
  fileName: string,
  before: string,
  after: string,
  question: string,
  history: EditChatTurn[],
  context: EditExplainContext
): Promise<EditSummaryResult> {
  const abort = new AbortController()
  const startedAt = Date.now()
  const log: string[] = []
  const note = (message: string): void => {
    log.push(`+${((Date.now() - startedAt) / 1000).toFixed(1)}s ${message}`)
    logger.info('generateEditSummary', message)
  }
  let timedOut = false
  // A stalled turn must end in the card's error state, not "Explaining…" forever.
  const timer = setTimeout(() => {
    timedOut = true
    note(`no answer after ${EDIT_SUMMARY_TIMEOUT_MS / 1000}s, aborting`)
    abort.abort()
  }, EDIT_SUMMARY_TIMEOUT_MS)

  const root = context.cwd ? readableRoot(context.cwd) : null
  const earlier = history.map((t) => `Question: ${t.question}\nAnswer: ${t.answer}`).join('\n\n')
  const prompt = [
    `File: ${fileName}`,
    `Before:\n${before.slice(0, MAX_SIDE_CHARS)}`,
    `After:\n${after.slice(0, MAX_SIDE_CHARS)}`,
    earlier,
    `Question: ${question}`
  ]
    .filter(Boolean)
    .join('\n\n')

  /** One query to the model; returns the answer text ('' when none). */
  const ask = async (forked: boolean): Promise<string> => {
    const options: QueryOptions = {
      ...getSdkExecutableOpts(),
      abortController: abort,
      // Lookups and an answer: plugin MCP servers would connect for nothing.
      reloadPlugins: false,
      thinking: { type: 'disabled' },
      persistSession: false
    }
    if (forked) {
      // Resuming reads the transcript from the session's own project folder, so
      // this is the folder string the session was started with, not its real path.
      Object.assign(options, {
        cwd: context.cwd,
        resume: context.sessionId ?? undefined,
        forkSession: true,
        permissionMode: 'plan',
        settingSources: ['user', 'project', 'local'],
        systemPrompt: { type: 'preset', preset: 'claude_code', append: FORK_APPEND_PROMPT },
        model: context.modelId ?? 'sonnet',
        maxTurns: MAX_TURNS_WITH_LOOKUPS,
        tools: [...READ_TOOLS, 'Bash'],
        canUseTool: readOnlyInside(root ?? context.cwd)
      } satisfies QueryOptions)
    } else {
      Object.assign(options, {
        cwd: root ? context.cwd : PERSISTED_SESSIONS_DIR,
        systemPrompt: root
          ? `${EDIT_CHAT_SYSTEM_PROMPT} ${READ_ACCESS_PROMPT}`
          : EDIT_CHAT_SYSTEM_PROMPT,
        model: 'sonnet',
        maxTurns: root ? MAX_TURNS_WITH_LOOKUPS : 1,
        tools: root ? ['Read', 'Grep', 'Glob'] : [],
        ...(root ? { canUseTool: readOnlyInside(root) } : {})
      } satisfies QueryOptions)
    }

    note(forked ? `starting query (fork of ${context.sessionId})` : 'starting query')
    let result = ''
    for await (const message of sdkQuery({ prompt, options })) {
      if (!message || typeof message !== 'object') continue
      const msg = message as Record<string, unknown>
      note(`message: ${String(msg.type)}`)
      if (msg.type === 'assistant') {
        const betaMessage = msg.message as
          | { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> }
          | undefined
        let text = ''
        let usedTool = false
        for (const block of betaMessage?.content ?? []) {
          if (block.type === 'text' && block.text) text += block.text
          if (block.type === 'tool_use') {
            usedTool = true
            note(`tool: ${block.name} ${JSON.stringify(block.input).slice(0, 160)}`)
          }
        }
        // A turn that looked something up is not the answer, whatever it said
        // while doing so. The first one without a lookup is, and the stream
        // stays open until something closes it, so stop here rather than wait
        // out the timeout.
        if (!usedTool && text.trim()) {
          result = text
          break
        }
      }
      if (msg.type === 'result') {
        if (!result.trim() && typeof msg.result === 'string') result = msg.result
        break
      }
    }
    return result.trim()
  }

  try {
    note(
      `request: ${before.length}+${after.length} chars, ${history.length} earlier turns, ` +
        (context.sessionId ? 'session to fork' : 'no session') +
        (root ? `, can read ${root}` : ', no file access')
    )
    note('refreshing host token')
    await ensureHostTokenFresh()

    let answer = ''
    if (context.sessionId && root) {
      try {
        answer = await ask(true)
      } catch (err) {
        if (timedOut) throw err
        note(`fork failed, retrying without it: ${err instanceof Error ? err.message : err}`)
      }
    }
    if (!answer && !timedOut) answer = await ask(false)

    note(`done: ${answer.length} chars`)
    if (answer.length >= 3) return { text: answer, error: null, log }
    return {
      text: null,
      error: timedOut
        ? `Timed out after ${EDIT_SUMMARY_TIMEOUT_MS / 1000}s`
        : 'The model returned no text',
      log
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    note(`failed: ${reason}`)
    logger.error('generateEditSummary', 'Failed to answer about edit', err)
    return {
      text: null,
      error: timedOut ? `Timed out after ${EDIT_SUMMARY_TIMEOUT_MS / 1000}s` : reason,
      log
    }
  } finally {
    clearTimeout(timer)
    abort.abort()
  }
}
