import { query as sdkQuery } from '../sdk'
import { ensureHostTokenFresh } from '../sdk/host-token'
import { EDIT_SUMMARY_TIMEOUT_MS, type EditSummaryResult } from '../../shared/edit-summary'
import { getSdkExecutableOpts } from './claude-session'
import { logger } from './logger'
import { PERSISTED_SESSIONS_DIR } from './persisted-sessions-dir'

const EDIT_SUMMARY_SYSTEM_PROMPT =
  'You explain code edits to someone who does not read code easily. Given the file name and the text before and after an edit, reply with one or two short plain-English sentences saying what changed and why it matters. No code, no file paths, no preamble, no markdown.'

/** Per side, so a huge edit stays quick and cheap. */
const MAX_SIDE_CHARS = 4000

/**
 * A plain-English summary of one file edit, from one tool-less Haiku turn.
 * Run when an edit card opens, never per edit. Same shape as
 * `generateCommitMessage`: `persistSession: false`, so the call leaves no
 * thread in the sidebar. Never throws: the result carries the error and a
 * timestamped trace (also written to the app log) for the card to show.
 */
export async function generateEditSummary(
  fileName: string,
  before: string,
  after: string
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

  try {
    note(`request: ${before.length}+${after.length} chars`)
    note('refreshing host token')
    await ensureHostTokenFresh()
    note('starting Haiku query')
    const q = sdkQuery({
      prompt: `File: ${fileName}\n\nBefore:\n${before.slice(0, MAX_SIDE_CHARS)}\n\nAfter:\n${after.slice(0, MAX_SIDE_CHARS)}`,
      options: {
        ...getSdkExecutableOpts(),
        cwd: PERSISTED_SESSIONS_DIR,
        abortController: abort,
        // One tool-less turn: plugin MCP servers would connect for nothing.
        reloadPlugins: false,
        systemPrompt: EDIT_SUMMARY_SYSTEM_PROMPT,
        model: 'haiku',
        maxTurns: 1,
        tools: [],
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
          { content?: Array<{ type: string; text?: string }> } | undefined
        if (betaMessage?.content) {
          for (const block of betaMessage.content) {
            if (block.type === 'text' && block.text) result += block.text
          }
        }
      }
    }

    const cleaned = result.trim()
    note(`done: ${cleaned.length} chars`)
    if (cleaned.length >= 3) return { text: cleaned, error: null, log }
    return {
      text: null,
      error: timedOut
        ? `Timed out after ${EDIT_SUMMARY_TIMEOUT_MS / 1000}s`
        : 'Haiku returned no text',
      log
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    note(`failed: ${reason}`)
    logger.error('generateEditSummary', 'Failed to summarize edit', err)
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
