/**
 * Each thread has its own color. It is picked from the thread's id, so the same thread is always
 * the same color, with nothing to save. The color is the face, the window border and the tint
 * of the dark background; text, accents and status colors keep their own.
 */
export const THREAD_HUES = [27, 357, 300, 265, 225, 195, 165, 135, 50] as const

/**
 * Black is a color you can pick but never a random assignment, so it is not in THREAD_HUES. It is
 * not a hue at all: every function below treats this value as "no color" and draws neutral grays.
 */
export const BLACK_HUE = -1

/**
 * Each hue also has a black of its own: true black surfaces with that hue at full strength on
 * the accents, borders and face. It is stored
 * as the hue plus this offset, so it is still one number, and plain black and every plain hue keep
 * the values they always had.
 */
const TINTED_BLACK_OFFSET = 1000

/** The black that carries a hue's tint. */
export function tintedBlack(hue: number): number {
  return hue + TINTED_BLACK_OFFSET
}

/** True for plain black and for every hue's tinted black. */
export function isBlack(hue: number): boolean {
  return hue === BLACK_HUE || hue >= TINTED_BLACK_OFFSET
}

/** The hue a tinted black carries, or the hue itself; plain black stays BLACK_HUE (no hue). */
export function baseHue(hue: number): number {
  return hue >= TINTED_BLACK_OFFSET ? hue - TINTED_BLACK_OFFSET : hue
}

/** Every color the picker offers: the assignable hues, plain black, then a black for each hue. */
export const THREAD_COLORS: readonly number[] = [
  ...THREAD_HUES,
  BLACK_HUE,
  ...THREAD_HUES.map(tintedBlack)
]

/** The hue when there is no thread yet: orange. */
export const DEFAULT_HUE = 27

/** A small stable hash of a string (FNV-1a), the same everywhere. */
export function hashText(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** The hue of a thread: a pick from a set of well-spaced hues. */
export function threadHue(sessionId: string | null | undefined): number {
  if (!sessionId) return DEFAULT_HUE
  return THREAD_HUES[hashText(sessionId) % THREAD_HUES.length]
}

/** The hue after this one in the list, for the color button; an unlisted hue starts the list over. */
export function nextThreadHue(hue: number): number {
  const at = THREAD_COLORS.indexOf(hue)
  return THREAD_COLORS[(at + 1) % THREAD_COLORS.length]
}

/** The one color that is always set: the face and the window border read it. */
export function threadAccent(hue: number): string {
  if (hue === BLACK_HUE) return 'hsl(0 0% 24%)'
  if (isBlack(hue)) return `hsl(${baseHue(hue)} 95% 60%)`
  return `hsl(${hue} 95% 60%)`
}

/**
 * The tint of the dark theme's backgrounds and borders at a hue: a deep, saturated version of the
 * color instead of near-black, stepped lighter for each layer so the panels still read as layers.
 */
export function threadSurfaces(hue: number): Record<string, string> {
  if (hue === BLACK_HUE) {
    return {
      '--color-bg-primary': 'hsl(0 0% 2%)',
      '--color-bg-secondary': 'hsl(0 0% 5%)',
      '--color-bg-tertiary': 'hsl(0 0% 8%)',
      '--color-bg-hover': 'hsl(0 0% 12%)',
      '--color-bg-input': 'hsl(0 0% 4%)',
      '--color-border': 'hsl(0 0% 18%)',
      '--color-border-bright': 'hsl(0 0% 28%)'
    }
  }
  if (isBlack(hue)) {
    const h = baseHue(hue)
    return {
      '--color-bg-primary': 'hsl(0 0% 0%)',
      '--color-bg-secondary': 'hsl(0 0% 3%)',
      '--color-bg-tertiary': 'hsl(0 0% 6%)',
      '--color-bg-hover': 'hsl(0 0% 10%)',
      '--color-bg-input': 'hsl(0 0% 2%)',
      '--color-border': `hsl(${h} 85% 38%)`,
      '--color-border-bright': `hsl(${h} 95% 55%)`
    }
  }
  return {
    '--color-bg-primary': `hsl(${hue} 68% 9%)`,
    '--color-bg-secondary': `hsl(${hue} 62% 11%)`,
    '--color-bg-tertiary': `hsl(${hue} 56% 14%)`,
    '--color-bg-hover': `hsl(${hue} 50% 18%)`,
    '--color-bg-input': `hsl(${hue} 60% 12%)`,
    '--color-border': `hsl(${hue} 45% 22%)`,
    '--color-border-bright': `hsl(${hue} 48% 30%)`
  }
}

/**
 * A chat row filled with a deep shade of its thread's color. The text on it is white, so it reads
 * on every color and is easy on the eyes in dark mode; the text colors are set as the row's own
 * variables, so everything drawn inside the row (labels, icons) follows without being touched.
 * The open chat's row is a touch brighter.
 */
export function threadRowStyle(hue: number, active: boolean): Record<string, string> {
  const background =
    hue === BLACK_HUE
      ? `hsl(0 0% ${active ? 14 : 7}%)`
      : isBlack(hue)
        ? `hsl(${baseHue(hue)} 60% ${active ? 16 : 8}%)`
        : `hsl(${hue} 60% ${active ? 30 : 22}%)`
  return {
    background,
    '--color-text-primary': '#ffffff',
    '--color-text-secondary': '#ffffff',
    '--color-text-muted': 'rgba(255, 255, 255, 0.7)'
  }
}

/**
 * The swatch in the color picker: true black, since the accent is a lifted gray to show on black.
 * A tinted black is a black disc inside a ring of its color.
 */
export function threadSwatch(hue: number): string {
  if (hue === BLACK_HUE) return 'hsl(0 0% 3%)'
  if (isBlack(hue)) {
    return `radial-gradient(circle, hsl(0 0% 2%) 42%, ${threadAccent(hue)} 48%)`
  }
  return threadAccent(hue)
}

/** The ring around a black's swatch, so it can be told from the dark panel it sits on. */
export function threadSwatchRing(hue: number): string {
  return hue === BLACK_HUE ? 'hsl(0 0% 32%)' : threadAccent(hue)
}

/**
 * The face's line and fill colors. A black face is drawn the other way round (light features on
 * a dark head), otherwise its eyes and mouth would vanish into it.
 */
export function threadFaceInk(hue: number): { ink: string; cream: string } {
  if (hue === BLACK_HUE) return { ink: '#f2f2f2', cream: '#242424' }
  if (isBlack(hue)) return { ink: '#0a0a0a', cream: threadAccent(hue) }
  return { ink: '#2a1405', cream: '#fff4dc' }
}

export const THREAD_ACCENT_VAR = '--thread-color'
export const THREAD_INK_VAR = '--thread-ink'
export const THREAD_CREAM_VAR = '--thread-cream'
export const THREAD_SURFACE_VARS = Object.keys(threadSurfaces(DEFAULT_HUE))
