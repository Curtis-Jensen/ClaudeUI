/**
 * The Explain box on an edit card asks the host to explain one edit in plain
 * English, then answer follow-up questions about it. The host answers with the
 * text and a trace of what it did, so a stall or failure can be read in the
 * card instead of only in a log.
 */

/** How long the host waits for the model before giving up; the card counts down from it. */
export const EDIT_SUMMARY_TIMEOUT_MS = 90_000

/** The question the card asks on open; also what the first turn of a history is recorded as. */
export const EDIT_EXPLAIN_QUESTION = 'Explain this edit.'

/** One finished question and its answer, sent back as history with a follow-up. */
export interface EditChatTurn {
  question: string
  answer: string
}

export interface EditSummaryResult {
  /** The answer, or null when none came back. */
  text: string | null
  /** Why there is no answer (a thrown error, a timeout, an empty reply); null on success. */
  error: string | null
  /** Timestamped steps, e.g. `+1.2s message: assistant`, oldest first. */
  log: string[]
}
