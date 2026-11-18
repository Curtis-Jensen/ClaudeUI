/**
 * The Explain box on an edit card asks the host for a plain-English Haiku
 * summary of one edit. The host answers with the text and a trace of what it
 * did, so a stall or failure can be read in the card instead of only in a log.
 */

/** How long the host waits for Haiku before giving up; the card counts down from it. */
export const EDIT_SUMMARY_TIMEOUT_MS = 45_000

export interface EditSummaryResult {
  /** The summary, or null when none came back. */
  text: string | null
  /** Why there is no summary (a thrown error, a timeout, an empty reply); null on success. */
  error: string | null
  /** Timestamped steps, e.g. `+1.2s message: assistant`, oldest first. */
  log: string[]
}
