/**
 * File types the in-app Files viewer can show, shared by main (what it will
 * serve) and the renderer (which rows get a "View" button).
 *
 * Dependency-free (no `node:path`) so it bundles into the web client too.
 * Everything not listed here is opaque to the viewer and only offers the
 * external "Open" action.
 */

/** Largest file the viewer will serve. Checked by `stat` before any read. */
export const MAX_VIEW_BYTES = 50 * 1024 * 1024

/** Extension → Content-Type the viewer serves it as. */
export const VIEW_EXT_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  // Text-like files are served as plain text, never as their "real" type, so a
  // .json or .md can't be sniffed into something executable.
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/plain; charset=utf-8',
  '.tsv': 'text/plain; charset=utf-8',
  '.json': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
}

/** Lower-cased extension including the dot, or '' when there is none. */
export function viewExtension(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot).toLowerCase() : ''
}

/** Whether the in-app viewer can show this path (by extension alone). */
export function isViewablePath(filePath: string): boolean {
  return viewExtension(filePath) in VIEW_EXT_MIME
}

/** Hostname suffix of a view-file origin: `mockup-asset://<id>.v/<name>`. */
export const VIEW_HOST_SUFFIX = '.v'
