/**
 * The Explain box under an edit card's diff: a plain-English explanation of the
 * edit, requested the moment the card opens (this body only mounts while the
 * card is open; closing unmounts it and a reopen starts over), then a small
 * conversation: ask follow-up questions about the edit underneath.
 *
 * While waiting it counts down to the host's timeout. Whatever happens, the
 * "Details" panel shows the latest call's timestamped trace (the host's steps
 * plus this side's own lines), so a stall or error can be traced without
 * opening the app log.
 */

import { useEffect, useState } from 'react'
import {
  EDIT_EXPLAIN_QUESTION,
  EDIT_SUMMARY_TIMEOUT_MS,
  type EditChatTurn
} from '../../../../../../shared/edit-summary'

/** The host aborts at the timeout; this side waits a little longer, then gives up itself. */
const BACKSTOP_GRACE_MS = 5_000

/** One call to the host. Bumping `id` re-runs the effect (retry, or the next question). */
interface Asking {
  id: number
  question: string
  history: EditChatTurn[]
}

type CallState =
  | { status: 'loading'; startedAt: number }
  | { status: 'idle' }
  | { status: 'error'; message: string }

const FIRST_ASK: Asking = { id: 0, question: EDIT_EXPLAIN_QUESTION, history: [] }

/**
 * The before and after text a unified patch describes: its context and removed
 * lines, and its context and added lines, without the file and hunk headers.
 */
export function patchToBeforeAfter(patch: string): { before: string; after: string } {
  const before: string[] = []
  const after: string[] = []
  for (const line of patch.split('\n')) {
    if (/^(diff |index |--- |\+\+\+ |@@|\\ No newline)/.test(line)) continue
    if (line.startsWith('+')) after.push(line.slice(1))
    else if (line.startsWith('-')) before.push(line.slice(1))
    else if (line.startsWith(' ')) {
      before.push(line.slice(1))
      after.push(line.slice(1))
    }
  }
  return { before: before.join('\n'), after: after.join('\n') }
}

/**
 * `autoStart` (default) asks for the explanation as soon as this mounts. A card
 * that can show many files passes false, so opening it does not fire one model
 * call per file; each file then offers an "Explain this edit" button instead.
 */
