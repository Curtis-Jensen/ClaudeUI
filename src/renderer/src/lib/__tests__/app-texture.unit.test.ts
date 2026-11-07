import { describe, expect, it } from 'vitest'
import {
  ASSIGNABLE_TEXTURES,
  TEXTURE_KINDS,
  textureCss,
  textureLabel,
  type TextureKind
} from '../app-texture'

const decode = (image: string): string =>
  decodeURIComponent(image.slice('url("data:image/svg+xml,'.length, -2))

const REAL = ASSIGNABLE_TEXTURES

describe('the texture catalogue', () => {
  it('has a good many textures, and "none" comes last', () => {
    expect(REAL.length).toBeGreaterThanOrEqual(11)
    expect(TEXTURE_KINDS.at(-1)).toBe('none')
    expect(new Set(TEXTURE_KINDS).size).toBe(TEXTURE_KINDS.length)
  })

  it('a chat is never given "none" on its own', () => {
    expect(ASSIGNABLE_TEXTURES).not.toContain('none')
    expect(ASSIGNABLE_TEXTURES.length).toBe(TEXTURE_KINDS.length - 1)
  })

  it('scales are gone: Curtis does not like them', () => {
    expect(TEXTURE_KINDS as readonly string[]).not.toContain('scales')
  })

  it('every texture has a name', () => {
    for (const kind of TEXTURE_KINDS) expect(textureLabel(kind).length).toBeGreaterThan(2)
    expect(textureLabel('none')).toBe('No texture')
  })
})

describe('textureCss', () => {
  it('is nothing for no texture', () => {
    expect(textureCss('none', 27)).toBeNull()
  })

  it.each(REAL as TextureKind[])('%s is a tiled svg picture in the chat color', (kind) => {
    const css = textureCss(kind, 200)!
    const svg = decode(css.image)
    expect(css.image).toMatch(/^url\("data:image\/svg\+xml,/)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('hsl(200 ')
    // The size handed to the stylesheet is the size drawn; a scene covers the window instead.
    if (css.size === 'cover') return
    const [w, h] = css.size.split(' ').map((n) => parseInt(n, 10))
    expect(svg).toContain(`width="${w}"`)
    expect(svg).toContain(`height="${h}"`)
  })

  it.each(REAL as TextureKind[])('%s is the same every time', (kind) => {
    expect(textureCss(kind, 27)).toEqual(textureCss(kind, 27))
  })

  it.each(REAL as TextureKind[])('%s takes its color from the hue', (kind) => {
    expect(textureCss(kind, 27)!.image).not.toBe(textureCss(kind, 225)!.image)
  })

  it.each(REAL as TextureKind[])('%s stays faint: nothing in it is near solid', (kind) => {
    const alphas = [...decode(textureCss(kind, 27)!.image).matchAll(/ \/ ([\d.]+)\)/g)].map((m) =>
      Number(m[1])
    )
    expect(alphas.length).toBeGreaterThan(0)
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0.4)
  })

  it('the textures are all different from one another', () => {
    const pictures = REAL.map((kind) => textureCss(kind, 27)!.image)
    expect(new Set(pictures).size).toBe(REAL.length)
  })
})
