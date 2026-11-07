import { beforeEach, describe, expect, it } from 'vitest'
import { usePromptSuggestions } from '../prompt-suggestions'

describe('prompt suggestions', () => {
  beforeEach(() => usePromptSuggestions.setState({ bySession: {} }))

  it('keeps a suggestion for each chat apart', () => {
    usePromptSuggestions.getState().set('a', 'run the tests')
    usePromptSuggestions.getState().set('b', 'commit this')
    expect(usePromptSuggestions.getState().bySession).toEqual({
      a: 'run the tests',
      b: 'commit this'
    })
  })

  it('a newer suggestion replaces the older one', () => {
    usePromptSuggestions.getState().set('a', 'first')
    usePromptSuggestions.getState().set('a', 'second')
    expect(usePromptSuggestions.getState().bySession.a).toBe('second')
  })

  it('trims, and ignores an empty suggestion', () => {
    usePromptSuggestions.getState().set('a', '  hello  ')
    usePromptSuggestions.getState().set('b', '   ')
    expect(usePromptSuggestions.getState().bySession).toEqual({ a: 'hello' })
  })

  it('clears one chat and leaves the others', () => {
    usePromptSuggestions.getState().set('a', 'x')
    usePromptSuggestions.getState().set('b', 'y')
    usePromptSuggestions.getState().clear('a')
    expect(usePromptSuggestions.getState().bySession).toEqual({ b: 'y' })
  })

  it('does not change the store when there is nothing to clear or nothing new', () => {
    usePromptSuggestions.getState().set('a', 'x')
    const before = usePromptSuggestions.getState().bySession
    usePromptSuggestions.getState().set('a', 'x')
    usePromptSuggestions.getState().clear('missing')
    expect(usePromptSuggestions.getState().bySession).toBe(before)
  })
})
