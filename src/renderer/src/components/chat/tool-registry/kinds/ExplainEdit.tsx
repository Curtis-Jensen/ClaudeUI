/**
 * The Explain box under an edit card's diff: a plain-English Haiku summary of
 * the edit, requested the moment the card opens (this body only mounts while
 * the card is open; closing unmounts it and a reopen asks again).
 *
 * While waiting it counts down to the host's timeout. Whatever happens, the
 * "Details" panel shows the host's timestamped trace plus this side's own
 * lines, so a stall or error can be traced without opening the app log.
 */

import { useEffect, useState } from 'react'
import { EDIT_SUMMARY_TIMEOUT_MS } from '../../../../../../shared/edit-summary'

/** The host aborts at the timeout; this side waits a little longer, then gives up itself. */
const BACKSTOP_GRACE_MS = 5_000

type ExplainState =
  | { status: 'loading'; startedAt: number }
  | { status: 'done'; text: string; log: string[] }
  | { status: 'error'; message: string; log: string[] }

export function ExplainEdit({
  path,
  before,
  after
}: {
  path: string
  before: string
  after: string
}): React.JSX.Element {
  const [state, setState] = useState<ExplainState>(() => ({
    status: 'loading',
    startedAt: Date.now()
  }))
  const [now, setNow] = useState(() => Date.now())
  // Bumped by the retry button; the effect below runs once per attempt.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const startedAt = Date.now()
    let settled = false
    const stamp = (line: string): string =>
      `+${((Date.now() - startedAt) / 1000).toFixed(1)}s renderer: ${line}`

    setState({ status: 'loading', startedAt })
    setNow(startedAt)
    const tick = setInterval(() => setNow(Date.now()), 1000)

    const settle = (next: ExplainState): void => {
      if (settled) return
      settled = true
      clearInterval(tick)
      clearTimeout(backstop)
      setState(next)
    }

    const backstop = setTimeout(
      () =>
        settle({
          status: 'error',
          message: `No reply from the app after ${(EDIT_SUMMARY_TIMEOUT_MS + BACKSTOP_GRACE_MS) / 1000}s`,
          log: [stamp('asked the app'), stamp('gave up waiting')]
        }),
      EDIT_SUMMARY_TIMEOUT_MS + BACKSTOP_GRACE_MS
    )

    // `Promise.resolve().then` so a synchronous throw (an older preload with no
    // `explainEdit`) lands in the error state instead of crashing the card.
    Promise.resolve()
      .then(() => window.api.explainEdit(path, before, after))
      .then((result) => {
        const log = [stamp('asked the app'), ...(result?.log ?? []), stamp('got the answer')]
        if (result?.text) settle({ status: 'done', text: result.text, log })
        else settle({ status: 'error', message: result?.error ?? 'No summary came back', log })
      })
      .catch((err: unknown) =>
        settle({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
          log: [stamp('asked the app'), stamp(`call failed: ${String(err)}`)]
        })
      )

    return () => {
      settled = true
      clearInterval(tick)
      clearTimeout(backstop)
    }
  }, [path, before, after, attempt])

  const secondsLeft =
    state.status === 'loading'
      ? Math.max(0, Math.ceil((EDIT_SUMMARY_TIMEOUT_MS - (now - state.startedAt)) / 1000))
      : 0

  return (
    <div data-testid="FileEditBody.explain" className="flex flex-col gap-1.5">
      {state.status === 'loading' && (
        <span data-testid="FileEditBody.explain.loading" className="text-[11px] text-text-muted">
          Explaining… {secondsLeft}s until timeout
        </span>
      )}

      {state.status === 'done' && (
        <p className="text-[12px] text-text-primary leading-snug bg-bg-primary rounded-md p-2 border border-border">
          {state.text}
        </p>
      )}

      {state.status === 'error' && (
        <div className="flex flex-col gap-1.5">
          <span data-testid="FileEditBody.explain.error" className="text-[12px] text-danger">
            Couldn&apos;t explain: {state.message}
          </span>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="self-start text-[11px] text-text-secondary hover:text-text-primary border border-border rounded-md px-2 py-1"
          >
            Try again
          </button>
        </div>
      )}

      {state.status !== 'loading' && (
        <details open={state.status === 'error'} className="text-[11px] text-text-muted">
          <summary className="cursor-pointer select-none">Details</summary>
          <pre
            data-testid="FileEditBody.explain.log"
            className="mt-1 font-mono whitespace-pre-wrap break-words bg-bg-primary rounded-md p-2 border border-border"
          >
            {state.log.join('\n')}
          </pre>
        </details>
      )}
    </div>
  )
}
