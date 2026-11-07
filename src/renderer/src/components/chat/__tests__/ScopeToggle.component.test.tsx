import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getSpeakScope } from '../../../lib/speak/kokoro-speaker'
import { ScopeToggle } from '../ScopeToggle'

describe('ScopeToggle', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it('starts on summary only, the default', () => {
    render(<ScopeToggle />)
    expect(screen.getByTestId('ScopeToggle')).toHaveAttribute('aria-pressed', 'true')
    expect(getSpeakScope()).toBe('final')
  })

  it('a click switches to every reply and back, and remembers the choice', () => {
    render(<ScopeToggle />)
    const button = screen.getByTestId('ScopeToggle')

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(getSpeakScope()).toBe('all')

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(getSpeakScope()).toBe('final')
  })

  it('leaves Enter to the chat, like the other buttons in the face menu', () => {
    render(<ScopeToggle />)
    expect(screen.getByTestId('ScopeToggle')).toHaveAttribute('data-enter-sends')
  })
})
