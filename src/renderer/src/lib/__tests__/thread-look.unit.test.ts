import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ASSIGNABLE_TEXTURES, TEXTURE_KINDS } from '../app-texture'
import { assignedTexture, resolveLook, useThreadLooks } from '../thread-look'
import { THREAD_HUES, threadHue } from '../thread-theme'

const STORAGE = 'claudeui.threadLooks'

describe('what a new chat is given', () => {
  it('the same texture every time for the same chat', () => {
    expect(assignedTexture('chat-1')).toBe(assignedTexture('chat-1'))
  })

  it('always a real texture, never "none"', () => {
    for (let i = 0; i < 200; i++) expect(ASSIGNABLE_TEXTURES).toContain(assignedTexture(`c-${i}`))
  })

  it('spreads over many textures, like a random pick', () => {
    const seen = new Set(
      Array.from({ length: 300 }, (_, i) => assignedTexture(`chat-${i}-x${i * 3}`))
    )
    expect(seen.size).toBeGreaterThanOrEqual(ASSIGNABLE_TEXTURES.length - 2)
  })

  it('is stars before any chat exists', () => {
    expect(assignedTexture(null)).toBe('stars')
  })

  it('"none" is handed out only once it is starred', () => {
    for (let i = 0; i < 100; i++) expect(assignedTexture(`c-${i}`, [])).not.toBe('none')
    for (let i = 0; i < 100; i++) expect(assignedTexture(`c-${i}`, ['none'])).toBe('none')
    expect(assignedTexture(null, ['none'])).toBe('none')
  })

  it('"none" shares the pool with other starred textures', () => {
    const seen = new Set(
      Array.from({ length: 200 }, (_, i) => assignedTexture(`chat-${i}`, ['none', 'hearts']))
    )
    expect([...seen].sort()).toEqual(['hearts', 'none'])
  })

  it("the color is the chat's own, apart from the texture", () => {
    const look = resolveLook('chat-9', {})
    expect(look.hue).toBe(threadHue('chat-9'))
    expect(look.texture).toBe(assignedTexture('chat-9'))
  })
})

describe("changing a chat's look", () => {
  beforeEach(() => {
    window.localStorage.clear()
    useThreadLooks.setState({ overrides: {} })
  })

  const look = (id: string) => resolveLook(id, useThreadLooks.getState().overrides)

  it('what a person changed wins over what the chat was given', () => {
    expect(resolveLook('a', { a: { hue: 300, texture: 'rain' } })).toEqual({
      hue: 300,
      texture: 'rain'
    })
  })

  it('a change to one part leaves the other as it was', () => {
    expect(resolveLook('a', { a: { hue: 300 } }).texture).toBe(assignedTexture('a'))
    expect(resolveLook('a', { a: { texture: 'rain' } }).hue).toBe(threadHue('a'))
  })

  it('sets a texture straight away, any of them, "none" too', () => {
    for (const kind of TEXTURE_KINDS) {
      useThreadLooks.getState().setTexture('a', kind)
      expect(look('a').texture).toBe(kind)
    }
  })

  it('sets a color straight away, any of the thread colors', () => {
    for (const hue of THREAD_HUES) {
      useThreadLooks.getState().setColor('a', hue)
      expect(look('a').hue).toBe(hue)
    }
  })

  it('setting the color keeps the texture, and the other way round', () => {
    useThreadLooks.getState().setTexture('a', 'rain')
    useThreadLooks.getState().setColor('a', 300)
    expect(look('a')).toEqual({ hue: 300, texture: 'rain' })
  })

  it('ignores a texture or color that is not on the list', () => {
    const before = look('a')
    useThreadLooks.getState().setTexture('a', 'plaid' as never)
    useThreadLooks.getState().setColor('a', 123)
    expect(look('a')).toEqual(before)
    expect(useThreadLooks.getState().overrides.a).toBeUndefined()
  })

  it("one chat's change does not touch another chat", () => {
    const before = look('b')
    useThreadLooks.getState().setTexture('a', 'rain')
    useThreadLooks.getState().setColor('a', 300)
    expect(look('b')).toEqual(before)
  })

  it('reset puts a chat back to the look it was given', () => {
    const start = look('a')
    useThreadLooks.getState().setTexture('a', start.texture === 'rain' ? 'grid' : 'rain')
    useThreadLooks.getState().setColor('a', start.hue === 300 ? 225 : 300)
    expect(look('a')).not.toEqual(start)
    useThreadLooks.getState().reset('a')
    expect(look('a')).toEqual(start)
    expect(useThreadLooks.getState().overrides.a).toBeUndefined()
  })

  it('reset of an untouched chat changes nothing', () => {
    const before = useThreadLooks.getState().overrides
    useThreadLooks.getState().reset('never-touched')
    expect(useThreadLooks.getState().overrides).toBe(before)
  })

  it('remembers changes on this device', () => {
    useThreadLooks.getState().setColor('a', 300)
    const saved = JSON.parse(window.localStorage.getItem(STORAGE) ?? '{}')
    expect(saved.a.hue).toBe(300)
  })

  it('a texture saved earlier that is no longer offered is dropped, not shown', async () => {
    window.localStorage.setItem(STORAGE, JSON.stringify({ a: { texture: 'scales', hue: 300 } }))
    vi.resetModules()
    const fresh = await import('../thread-look')
    const next = fresh.resolveLook('a', fresh.useThreadLooks.getState().overrides)
    expect(next.hue).toBe(300)
    expect(next.texture).toBe(fresh.assignedTexture('a'))
  })
})
