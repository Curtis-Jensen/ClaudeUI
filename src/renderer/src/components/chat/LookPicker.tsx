import { useEffect, useRef, useState } from 'react'
import {
  ASSIGNABLE_TEXTURES,
  textureCss,
  textureLabel,
  type TextureKind
} from '../../lib/app-texture'
import { resolveLook, useThreadLooks } from '../../lib/thread-look'
import { useTextureFolders } from '../../lib/texture-folders'
import {
  THREAD_COLORS,
  threadAccent,
  threadSurfaces,
  threadSwatch,
  threadSwatchRing,
  baseHue,
  isBlack,
  BLACK_HUE
} from '../../lib/thread-theme'
import { useSessionStore } from '../../stores/session-store'

/**
 * One button in the face menu that opens a panel for this chat's look: every background texture
 * as a preview you can pick, the thread colors as swatches, and a reset to the look the chat
 * started with. The panel stays open while you try things, and closes on a click outside it,
 * on Escape, or on the button again.
 */
export function LookPicker({
  onOpenChange
}: {
  /** Told when the panel opens or closes, so the menu around it knows not to tuck itself away. */
  onOpenChange?: (open: boolean) => void
}): React.JSX.Element {
  const sessionId = useSessionStore((s) => s.activeSessionId)
  const overrides = useThreadLooks((s) => s.overrides)
  const setTexture = useThreadLooks((s) => s.setTexture)
  const setColor = useThreadLooks((s) => s.setColor)
  const reset = useThreadLooks((s) => s.reset)
  const favorites = useThreadLooks((s) => s.favorites)
  const toggleFavorite = useThreadLooks((s) => s.toggleFavorite)
  const clearFavorites = useThreadLooks((s) => s.clearFavorites)
  const hidden = useThreadLooks((s) => s.hidden)
  const hideTexture = useThreadLooks((s) => s.hideTexture)
  const restoreHidden = useThreadLooks((s) => s.restoreHidden)
  const folders = useTextureFolders((s) => s.folders)
  const renameFolder = useTextureFolders((s) => s.renameFolder)
  const addFolder = useTextureFolders((s) => s.addFolder)
  const deleteFolder = useTextureFolders((s) => s.deleteFolder)
  const moveTexture = useTextureFolders((s) => s.moveTexture)
  const resetFolders = useTextureFolders((s) => s.resetFolders)
  const { hue, texture } = resolveLook(sessionId, overrides, favorites, hidden)
  const changed = !!sessionId && !!overrides[sessionId]

  const [open, setOpen] = useState(false)
  // Folders the person opened or closed by hand; the rest start open only if they hold the
  // texture this chat has now.
  const [folderOpen, setFolderOpen] = useState<Record<string, boolean>>({})
  // Editing shows every folder open, with names, moves and the add and delete controls.
  const [editing, setEditing] = useState(false)
  const [newFolder, setNewFolder] = useState('')
  // The texture whose delete button has been pressed once; a second press deletes it.
  const [armed, setArmed] = useState<TextureKind | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const openChange = useRef(onOpenChange)
  openChange.current = onOpenChange

  const toggle = (next: boolean): void => {
    setOpen(next)
    setArmed(null)
    openChange.current?.(next)
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent): void => {
      if (root.current && !root.current.contains(e.target as Node)) toggle(false)
    }
    // Escape closes the panel and nothing else: it must not also stop a running turn.
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      toggle(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  // A closed panel must not leave the menu thinking it is open.
  useEffect(() => () => openChange.current?.(false), [])

  // Picks a random color and a random background: a starred one if any are starred, else any
  // that has not been deleted.
  const randomize = (): void => {
    if (!sessionId) return
    const visible = ASSIGNABLE_TEXTURES.filter((k) => !hidden.includes(k))
    const starred = visible.filter((k) => favorites.includes(k))
    const kinds = starred.length > 0 ? starred : visible
    const nextTexture = kinds[Math.floor(Math.random() * kinds.length)]
    const nextHue = THREAD_COLORS[Math.floor(Math.random() * THREAD_COLORS.length)]
    if (nextTexture) setTexture(sessionId, nextTexture)
    setColor(sessionId, nextHue)
  }

  const surface = threadSurfaces(hue)['--color-bg-primary']

  const tile = (kind: TextureKind, sessionId: string): React.JSX.Element => {
    const css = textureCss(kind, hue)
    const selected = kind === texture
    const starred = favorites.includes(kind)
    return (
      <div key={kind} className="group relative" onPointerLeave={() => setArmed(null)}>
        <button
          type="button"
          data-testid={`LookPicker.texture.${kind}`}
          aria-pressed={selected}
          onClick={() => setTexture(sessionId, kind)}
          title={textureLabel(kind)}
          className="flex w-full flex-col items-center gap-1 cursor-pointer"
        >
          <span
            className={`relative block h-10 w-full overflow-hidden rounded-md border ${
              selected ? 'border-[color:var(--thread-color,#fb923c)]' : 'border-border'
            }`}
            style={{
              backgroundColor: surface,
              ...(css
                ? {
                    backgroundImage: css.image,
                    backgroundSize: css.size,
                    backgroundPosition: css.position
                  }
                : {}),
              ...(selected ? { boxShadow: '0 0 0 1px var(--thread-color, #fb923c)' } : {})
            }}
          >
            {kind === 'none' && (
              <svg
                viewBox="0 0 40 40"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full text-text-muted"
              >
                <path d="M4 36L36 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            )}
          </span>
          <span
            className={`text-[9px] leading-none ${
              selected ? 'text-text-primary' : 'text-text-muted group-hover:text-text-primary'
            }`}
          >
            {textureLabel(kind)}
          </span>
        </button>
        <button
          type="button"
          data-testid={`LookPicker.favorite.${kind}`}
          aria-pressed={starred}
          aria-label={`${starred ? 'Unstar' : 'Star'} ${textureLabel(kind)}`}
          onClick={() => toggleFavorite(kind)}
          className={`absolute right-0.5 top-0.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-bg-secondary/80 text-[11px] leading-none transition-opacity focus-visible:opacity-100 group-hover:opacity-100 ${
            starred ? 'text-accent opacity-100' : 'text-text-muted opacity-0'
          }`}
        >
          {starred ? '★' : '☆'}
        </button>
        {kind !== 'none' && !selected && (
          <button
            type="button"
            data-testid={`LookPicker.delete.${kind}`}
            aria-label={
              armed === kind
                ? `Confirm delete ${textureLabel(kind)}`
                : `Delete ${textureLabel(kind)}`
            }
            title={armed === kind ? 'Click again to delete' : 'Delete this background'}
            onClick={() => {
              if (armed === kind) {
                setArmed(null)
                hideTexture(kind)
              } else setArmed(kind)
            }}
            className={`absolute left-0.5 top-0.5 flex h-4 cursor-pointer items-center justify-center rounded-full text-[10px] leading-none transition-opacity focus-visible:opacity-100 group-hover:opacity-100 ${
              armed === kind
                ? 'bg-red-600 px-1.5 text-white opacity-100'
                : 'w-4 bg-bg-secondary/80 text-text-muted opacity-0'
            }`}
          >
            {armed === kind ? 'Delete?' : '✕'}
          </button>
        )}
        {editing && (
          <select
            data-testid={`LookPicker.move.${kind}`}
            aria-label={`Folder for ${textureLabel(kind)}`}
            value={folders.find((folder) => folder.kinds.includes(kind))?.name ?? ''}
            onChange={(e) => moveTexture(kind, e.target.value)}
            className="mt-0.5 w-full cursor-pointer rounded bg-bg-tertiary text-[9px] text-text-secondary"
          >
            {folders.map((folder) => (
              <option key={folder.name} value={folder.name}>
                {folder.name}
              </option>
            ))}
          </select>
        )}
      </div>
    )
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-testid="LookPicker.button"
        data-enter-sends
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={!sessionId}
        onClick={() => toggle(!open)}
        title="Change this chat's background and color"
        className={`pointer-events-auto w-7 h-7 flex items-center justify-center rounded-full border border-border bg-bg-tertiary transition-colors cursor-pointer disabled:opacity-40 ${
          open ? 'text-accent' : 'text-text-muted hover:text-text-primary'
        }`}
      >
        <span
          aria-hidden
          className="block w-3.5 h-3.5 rounded-full border border-current"
          style={{ background: threadAccent(hue) }}
        />
      </button>

      {open && sessionId && (
        <div
          role="dialog"
          aria-label="Background and color"
          data-testid="LookPicker.panel"
          // Enter belongs to the chat while focus is anywhere in here.
          data-enter-sends
          className="pointer-events-auto absolute bottom-full right-0 mb-2 z-30 max-h-[420px] w-[272px] overflow-y-auto rounded-xl border border-border-bright bg-bg-secondary p-3 shadow-xl animate-fade-in"
        >
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Background
          </div>
          <p className="mb-1.5 text-[10px] leading-tight text-text-muted">
            {favorites.length
              ? 'New chats only get your starred backgrounds.'
              : 'Star a few (☆) and new chats only get those.'}
          </p>
          {folders.map((folder) => {
            const kinds = folder.kinds.filter((k) => !hidden.includes(k))
            if (!kinds.length && !editing) return null
            const stars = kinds.filter((k) => favorites.includes(k)).length
            const isOpen = editing || (folderOpen[folder.name] ?? kinds.includes(texture))
            return (
              <div
                key={folder.name}
                data-testid={`LookPicker.folder.${folder.name}`}
                className="mb-1.5"
              >
                {editing ? (
                  <div className="mb-1 flex items-center gap-1">
                    <input
                      key={folder.name}
                      aria-label={`Name of folder ${folder.name}`}
                      defaultValue={folder.name}
                      onBlur={(e) => renameFolder(folder.name, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                      }}
                      className="min-w-0 flex-1 rounded bg-bg-tertiary px-1 text-[11px] text-text-primary"
                    />
                    <button
                      type="button"
                      aria-label={`Delete folder ${folder.name}`}
                      title="Delete this folder; its backgrounds move to the first folder"
                      disabled={folders.length <= 1}
                      onClick={() => deleteFolder(folder.name)}
                      className="cursor-pointer px-1 text-[11px] text-text-muted hover:text-text-primary disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setFolderOpen((o) => ({ ...o, [folder.name]: !isOpen }))}
                    className="mb-1 flex w-full cursor-pointer items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary"
                  >
                    <span aria-hidden className="w-2.5 text-[9px]">
                      {isOpen ? '▾' : '▸'}
                    </span>
                    <span>{folder.name}</span>
                    {stars > 0 && <span className="text-accent">★ {stars}</span>}
                  </button>
                )}
                <div hidden={!isOpen} className="grid grid-cols-4 gap-1.5">
                  {kinds.map((kind) => tile(kind, sessionId))}
                </div>
              </div>
            )
          })}
          {editing && (
            <form
              className="mb-1.5 flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                addFolder(newFolder)
                setNewFolder('')
              }}
            >
              <input
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                placeholder="New folder name"
                aria-label="New folder name"
                className="min-w-0 flex-1 rounded bg-bg-tertiary px-1 text-[11px] text-text-primary placeholder:text-text-muted"
              />
              <button
                type="submit"
                disabled={!newFolder.trim()}
                className="cursor-pointer px-1 text-[11px] text-text-secondary hover:text-text-primary disabled:opacity-40"
              >
                Add
              </button>
            </form>
          )}
          <div className="grid grid-cols-4 gap-1.5">{tile('none', sessionId)}</div>
          {hidden.length > 0 && (
            <button
              type="button"
              data-testid="LookPicker.restoreHidden"
              onClick={restoreHidden}
              className="mt-2 block cursor-pointer text-[10px] text-text-muted underline hover:text-text-primary"
            >
              Bring back {hidden.length} deleted{' '}
              {hidden.length === 1 ? 'background' : 'backgrounds'}
            </button>
          )}
          {favorites.length > 0 && (
            <button
              type="button"
              data-testid="LookPicker.clearFavorites"
              onClick={clearFavorites}
              className="mt-2 cursor-pointer text-[10px] text-text-muted underline hover:text-text-primary"
            >
              Clear stars (use every background)
            </button>
          )}
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              data-testid="LookPicker.editFolders"
              aria-pressed={editing}
              onClick={() => setEditing((on) => !on)}
              className="cursor-pointer text-[10px] text-text-muted underline hover:text-text-primary"
            >
              {editing ? 'Done editing folders' : 'Edit folders'}
            </button>
            {editing && (
              <button
                type="button"
                data-testid="LookPicker.resetFolders"
                onClick={resetFolders}
                className="cursor-pointer text-[10px] text-text-muted underline hover:text-text-primary"
              >
                Reset folders
              </button>
            )}
          </div>

          <div className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Color
          </div>
          <div className="flex flex-wrap gap-1.5">
            {THREAD_COLORS.map((h) => (
              <button
                key={h}
                type="button"
                data-testid={`LookPicker.color.${h}`}
                aria-pressed={h === hue}
                aria-label={
                  h === BLACK_HUE ? 'Color black' : isBlack(h) ? `Color black ${baseHue(h)}` : `Color ${h}`
                }
                onClick={() => setColor(sessionId, h)}
                className="h-5 w-5 cursor-pointer rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: threadSwatch(h),
                  borderColor:
                    h === hue
                      ? 'var(--color-text-primary)'
                      : isBlack(h)
                        ? threadSwatchRing(h)
                        : 'transparent'
                }}
              />
            ))}
          </div>

          <button
            type="button"
            data-testid="LookPicker.randomize"
            onClick={randomize}
            className="mt-3 w-full cursor-pointer rounded-md border border-border py-1 text-[11px] text-text-secondary transition-colors hover:text-text-primary"
          >
            Randomize background and color
          </button>

          <button
            type="button"
            data-testid="LookPicker.reset"
            disabled={!changed}
            onClick={() => reset(sessionId)}
            className="mt-1.5 w-full rounded-md border border-border py-1 text-[11px] text-text-muted transition-colors enabled:cursor-pointer enabled:hover:text-text-primary disabled:opacity-40"
          >
            {changed ? 'Back to how this chat started' : 'This chat looks as it started'}
          </button>
        </div>
      )}
    </div>
  )
}
