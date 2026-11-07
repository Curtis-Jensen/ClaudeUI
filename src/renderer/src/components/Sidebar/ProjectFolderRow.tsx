import { useState } from 'react'
import {
  SESSION_DRAG_TYPE,
  createProjectFolder,
  moveSessionToFolder,
  deleteProjectFolder,
  renameProjectFolder,
  toggleProjectFolderOpen,
  type ProjectFolder
} from '../../lib/project-folders'
import { useContextMenu } from '../../hooks/useContextMenu'

/** "+ Folder" in the Projects header: swaps itself for a name box until Enter or Escape. */
export function NewFolderButton(): React.JSX.Element {
  const [naming, setNaming] = useState(false)
  const [draft, setDraft] = useState('')

  const finish = (save: boolean): void => {
    if (save) createProjectFolder(draft)
    setDraft('')
    setNaming(false)
  }

  if (naming) {
    return (
      <input
        data-testid="Sidebar.newFolderInput"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(true)
          else if (e.key === 'Escape') finish(false)
        }}
        onBlur={() => finish(true)}
        placeholder="Folder name"
        className="w-24 bg-transparent border-b border-accent text-[10px] text-text-primary outline-none placeholder:text-text-muted/50"
      />
    )
  }
  return (
    <button
      type="button"
      data-testid="Sidebar.newFolder"
      onClick={() => setNaming(true)}
      className="text-[10px] text-text-muted hover:text-text-primary transition-colors cursor-default"
      title="Make a folder to tuck projects into"
    >
      + Folder
    </button>
  )
}

/** A user-made folder: a header that folds, with the projects filed in it underneath. */
export function ProjectFolderRow({
  folder,
  count,
  children
}: {
  folder: ProjectFolder
  count: number
  children: React.ReactNode
}): React.JSX.Element {
  const menu = useContextMenu()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')
  const [dropping, setDropping] = useState(false)

  const finishRename = (save: boolean): void => {
    if (save) renameProjectFolder(folder.id, draft)
    setRenaming(false)
  }

  const itemClass =
    'w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-default'

  return (
    <div data-testid="ProjectFolder" data-id={folder.id}>
      <div
        onClick={() => {
          if (!renaming) toggleProjectFolderOpen(folder.id)
        }}
        onContextMenu={menu.open}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(SESSION_DRAG_TYPE)) return
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'move'
          setDropping(true)
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          const id = e.dataTransfer.getData(SESSION_DRAG_TYPE)
          setDropping(false)
          if (!id) return
          e.preventDefault()
          // The plain list's drop would unfile the thread again.
          e.stopPropagation()
          moveSessionToFolder(id, folder.id)
        }}
        data-drop-target={dropping || undefined}
        style={{ padding: '0 5px' }}
        className={`flex items-center gap-2.5 h-8 rounded-md text-[13px] cursor-default transition-colors text-text-secondary hover:text-text-primary hover:bg-bg-hover ${dropping ? 'bg-bg-hover ring-1 ring-accent' : ''}`}
      >
        <span className="shrink-0 text-text-muted">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`transition-transform ${folder.open ? 'rotate-90' : ''}`}
          >
            <path d="M8 5l8 7-8 7z" />
          </svg>
        </span>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="shrink-0 text-accent"
        >
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        {renaming ? (
          <input
            data-testid="ProjectFolder.renameInput"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finishRename(true)
              else if (e.key === 'Escape') finishRename(false)
            }}
            onBlur={() => finishRename(true)}
            className="flex-1 min-w-0 bg-transparent border-b border-accent text-[13px] text-text-primary outline-none"
          />
        ) : (
          <span className="truncate flex-1">{folder.name}</span>
        )}
        <span className="text-[10px] text-text-muted">{count}</span>
      </div>
      {folder.open && (
        <div className="ml-3">
          {count === 0 ? (
            <div className="px-2 py-1 text-[11px] text-text-muted italic">
              Empty. Drag a thread here.
            </div>
          ) : (
            children
          )}
        </div>
      )}
      {menu.isOpen && (
        <div
          ref={menu.ref}
          role="menu"
          className="fixed z-50 min-w-[160px] py-1 rounded-lg bg-bg-tertiary border border-border shadow-lg"
          style={menu.style}
        >
          <button
            role="menuitem"
            className={itemClass}
            onClick={() => {
              menu.close()
              setDraft(folder.name)
              setRenaming(true)
            }}
          >
            Rename folder...
          </button>
          <button
            role="menuitem"
            data-testid="ProjectFolder.delete"
            className="w-full text-left px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-colors cursor-default"
            onClick={() => {
              menu.close()
              deleteProjectFolder(folder.id)
            }}
          >
            Delete folder (projects stay)
          </button>
        </div>
      )}
    </div>
  )
}
