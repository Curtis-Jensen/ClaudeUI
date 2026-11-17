import { useSyncExternalStore } from 'react'
import { resolveTheme, type ThemeId } from '../stores/session-store'
import { useSessionStore } from '../stores/session-store'

const QUERY = '(prefers-color-scheme: light)'

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** The theme actually in effect: the chosen one, or the Mac's light/dark when "System" is chosen. */
export function useResolvedTheme(): ThemeId {
  const pref = useSessionStore((s) => s.settings.theme)
  const systemLight = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
  return pref === 'system' ? (systemLight ? 'light' : 'dark') : resolveTheme(pref)
}
