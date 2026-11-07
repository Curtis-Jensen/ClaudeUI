import { useMemo, useState } from 'react'
import { useActiveSession, useSessionStore } from '../../stores/session-store'
import { fileBasename } from '../../../../shared/file-mime'
import { resolveSentFilePath } from '../../../../shared/sent-file-path'
import { isViewablePath } from '../../../../shared/file-view'
import { deriveChatFiles } from './derive-chat-files'
import { FileViewer } from './FileViewer'

interface Props {
  style?: React.CSSProperties
}

const KIND_LABEL = { sent: 'Sent', artifact: 'Artifact', written: 'Created', upload: 'Uploaded' }

const BTN =
  'text-[11px] px-2 py-0.5 rounded border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer'

/** Right column listing every file in the chat; "View" opens one in the in-app viewer. */
export function FilesPanel({ style }: Props): React.JSX.Element {
  const messages = useActiveSession((s) => s.messages)
  const cwd = useActiveSession((s) => s.cwd)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const closeFilesPanel = useSessionStore((s) => s.closeFilesPanel)
  const rows = useMemo(() => deriveChatFiles(messages), [messages])
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Absolute path of the file shown in the in-app viewer, or null for the list.
  const [viewing, setViewing] = useState<string | null>(null)

  const run = async (
    path: string,
    action: ((p: string) => Promise<{ error?: string }>) | undefined
  ): Promise<void> => {
    if (!action) return
    try {
      const res = await action(path)
      setErrors((prev) => ({ ...prev, [path]: res?.error ?? '' }))
    } catch (e) {
      setErrors((prev) => ({ ...prev, [path]: e instanceof Error ? e.message : String(e) }))
    }
  }

  return (
    <div
      data-testid="FilesPanel"
      style={style}
      className="shrink-0 border-l border-border bg-bg-secondary flex flex-col h-full overflow-hidden"
    >
      <div className="shrink-0 flex items-center px-4 h-12 border-b border-border [-webkit-app-region:drag]">
        <span className="text-[13px] text-text-secondary font-medium flex-1">
          Files <span className="font-mono text-text-muted">{rows.length}</span>
        </span>
        <button
          data-testid="FilesPanel.close"
          onClick={() => activeSessionId && closeFilesPanel(activeSessionId)}
          className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-default [-webkit-app-region:no-drag]"
          title="Close"
        >
          ✕
        </button>
      </div>
      {viewing && <FileViewer absPath={viewing} onBack={() => setViewing(null)} />}
      <div className="flex-1 min-h-0 overflow-y-auto" hidden={viewing !== null}>
        {rows.length === 0 && (
          <div className="p-4 text-[12px] text-text-muted">
            No files in this chat yet. Files you attach, artifacts, and files Claude sends will show
            here.
          </div>
        )}
        {rows.map((row) => {
          const abs = resolveSentFilePath(cwd, row.path)
          return (
            <div key={row.path} className="px-4 py-2.5 border-b border-border">
              <div className="flex items-baseline gap-2">
                <span className="flex-1 min-w-0 text-[12px] text-text-primary truncate" title={abs}>
                  {fileBasename(row.path)}
                </span>
                <span className="text-[10px] text-text-muted uppercase tracking-wide">
                  {KIND_LABEL[row.kind]}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <button
                  data-testid="FilesPanel.view"
                  className={`${BTN} disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent`}
                  disabled={!isViewablePath(row.path)}
                  title={
                    isViewablePath(row.path)
                      ? undefined
                      : 'This file type can only be opened externally'
                  }
                  onClick={() => setViewing(abs)}
                >
                  Open internally
                </button>
                <button
                  data-testid="FilesPanel.open"
                  className={BTN}
                  onClick={() => void run(abs, window.api?.openPath)}
                >
                  Open externally
                </button>
                <button className={BTN} onClick={() => void run(abs, window.api?.showInFolder)}>
                  Show in folder
                </button>
                {row.url && (
                  <a className={BTN} href={row.url} target="_blank" rel="noopener noreferrer">
                    Artifact link
                  </a>
                )}
              </div>
              {errors[abs] && <div className="mt-1 text-[11px] text-error">{errors[abs]}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
