/**
 * Unit tests for the Files-viewer file server (file-view.ts).
 *
 * The security-critical properties: only the explicitly registered file is ever
 * served, only allowlisted types, symlinks can't smuggle in an unlisted type,
 * and a relative reference can't read anything else.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import { join } from 'path'
import { isViewHost, registerViewFile, resetViewFilesForTests, serveViewFile } from '../file-view'
import { isViewablePath } from '../../../shared/file-view'

const CSP = "default-src 'none'"

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(join(os.tmpdir(), 'file-view-'))
  resetViewFilesForTests()
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function register(name: string, body: string | Buffer = 'x'): string {
  const file = join(dir, name)
  fs.writeFileSync(file, body)
  const res = registerViewFile(file)
  if (!res.ok) throw new Error(res.error)
  return res.url
}

describe('registerViewFile', () => {
  it('returns a stable mockup-asset .v URL for an allowed file', () => {
    const a = register('page.html')
    const b = registerViewFile(join(dir, 'page.html'))
    expect(a).toMatch(/^mockup-asset:\/\/[a-f0-9]{16}\.v\/page\.html$/)
    expect(b).toEqual({ ok: true, url: a })
  })

  it('refuses relative paths, missing files, directories and UNC paths', () => {
    expect(registerViewFile('page.html')).toMatchObject({ ok: false })
    expect(registerViewFile(join(dir, 'nope.html'))).toMatchObject({ ok: false })
    expect(registerViewFile(dir)).toMatchObject({ ok: false })
    expect(registerViewFile('//host/share/page.html')).toMatchObject({ ok: false })
  })

  it('refuses types outside the allowlist', () => {
    const file = join(dir, 'secrets.env')
    fs.writeFileSync(file, 'KEY=1')
    expect(registerViewFile(file)).toMatchObject({ ok: false })
    const noExt = join(dir, 'credentials')
    fs.writeFileSync(noExt, 'x')
    expect(registerViewFile(noExt)).toMatchObject({ ok: false })
  })

  it('judges a symlink by its real target, not its name', () => {
    const target = join(dir, 'secrets.env')
    fs.writeFileSync(target, 'KEY=1')
    const link = join(dir, 'innocent.html')
    fs.symlinkSync(target, link)
    expect(registerViewFile(link)).toMatchObject({ ok: false })
  })
})

describe('serveViewFile', () => {
  it('serves the registered file with the CSP and nosniff', async () => {
    const url = new URL(register('page.html', '<h1>hi</h1>'))
    const res = await serveViewFile(url, CSP)
    expect(res.status).toBe(200)
    expect(res.headers['Content-Type']).toBe('text/html; charset=utf-8')
    expect(res.headers['Content-Security-Policy']).toBe(CSP)
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff')
    expect(String(res.body)).toBe('<h1>hi</h1>')
  })

  it('serves text-like files as text/plain, never as their own type', async () => {
    const res = await serveViewFile(new URL(register('data.json', '{}')), CSP)
    expect(res.headers['Content-Type']).toBe('text/plain; charset=utf-8')
  })

  it('serves the current bytes on every load', async () => {
    const url = new URL(register('page.html', 'one'))
    fs.writeFileSync(join(dir, 'page.html'), 'two')
    expect(String((await serveViewFile(url, CSP)).body)).toBe('two')
  })

  it('404s a sibling or any other path on the same origin', async () => {
    fs.writeFileSync(join(dir, 'style.css'), 'body{}')
    const url = new URL(register('page.html'))
    for (const p of ['/style.css', '/../style.css', '/%2e%2e/style.css', '/page.html/x']) {
      const res = await serveViewFile(new URL(p, url), CSP)
      expect(res.status).toBe(404)
    }
  })

  it('404s an unregistered id and rejects a malformed one', async () => {
    expect(
      (await serveViewFile(new URL('mockup-asset://0123456789abcdef.v/a.html'), CSP)).status
    ).toBe(404)
    expect((await serveViewFile(new URL('mockup-asset://nothex.v/a.html'), CSP)).status).toBe(400)
  })

  it('404s when the file has been deleted since registering', async () => {
    const url = new URL(register('page.html'))
    fs.rmSync(join(dir, 'page.html'))
    expect((await serveViewFile(url, CSP)).status).toBe(404)
  })
})

describe('helpers', () => {
  it('tells view hosts from mockup hosts', () => {
    expect(isViewHost('0123456789abcdef.v')).toBe(true)
    expect(isViewHost('01234567.m')).toBe(false)
  })

  it('isViewablePath is by extension, case-insensitive', () => {
    expect(isViewablePath('/a/B.HTML')).toBe(true)
    expect(isViewablePath('/a/report.docx')).toBe(false)
    expect(isViewablePath('/a/.html')).toBe(false)
  })
})
