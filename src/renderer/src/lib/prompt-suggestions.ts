import { create } from 'zustand'

/**
 * The next thing Claude Code guesses you will say, per chat. It is shown as ghost text in an
 * empty input box and taken with Tab. A suggestion is only good until you type, send, or the next
 * turn starts, so each of those clears it.
 */
type PromptSuggestionsState = {
  bySession: Readonly<Record<string, string>>
  set: (routingId: string, suggestion: string) => void
  clear: (routingId: string) => void
}

export const usePromptSuggestions = create<PromptSuggestionsState>((set, get) => ({
  bySession: {},
  set: (routingId, suggestion) => {
    const text = suggestion.trim()
    if (!text || get().bySession[routingId] === text) return
    set((state) => ({ bySession: { ...state.bySession, [routingId]: text } }))
  },
  clear: (routingId) => {
    if (!(routingId in get().bySession)) return
    set((state) => {
      const next = { ...state.bySession }
      delete next[routingId]
      return { bySession: next }
    })
  }
}))

/** The mark on the placeholder that tells you Tab takes the suggestion. */
export const SUGGESTION_HINT = '  ⇥ Tab'
