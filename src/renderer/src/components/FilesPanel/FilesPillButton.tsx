import { useActiveSession, useSessionStore } from '../../stores/session-store'

/** Top-bar button that opens or closes the Files column. */
export function FilesPillButton(): React.JSX.Element {
  const rightPanel = useActiveSession((s) => s.rightPanel)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const openFilesPanel = useSessionStore((s) => s.openFilesPanel)
  const closeFilesPanel = useSessionStore((s) => s.closeFilesPanel)
  const isActive = rightPanel === 'files'

  return (
    <button
      data-testid="FilesPillButton"
      onClick={() => {
        if (!activeSessionId) return
        if (isActive) closeFilesPanel(activeSessionId)
        else openFilesPanel(activeSessionId)
      }}
      className={`px-2 py-1 rounded-md text-[12px] whitespace-nowrap transition-colors cursor-default ${
        isActive
          ? 'bg-bg-hover text-text-primary'
          : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
      }`}
      title="Files in this chat"
    >
      Files
    </button>
  )
}
