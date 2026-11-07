import { beforeEach, describe, expect, it } from 'vitest'
import {
  createProjectFolder,
  deleteProjectFolder,
  moveProjectToFolder,
  moveSessionToFolder,
  renameProjectFolder,
  resetProjectFoldersForTests,
  toggleProjectFolderOpen
} from '../project-folders'

const KEY = 'sidebar.projectFolders'
const read = (): {
  folders: { id: string; name: string; open: boolean }[]
  assignments: Record<string, string>
  sessionAssignments?: Record<string, string>
} => JSON.parse(localStorage.getItem(KEY) ?? '{"folders":[],"assignments":{}}')

describe('project folders', () => {
  beforeEach(() => {
    localStorage.clear()
    resetProjectFoldersForTests()
  })

  it('makes a trimmed folder and refuses a blank name', () => {
    expect(createProjectFolder('   ')).toBeNull()
    const id = createProjectFolder('  Parked  ')
    expect(read().folders).toEqual([{ id, name: 'Parked', open: true }])
  })

  it('files a project in one folder at a time and brings it back', () => {
    const a = createProjectFolder('A')!
    const b = createProjectFolder('B')!
    moveProjectToFolder('proj', a)
    moveProjectToFolder('proj', b)
    expect(read().assignments).toEqual({ proj: b })
    moveProjectToFolder('proj', null)
    expect(read().assignments).toEqual({})
  })

  it('ignores a move into a folder that does not exist', () => {
    moveProjectToFolder('proj', 'nope')
    expect(read().assignments).toEqual({})
  })

  it('renames and folds a folder', () => {
    const id = createProjectFolder('A')!
    renameProjectFolder(id, 'Archive')
    toggleProjectFolderOpen(id)
    expect(read().folders[0]).toEqual({ id, name: 'Archive', open: false })
  })

  it('deleting a folder releases its projects instead of removing them', () => {
    const a = createProjectFolder('A')!
    const b = createProjectFolder('B')!
    moveProjectToFolder('p1', a)
    moveProjectToFolder('p2', b)
    deleteProjectFolder(a)
    expect(read().folders.map((f) => f.id)).toEqual([b])
    expect(read().assignments).toEqual({ p2: b })
  })

  it('survives unreadable storage', () => {
    localStorage.setItem(KEY, '{not json')
    resetProjectFoldersForTests()
    expect(createProjectFolder('A')).not.toBeNull()
  })

  it('files a single thread, moves it between folders and takes it back out', () => {
    const a = createProjectFolder('A')!
    const b = createProjectFolder('B')!
    moveSessionToFolder('s1', a)
    moveSessionToFolder('s1', b)
    expect(read().sessionAssignments).toEqual({ s1: b })
    moveSessionToFolder('s1', null)
    expect(read().sessionAssignments).toEqual({})
  })

  it('deleting a folder releases its threads too', () => {
    const a = createProjectFolder('A')!
    moveSessionToFolder('s1', a)
    deleteProjectFolder(a)
    expect(read().sessionAssignments).toEqual({})
  })
})
