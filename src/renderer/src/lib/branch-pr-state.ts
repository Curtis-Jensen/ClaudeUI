import { useEffect, useState } from 'react'
import type { BranchPrInfo } from '../../../shared/types'

const TTL_MS = 120_000
const NONE: BranchPrInfo = { state: 'none', url: null }

const cache = new Map<string, { info: BranchPrInfo; at: number }>()
const inFlight = new Map<string, Promise<BranchPrInfo>>()

/** One `gh` call per directory per TTL, shared by every row that sits in it. */
function loadPr(cwd: string): Promise<BranchPrInfo> {
  const hit = cache.get(cwd)
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.info)
  const pending = inFlight.get(cwd)
  if (pending) return pending
  const request = (window.api?.gitGetPrState?.(cwd) ?? Promise.resolve(NONE))
    .catch(() => NONE)
    .then((reply) => {
      // A main process older than this renderer answers with a bare string: no PR info, not a PR.
      const info = reply && typeof reply === 'object' && 'state' in reply ? reply : NONE
      cache.set(cwd, { info, at: Date.now() })
      inFlight.delete(cwd)
      return info
    })
  inFlight.set(cwd, request)
  return request
}

/** The pull request of the branch checked out in `cwd`; `none` until known or when there is no PR. */
export function useBranchPr(cwd: string | undefined): BranchPrInfo {
  const [info, setInfo] = useState<BranchPrInfo>(() => (cwd && cache.get(cwd)?.info) || NONE)
  useEffect(() => {
    if (!cwd) return
    let live = true
    const refresh = (): void => {
      void loadPr(cwd).then((next) => {
        if (live) setInfo(next)
      })
    }
    refresh()
    const timer = setInterval(refresh, TTL_MS)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [cwd])
  return cwd ? info : NONE
}
