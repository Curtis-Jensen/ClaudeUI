import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useTextureFolders } from '../../../lib/texture-folders'
import { useThreadLooks } from '../../../lib/thread-look'
import { useSessionStore } from '../../../stores/session-store'
import { LookPicker } from '../LookPicker'

const ID = 'chat-folders'

const openEditor = (): void => {
  fireEvent.click(screen.getByTestId('LookPicker.button'))
  fireEvent.click(screen.getByTestId('LookPicker.editFolders'))
}

describe('LookPicker folder editing', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useTextureFolders.getState().resetFolders()
    useThreadLooks.setState({ overrides: {}, favorites: [], hidden: [] })
    useSessionStore.setState({ activeSessionId: ID })
  })
  afterEach(() => {
    cleanup()
    useSessionStore.setState({ activeSessionId: null })
  })

  it('shows a folder picker on each background only while editing', () => {
    render(<LookPicker />)
    fireEvent.click(screen.getByTestId('LookPicker.button'))
    expect(screen.queryByTestId('LookPicker.move.dots')).toBeNull()
    fireEvent.click(screen.getByTestId('LookPicker.editFolders'))
    expect(screen.getByTestId('LookPicker.move.dots')).toBeInTheDocument()
  })

  it('moves a background into another folder, and the picker shows it there', () => {
    render(<LookPicker />)
    openEditor()
    fireEvent.change(screen.getByTestId('LookPicker.move.dots'), { target: { value: 'Tech' } })
    const tech = screen.getByTestId('LookPicker.folder.Tech')
    expect(within(tech).getByTestId('LookPicker.texture.dots')).toBeInTheDocument()
    expect(useTextureFolders.getState().folders.find((f) => f.name === 'Tech')?.kinds).toContain(
      'dots'
    )
  })

  it('adds a folder, and deletes one', () => {
    render(<LookPicker />)
    openEditor()
    fireEvent.change(screen.getByLabelText('New folder name'), { target: { value: 'Retro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByTestId('LookPicker.folder.Retro')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete folder Retro' }))
    expect(screen.queryByTestId('LookPicker.folder.Retro')).toBeNull()
  })
})
