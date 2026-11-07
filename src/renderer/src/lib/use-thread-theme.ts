import { useEffect } from 'react'
import {
  TEXTURE_IMAGE_VAR,
  TEXTURE_POSITION_VAR,
  TEXTURE_SIZE_VAR,
  textureCss
} from './app-texture'
import { peekUpcomingChatId, resolveLook, useThreadLooks } from './thread-look'
import {
  THREAD_ACCENT_VAR,
  THREAD_CREAM_VAR,
  THREAD_INK_VAR,
  THREAD_SURFACE_VARS,
  threadAccent,
  threadFaceInk,
  threadSurfaces
} from './thread-theme'

/**
 * Colors the whole window for the thread in view. The accent (face, border) follows the thread in
 * every theme; the tinted backgrounds and borders, and the background texture, replace only the
 * dark theme's near-black ones, since the light and monokai themes bring their own. The thread's
 * color and texture are its own (before a chat exists, the welcome screen shows the look the next
 * chat will be created with) unless the person changed them (see thread-look.ts).
 */
export function useThreadTheme(sessionId: string | null, theme: string): void {
  const overrides = useThreadLooks((s) => s.overrides)
  const favorites = useThreadLooks((s) => s.favorites)
  const hidden = useThreadLooks((s) => s.hidden)
  const { hue, texture } = resolveLook(
    sessionId ?? peekUpcomingChatId(),
    overrides,
    favorites,
    hidden
  )
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty(THREAD_ACCENT_VAR, threadAccent(hue))
    const face = threadFaceInk(hue)
    root.style.setProperty(THREAD_INK_VAR, face.ink)
    root.style.setProperty(THREAD_CREAM_VAR, face.cream)
    if (theme === 'dark') {
      for (const [name, value] of Object.entries(threadSurfaces(hue))) {
        root.style.setProperty(name, value)
      }
    } else {
      for (const name of THREAD_SURFACE_VARS) root.style.removeProperty(name)
    }
    const css = theme === 'dark' ? textureCss(texture, hue) : null
    if (css) {
      root.style.setProperty(TEXTURE_IMAGE_VAR, css.image)
      root.style.setProperty(TEXTURE_SIZE_VAR, css.size)
      root.style.setProperty(TEXTURE_POSITION_VAR, css.position)
    } else {
      root.style.removeProperty(TEXTURE_IMAGE_VAR)
      root.style.removeProperty(TEXTURE_SIZE_VAR)
      root.style.removeProperty(TEXTURE_POSITION_VAR)
    }
  }, [hue, texture, theme])
}
