import { useEffect, useState } from 'react'
import { fileBasename } from '../../../../shared/file-mime'
import { MOCKUP_IFRAME_SANDBOX } from '../mockup-transport'

interface Props {
  /** Absolute path, already resolved against the session cwd. */
  absPath: string
  onBack: () => void
}

const BTN =
  'text-[11px] px-2 py-0.5 rounded border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer'

type Load =
  { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error'; error: string }

/**
 * Shows one chat file inside the Files panel. Main validates the path and
 * serves exactly that file from its own sandboxed `mockup-asset://` origin
 * (file-view.ts); this just frames it. HTML runs under the mockup CSP, so an
 * artifact behaves here as it would as a mockup.
 */
export function FileViewer({ absPath, onBack }: Props): React.JSX.Element {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  // Bumping this remounts the iframe, which refetches the file (no-store).
  const [reloadKey, setReloadKey] = useState(0)
  const [openError, setOpenError] = useState('')
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoad({ status: 'loading' })
    const getUrl = window.api?.getFileViewUrl
    if (!getUrl) {
      setLoad({
        status: 'error',
        error:
          'The in-app viewer needs a restart of ClaudeUI to load. Quit and reopen the app, then try again.'
      })
      return
    }
    getUrl(absPath)
      .then((res) => {
        if (cancelled) return
        setLoad('url' in res ? { status: 'ready', url: res.url } : { status: 'error', ...res })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setLoad({ status: 'error', error: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      cancelled = true
    }
  }, [absPath])

  const openExternally = async (): Promise<void> => {
    const res = await window.api?.openPath?.(absPath)
    setOpenError(res?.error ?? '')
  }

  // Fullscreen is the same element restyled to cover the window, not a second
  // render, so the iframe keeps its state and doesn't refetch the file.
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  return (
    <div
      data-testid="FileViewer"
      data-fullscreen={fullscreen || undefined}
      className={
        fullscreen
          ? 'fixed inset-0 z-50 flex flex-col bg-bg-secondary'
          : 'flex flex-col flex-1 min-h-0'
      }
    >
      {/* Fullscreen covers the window's title bar, so the bar is a drag handle
          and starts clear of the macOS traffic lights. */}
      <div
        className={`shrink-0 flex items-center gap-1.5 px-3 border-b border-border ${
          fullscreen
            ? 'h-12 pl-20 [-webkit-app-region:drag] [&>*]:[-webkit-app-region:no-drag]'
            : 'h-9'
        }`}
      >
        <button data-testid="FileViewer.back" className={BTN} onClick={onBack}>
          ← Files
        </button>
        <span className="flex-1 min-w-0 text-[12px] text-text-primary truncate" title={absPath}>
          {fileBasename(absPath)}
        </span>
        <button
          data-testid="FileViewer.reload"
          className={BTN}
          onClick={() => setReloadKey((k) => k + 1)}
        >
          Reload
        </button>
        <button
          data-testid="FileViewer.fullscreen"
          className={BTN}
          onClick={() => setFullscreen((f) => !f)}
          title={fullscreen ? 'Back to the panel (Esc)' : 'Fill the whole window'}
        >
          {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </button>
        {typeof window.api?.openPath === 'function' && (
          <button className={BTN} onClick={() => void openExternally()}>
            Open externally
          </button>
        )}
      </div>
      {openError && <div className="px-3 py-1 text-[11px] text-error">{openError}</div>}
      <div className="flex-1 min-h-0 bg-white">
        {load.status === 'loading' && (
          <div className="p-4 text-[12px] text-text-muted bg-bg-secondary h-full">Loading…</div>
        )}
        {load.status === 'error' && (
          <div
            data-testid="FileViewer.error"
            className="p-4 text-[12px] text-error bg-bg-secondary h-full"
          >
            {load.error}
          </div>
        )}
        {load.status === 'ready' && (
          <iframe
            key={reloadKey}
            data-testid="FileViewer.frame"
            src={load.url}
            title={fileBasename(absPath)}
            sandbox={MOCKUP_IFRAME_SANDBOX}
            className="w-full h-full border-0"
          />
        )}
      </div>
    </div>
  )
}
