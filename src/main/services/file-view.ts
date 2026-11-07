/**
 * Serves ONE user-chosen local file to the in-app Files viewer.
 *
 * Rides on the privileged `mockup-asset://` scheme (see mockup-protocol.ts) so
 * model-authored HTML gets the same posture mockups do: its own sub-origin
 * (`<id>.v`) and the mockup Content-Security-Policy. Unlike a mockup there is
 * no directory to serve from: a file is registered explicitly, and the handler
 * only ever returns that exact file — never a sibling, never another path.
 *
 * No Electron imports, so it unit-tests without booting an app. The CSP is
 * passed in by the protocol handler (which owns the mockup settings).
 */

import { randomBytes } from 'node:crypto'
import { promises as fs, realpathSync, statSync } from 'node:fs'
import path from 'node:path'
import { MOCKUP_ASSET_SCHEME } from '../../shared/mockup-url'
import {
  MAX_VIEW_BYTES,
  VIEW_EXT_MIME,
  VIEW_HOST_SUFFIX,
  viewExtension
} from '../../shared/file-view'
import { validateLocalFilePath } from '../../core/shell-security'

const ID_RE = /^[a-f0-9]{16}$/

/** id → real (symlink-resolved) path, and the reverse so a path keeps one origin. */
const idToPath = new Map<string, string>()
const pathToId = new Map<string, string>()

export type RegisterViewResult = { ok: true; url: string } | { ok: false; error: string }

/**
 * Validate `rawPath` and hand back the `mockup-asset://` URL that serves it.
 *
 * Layers, in order: the shared local-file guard (absolute, non-UNC, existing
 * regular file), the extension allowlist on the REAL path (a symlink named
 * `x.html` pointing at an unlisted type is refused), and a size cap.
 */
export function registerViewFile(rawPath: string): RegisterViewResult {
  const base = validateLocalFilePath(rawPath)
  if (!base.ok) return base
  let real: string
  try {
    real = realpathSync(base.path)
  } catch {
    return { ok: false, error: 'File does not exist' }
  }
  if (!(viewExtension(real) in VIEW_EXT_MIME)) {
    return { ok: false, error: 'This file type cannot be shown in the app' }
  }
  let size: number
  try {
    size = statSync(real).size
  } catch {
    return { ok: false, error: 'File does not exist' }
  }
  if (size > MAX_VIEW_BYTES) {
    return {
      ok: false,
      error: `File is too large to show (max ${Math.round(MAX_VIEW_BYTES / (1024 * 1024))} MB)`
    }
  }
  let id = pathToId.get(real)
  if (!id) {
    id = randomBytes(8).toString('hex')
    pathToId.set(real, id)
    idToPath.set(id, real)
  }
  // The trailing name is cosmetic (tab title, PDF viewer) but is also checked
  // on serve, so a relative reference like ./style.css 404s instead of
  // receiving the page back.
  return {
    ok: true,
    url: `${MOCKUP_ASSET_SCHEME}://${id}${VIEW_HOST_SUFFIX}/${encodeURIComponent(path.basename(real))}`
  }
}

export interface ServedViewFile {
  status: number
  headers: Record<string, string>
  body: Buffer | string
}

const notFound = (status = 404, reason = 'Not found'): ServedViewFile => ({
  status,
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  body: reason
})

/** Whether a `mockup-asset` URL addresses a view file rather than a mockup. */
export function isViewHost(hostname: string): boolean {
  return hostname.endsWith(VIEW_HOST_SUFFIX)
}

/** Serve the registered file for `url`, or a plain-text error. Never throws. */
export async function serveViewFile(url: URL, csp: string): Promise<ServedViewFile> {
  try {
    const id = url.hostname.slice(0, -VIEW_HOST_SUFFIX.length)
    if (!ID_RE.test(id)) return notFound(400, 'invalid id')
    const file = idToPath.get(id)
    if (!file) return notFound()

    const wanted = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    if (wanted !== '' && wanted !== path.basename(file)) return notFound()

    const mime = VIEW_EXT_MIME[viewExtension(file)]
    if (!mime) return notFound(403, 'file type not allowed')

    const stat = await fs.stat(file)
    if (!stat.isFile()) return notFound()
    if (stat.size > MAX_VIEW_BYTES) return notFound(413, 'File too large')

    return {
      status: 200,
      headers: {
        'Content-Type': mime,
        // Re-read on every load so Reload shows the file as it is now.
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        // Documents that can run script get the mockup CSP; it is harmless on
        // the rest.
        'Content-Security-Policy': csp
      },
      body: await fs.readFile(file)
    }
  } catch (e) {
    // A file deleted since it was registered is an ordinary miss, not a fault.
    return (e as NodeJS.ErrnoException)?.code === 'ENOENT'
      ? notFound()
      : notFound(500, 'Server error')
  }
}

/** Test seam: forget every registration. */
export function resetViewFilesForTests(): void {
  idToPath.clear()
  pathToId.clear()
}
