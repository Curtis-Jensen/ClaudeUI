import { query as sdkQuery } from '../sdk'
import { ensureHostTokenFresh } from '../sdk/host-token'
import { getSdkExecutableOpts } from './claude-session'
import { logger } from './logger'
import { PERSISTED_SESSIONS_DIR } from './persisted-sessions-dir'

const EDIT_SUMMARY_SYSTEM_PROMPT =
  'You explain code edits to someone who does not read code easily. Given the file name and the text before and after an edit, reply with one or two short plain-English sentences saying what changed and why it matters. No code, no file paths, no preamble, no markdown.'

/** Per side, so a huge edit stays quick and cheap. */
const MAX_SIDE_CHARS = 4000

/**
 * A plain-English summary of one file edit, from one tool-less Haiku turn, or
 * null. Run only when the user asks (the Explain button on a diff card), never
 * per edit. Same shape as `generateCommitMessage`: `persistSession: false`, so
 * the call leaves no thread in the sidebar.
 */
export async function generateEditSummary(
  fileName: string,
  before: string,
  after: string
): Promise<string | null> {
  const abort = new AbortController()
  logger.debug('generateEditSummary', `request: ${before.length}+${after.length} chars`)

  try {
    await ensureHostTokenFresh()
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
    return cleaned.length >= 3 ? cleaned : null
  } catch (err) {
    logger.error('generateEditSummary', 'Failed to summarize edit', err)
    return null
  } finally {
    abort.abort()
  }
}
