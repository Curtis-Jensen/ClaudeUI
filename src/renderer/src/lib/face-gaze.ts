/** Where the face looks: a direction toward the pointer, each axis from -1 to 1. */
export type Gaze = { x: number; y: number }

export const NO_GAZE: Gaze = { x: 0, y: 0 }

/**
 * The look toward a pointer from the middle of the face: the direction of the pointer, and the
 * farther away it is the more the eyes turn, up to `reach` pixels, beyond which they stay put.
 * Rounded to a few steps so a slow drift does not redraw the face on every pixel.
 */
export function gazeToward(
  faceX: number,
  faceY: number,
  pointerX: number,
  pointerY: number,
  reach = 320
): Gaze {
  const dx = pointerX - faceX
  const dy = pointerY - faceY
  const distance = Math.hypot(dx, dy)
  if (distance < 1) return NO_GAZE
  const strength = Math.min(1, distance / reach)
  const round = (n: number): number => Math.round(n * 20) / 20
  return { x: round((dx / distance) * strength), y: round((dy / distance) * strength) }
}

const MIRRORED_STYLES = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'tabSize',
  'wordSpacing'
] as const

/**
 * Where the text cursor sits on screen, for a textarea. A hidden copy of the box is laid out with
 * the same text up to the cursor, and a marker at the end tells where the cursor falls. Clamped
 * to the box, so a long text scrolled out of view still gives a point the face can look at.
 */
export function caretPoint(el: HTMLTextAreaElement): { x: number; y: number } {
  const style = getComputedStyle(el)
  const mirror = document.createElement('div')
  for (const name of MIRRORED_STYLES) mirror.style[name] = style[name]
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.textContent = el.value.slice(0, el.selectionEnd)
  const marker = document.createElement('span')
  marker.textContent = '​'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const left = marker.offsetLeft
  const top = marker.offsetTop
  const lineHeight = marker.offsetHeight
  document.body.removeChild(mirror)
  const box = el.getBoundingClientRect()
  const x = Math.min(box.right, Math.max(box.left, box.left + left - el.scrollLeft))
  const y = Math.min(box.bottom, Math.max(box.top, box.top + top - el.scrollTop + lineHeight / 2))
  return { x, y }
}
