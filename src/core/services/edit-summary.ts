import fs from 'fs'
import path from 'path'
import { query as sdkQuery } from '../sdk'
import { ensureHostTokenFresh } from '../sdk/host-token'
import type { CanUseTool } from '../sdk/types'
import {
  EDIT_SUMMARY_TIMEOUT_MS,
  type EditChatTurn,
  type EditSummaryResult
} from '../../shared/edit-summary'
import { getSdkExecutableOpts } from './claude-session'
import { logger } from './logger'
import { PERSISTED_SESSIONS_DIR } from './persisted-sessions-dir'

const EDIT_CHAT_SYSTEM_PROMPT =
  'You explain code edits to someone who does not read code easily. You are given the file name and the text before and after one edit, then a question about it (the first is always "Explain this edit."), possibly after earlier questions and answers. Answer in plain English, in one to three short sentences unless the question asks for more. Say what changed and why it matters. No code unless asked, no file paths, no preamble, no markdown.'

/** Added when the project folder is readable: the same files the coding agents see. */
const READ_ACCESS_PROMPT =
  'You can read the project the edit belongs to with the Read, Grep and Glob tools. Use them only when the question needs more context than the edit shows (what calls this code, what a name means, how a file is used), read only what you need, and never describe the tool use itself, just answer. You cannot change anything.'

/** Per side, so a huge edit stays quick and cheap. */
const MAX_SIDE_CHARS = 4000

/** Read-only: the only tools the explainer is ever given. */
const READ_TOOLS = ['Read', 'Grep', 'Glob']

/** Turns allowed when it may read files: a few lookups, then the answer. */
const MAX_TURNS_WITH_FILES = 8

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

/**
 * Allows only Read, Grep and Glob, and only on paths inside the project: the
 * explainer sees what the coding agents see there and nothing else.
 */
export function readOnlyInside(root: string): CanUseTool {
  return async (toolName, input) => {
    if (!READ_TOOLS.includes(toolName)) {
      return { behavior: 'deny', message: `${toolName} is not available here` }
    }
    const target = input.file_path ?? input.path
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
 * One answer about one file edit, from Sonnet. Run when an edit card opens (the
 * explanation) and again for each follow-up question, which carries the earlier
 * turns as `history`. When `cwd` is the session's project folder the model may
 * read it (Read, Grep, Glob only, inside that folder) for more context;
 * otherwise it is one tool-less turn. Same shape as `generateCommitMessage`:
 * `persistSession: false`, so a call leaves no thread in the sidebar. Never
 * throws: the result carries the error and a timestamped trace (also written to
 * the app log) for the card to show.
 */
export async function generateEditSummary(
  fileName: string,
  before: string,
  after: string,
  question: string,
  history: EditChatTurn[],
  cwd: string
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

  const root = cwd ? readableRoot(cwd) : null
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

  try {
    note(
      `request: ${before.length}+${after.length} chars, ${history.length} earlier turns, ` +
        (root ? `can read ${root}` : 'no file access')
    )
    note('refreshing host token')
    await ensureHostTokenFresh()
    note('starting query')
    const q = sdkQuery({
      prompt,
      options: {
        ...getSdkExecutableOpts(),
        cwd: root ?? PERSISTED_SESSIONS_DIR,
        abortController: abort,
        // Read-only lookups and an answer: plugin MCP servers would connect for nothing.
        reloadPlugins: false,
        systemPrompt: root
          ? `${EDIT_CHAT_SYSTEM_PROMPT} ${READ_ACCESS_PROMPT}`
          : EDIT_CHAT_SYSTEM_PROMPT,
        model: 'sonnet',
        maxTurns: root ? MAX_TURNS_WITH_FILES : 1,
        tools: root ? READ_TOOLS : [],
        ...(root ? { canUseTool: readOnlyInside(root) } : {}),
        thinking: { type: 'disabled' },
        persistSession: false
      }
    })

    let result = ''
    for await (const message of q) {
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

    const cleaned = result.trim()
    note(`done: ${cleaned.length} chars`)
    if (cleaned.length >= 3) return { text: cleaned, error: null, log }
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