export function ExplainEdit({
  path,
  before,
  after,
  autoStart = true
}: {
  path: string
  before: string
  after: string
  autoStart?: boolean
}): React.JSX.Element {
  const [asking, setAsking] = useState<Asking | null>(autoStart ? FIRST_ASK : null)
  const [turns, setTurns] = useState<EditChatTurn[]>([])
  const [call, setCall] = useState<CallState>(() =>
    autoStart ? { status: 'loading', startedAt: Date.now() } : { status: 'idle' }
  )
  const [log, setLog] = useState<string[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!asking) return
    const current = asking
    const startedAt = Date.now()
    let settled = false
    const stamp = (line: string): string =>
      `+${((Date.now() - startedAt) / 1000).toFixed(1)}s renderer: ${line}`

    // Stamped now: the other lines are stamped when the answer (or the give-up) lands.
    const sent = stamp(`asked: ${current.question}`)
    setCall({ status: 'loading', startedAt })
    setNow(startedAt)
    const tick = setInterval(() => setNow(Date.now()), 1000)

    const settle = (next: CallState, lines: string[], turn?: EditChatTurn): void => {
      if (settled) return
      settled = true
      clearInterval(tick)
      clearTimeout(backstop)
      if (turn) setTurns((prev) => [...prev, turn])
      setLog(lines)
      setCall(next)
    }

    const backstop = setTimeout(
      () =>
        settle(
          {
            status: 'error',
            message: `No reply from the app after ${(EDIT_SUMMARY_TIMEOUT_MS + BACKSTOP_GRACE_MS) / 1000}s`
          },
          [sent, stamp('gave up waiting')]
        ),
      EDIT_SUMMARY_TIMEOUT_MS + BACKSTOP_GRACE_MS
    )

    // `Promise.resolve().then` so a synchronous throw (an older preload with no
    // `explainEdit`) lands in the error state instead of crashing the card.
    Promise.resolve()
      .then(() => window.api.explainEdit(path, before, after, current.question, current.history))
      .then((result) => {
        const lines = [sent, ...(result?.log ?? []), stamp('got the answer')]
        if (result?.text) {
          settle({ status: 'idle' }, lines, { question: current.question, answer: result.text })
        } else {
          settle({ status: 'error', message: result?.error ?? 'No answer came back' }, lines)
        }
      })
      .catch((err: unknown) =>
        settle({ status: 'error', message: err instanceof Error ? err.message : String(err) }, [
          sent,
          stamp(`call failed: ${String(err)}`)
        ])
      )

    return () => {
      settled = true
      clearInterval(tick)
      clearTimeout(backstop)
    }
  }, [path, before, after, asking])

  const secondsLeft =
    call.status === 'loading'
      ? Math.max(0, Math.ceil((EDIT_SUMMARY_TIMEOUT_MS - (now - call.startedAt)) / 1000))
      : 0

  const ask = (event: React.FormEvent): void => {
    event.preventDefault()
    const question = draft.trim()
    if (!question || call.status === 'loading') return
    setDraft('')
    setAsking((prev) => ({ id: (prev?.id ?? 0) + 1, question, history: turns }))
  }

  return (
    <div data-testid="FileEditBody.explain" className="flex flex-col gap-1.5">
      {!asking && turns.length === 0 && (
        <button
          type="button"
          data-testid="FileEditBody.explain.start"
          onClick={() => setAsking(FIRST_ASK)}
          className="self-start text-[11px] text-text-secondary hover:text-text-primary border border-border rounded-md px-2 py-1"
        >
          Explain this edit
        </button>
      )}

      {turns.map((turn, i) => (
        <div key={i} data-testid="FileEditBody.explain.turn" className="flex flex-col gap-1">
          {i > 0 && (
            <p className="text-[11px] text-text-secondary self-end max-w-[85%] text-right">
              {turn.question}
            </p>
          )}
          <p className="text-[12px] text-text-primary leading-snug bg-bg-primary rounded-md p-2 border border-border">
            {turn.answer}
          </p>
        </div>
      ))}

      {call.status === 'loading' && (
        <div className="flex flex-col gap-1">
          {turns.length > 0 && (
            <p className="text-[11px] text-text-secondary self-end max-w-[85%] text-right">
              {asking?.question}
            </p>
          )}
          <span data-testid="FileEditBody.explain.loading" className="text-[11px] text-text-muted">
            {turns.length === 0 ? 'Explaining…' : 'Thinking…'} {secondsLeft}s until timeout
          </span>
        </div>
      )}

      {call.status === 'error' && (
        <div className="flex flex-col gap-1.5">
          <span data-testid="FileEditBody.explain.error" className="text-[12px] text-danger">
            Couldn&apos;t answer: {call.message}
          </span>
          <button
            type="button"
            onClick={() => setAsking((prev) => (prev ? { ...prev, id: prev.id + 1 } : FIRST_ASK))}
            className="self-start text-[11px] text-text-secondary hover:text-text-primary border border-border rounded-md px-2 py-1"
          >
            Try again
          </button>
        </div>
      )}

      {turns.length > 0 && call.status === 'idle' && (
        <form onSubmit={ask} className="flex gap-1.5">
          <input
            data-testid="FileEditBody.explain.input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a follow-up about this edit…"
            className="flex-1 text-[12px] bg-bg-primary text-text-primary placeholder:text-text-muted rounded-md px-2 py-1 border border-border outline-none focus:border-text-secondary"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="text-[11px] text-text-secondary hover:text-text-primary border border-border rounded-md px-2 py-1 disabled:opacity-50"
          >
            Ask
          </button>
        </form>
      )}

      {call.status !== 'loading' && log.length > 0 && (
        <details open={call.status === 'error'} className="text-[11px] text-text-muted">
          <summary className="cursor-pointer select-none">Details</summary>
          <pre
            data-testid="FileEditBody.explain.log"
            className="mt-1 font-mono whitespace-pre-wrap break-words bg-bg-primary rounded-md p-2 border border-border"
          >
            {log.join('\n')}
          </pre>
        </details>
      )}
    </div>
  )
}
