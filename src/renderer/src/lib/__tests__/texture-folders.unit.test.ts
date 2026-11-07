import { beforeEach, describe, expect, it } from 'vitest'
import { ASSIGNABLE_TEXTURES, TEXTURE_FOLDERS } from '../app-texture'
import { reconcileFolders, useTextureFolders } from '../texture-folders'

const STORAGE = 'claudeui.textureFolders'

const allKinds = (folders: readonly { kinds: readonly string[] }[]): string[] =>
  folders.flatMap((folder) => folder.kinds).sort()

describe('the folder layout', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useTextureFolders.getState().resetFolders()
  })

  it('starts as the layout the app ships with', () => {
    const folders = useTextureFolders.getState().folders
    expect(folders.map((f) => f.name)).toEqual(TEXTURE_FOLDERS.map((f) => f.name))
    expect(allKinds(folders)).toEqual([...ASSIGNABLE_TEXTURES].sort())
  })

  it('keeps every texture in exactly one folder, whatever is stored', () => {
    const folders = reconcileFolders([
      { name: 'Mine', kinds: ['dots', 'dots', 'nope', 'hearts'] },
      { name: 'Mine', kinds: ['grid'] }
    ])
    expect(folders).toHaveLength(1)
    expect(folders[0].name).toBe('Mine')
    expect(folders[0].kinds.slice(0, 2)).toEqual(['dots', 'hearts'])
    expect(allKinds(folders)).toEqual([...ASSIGNABLE_TEXTURES].sort())
  })

  it('with nothing stored, gives the shipped folders, each with its own textures', () => {
    const folders = reconcileFolders(null)
    expect(folders.map((f) => f.name)).toEqual(TEXTURE_FOLDERS.map((f) => f.name))
    for (const shipped of TEXTURE_FOLDERS) {
      const mine = folders.find((f) => f.name === shipped.name)
      expect([...(mine?.kinds ?? [])].sort()).toEqual([...shipped.kinds].sort())
    }
  })

  it('a texture missing from the stored layout goes back to its shipped folder', () => {
    const folders = reconcileFolders([{ name: 'Patterns', kinds: [] }])
    const patterns = folders.find((f) => f.name === 'Patterns')
    expect(patterns?.kinds).toContain('dots')
    expect(patterns?.kinds).toContain('rain')
  })

  it('moves a texture into another folder, out of the one it was in', () => {
    const { moveTexture } = useTextureFolders.getState()
    moveTexture('dots', 'Tech')
    const { folders } = useTextureFolders.getState()
    expect(folders.find((f) => f.name === 'Tech')?.kinds).toContain('dots')
    expect(folders.find((f) => f.name === 'Patterns')?.kinds).not.toContain('dots')
    expect(allKinds(folders)).toEqual([...ASSIGNABLE_TEXTURES].sort())
  })

  it('renames a folder, but not to an empty or taken name', () => {
    const store = useTextureFolders.getState()
    store.renameFolder('Places', 'Scenery')
    expect(useTextureFolders.getState().folders.map((f) => f.name)).toContain('Scenery')
    store.renameFolder('Scenery', '  ')
    store.renameFolder('Scenery', 'Nature')
    expect(useTextureFolders.getState().folders.map((f) => f.name)).toContain('Scenery')
  })

  it('adds an empty folder, but not a duplicate', () => {
    const store = useTextureFolders.getState()
    store.addFolder('Retro')
    store.addFolder('Retro')
    store.addFolder('Nature')
    const names = useTextureFolders.getState().folders.map((f) => f.name)
    expect(names.filter((n) => n === 'Retro')).toHaveLength(1)
    expect(useTextureFolders.getState().folders.find((f) => f.name === 'Retro')?.kinds).toEqual([])
  })

  it('deleting a folder moves its textures to the first folder left', () => {
    const store = useTextureFolders.getState()
    const before = store.folders.find((f) => f.name === 'Tech')?.kinds ?? []
    store.deleteFolder('Tech')
    const { folders } = useTextureFolders.getState()
    expect(folders.some((f) => f.name === 'Tech')).toBe(false)
    expect(folders[0].kinds).toEqual(expect.arrayContaining(before))
    expect(allKinds(folders)).toEqual([...ASSIGNABLE_TEXTURES].sort())
  })

  it('never deletes the last folder', () => {
    const store = useTextureFolders.getState()
    for (const folder of TEXTURE_FOLDERS.slice(1)) store.deleteFolder(folder.name)
    store.deleteFolder(useTextureFolders.getState().folders[0].name)
    expect(useTextureFolders.getState().folders).toHaveLength(1)
  })

  it('remembers the layout on this device', () => {
    useTextureFolders.getState().moveTexture('dots', 'Tech')
    const saved = JSON.parse(window.localStorage.getItem(STORAGE) ?? 'null')
    expect(reconcileFolders(saved).find((f) => f.name === 'Tech')?.kinds).toContain('dots')
  })

  it('reset goes back to the shipped layout and forgets the saved one', () => {
    useTextureFolders.getState().moveTexture('dots', 'Tech')
    useTextureFolders.getState().resetFolders()
    expect(window.localStorage.getItem(STORAGE)).toBeNull()
    expect(
      useTextureFolders.getState().folders.find((f) => f.name === 'Patterns')?.kinds
    ).toContain('dots')
  })
})
