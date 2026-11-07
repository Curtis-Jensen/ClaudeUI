import { useEffect } from 'react'
import { claimFirstOpenOfDay, playStartupJingle } from './sfx'

/** Plays the startup jingle once, the first time the app opens each day. */
export function useStartupJingle(): void {
  useEffect(() => {
    if (claimFirstOpenOfDay()) playStartupJingle()
  }, [])
}
