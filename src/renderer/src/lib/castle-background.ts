/**
 * A castle floor plan drawn once across the whole window, as a background of its own: curtain walls
 * that run off every side, a moat, noble houses in the outer ward, and the keep in the middle.
 * Faint and tinted with the chat's color, like the textures.
 */
import { BLACK_HUE } from './thread-theme'

const NS = 'xmlns="http://www.w3.org/2000/svg"'

/** A line or fill color at `alpha` in a hue. */
const tint = (hue: number, alpha: number, light = 74): string =>
  `hsl(${hue === BLACK_HUE ? '0 0%' : `${hue} 90%`} ${light}% / ${alpha})`

/** The outer curtain wall: its corners sit just outside the 1600 x 1000 picture on both sides. */
const OUTER_WALL = '-60,300 300,110 1300,110 1660,300 1660,800 1300,970 300,970 -60,800'
const OUTER_TOWERS: Array<[number, number]> = [
  [-60, 300],
  [300, 110],
  [1300, 110],
  [1660, 300],
  [1660, 800],
  [1300, 970],
  [300, 970],
  [-60, 800]
]
const INNER_TOWERS: Array<[number, number]> = [
  [560, 260],
  [1040, 260],
  [1040, 740],
  [560, 740]
]
const KEEP_TOWERS: Array<[number, number]> = [
  [700, 380],
  [900, 380],
  [900, 620],
  [700, 620]
]
/** x, y, width, height of the noble houses, then the hall, barracks and stables. */
const HOUSES: Array<[number, number, number, number]> = [
  [110, 360, 180, 110],
  [110, 540, 180, 110],
  [1310, 360, 180, 110],
  [1310, 540, 180, 110],
  [400, 170, 150, 70],
  [1050, 170, 150, 70],
  [330, 800, 140, 70],
  [1130, 800, 140, 70]
]
const BUILDINGS: Array<[number, number, number, number]> = [
  [580, 300, 100, 160],
  [920, 300, 100, 160],
  [600, 630, 400, 80]
]

export function castleSvg(hue: number): string {
  const body = tint(hue, 0.09)
  const edge = tint(hue, 0.22)
  const room = tint(hue, 0.14)
  const water = tint(hue, 0.07, 60)
  const road = tint(hue, 0.06, 60)
  const circle = ([x, y]: [number, number], r: number): string =>
    `<circle cx="${x}" cy="${y}" r="${r}"/>`
  const box = ([x, y, w, h]: [number, number, number, number]): string =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`
  const ridges = HOUSES.map(([x, y, w, h]) => `M${x} ${y + h / 2}H${x + w}`).join('')
  const wall = 'M770 260H560V740H770M830 740H1040V260H830'
  return (
    `<svg ${NS} width="1600" height="1000" viewBox="0 0 1600 1000">` +
    `<polygon points="${OUTER_WALL}" fill="none" stroke="${water}" stroke-width="110" stroke-linejoin="round"/>` +
    `<polygon points="${OUTER_WALL}" fill="none" stroke="${body}" stroke-width="26" stroke-linejoin="round"/>` +
    `<polygon points="${OUTER_WALL}" fill="none" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M800 1000V740" stroke="${road}" stroke-width="30"/>` +
    `<g fill="${body}" stroke="${edge}" stroke-width="3">${OUTER_TOWERS.map((t) => circle(t, 34)).join('')}` +
    `<rect x="762" y="945" width="76" height="50"/></g>` +
    `<g fill="${body}" stroke="${room}" stroke-width="3">${HOUSES.map(box).join('')}${BUILDINGS.map(box).join('')}</g>` +
    `<path d="${ridges}" stroke="${room}" stroke-width="2" fill="none"/>` +
    `<path d="${wall}" fill="none" stroke="${body}" stroke-width="22"/>` +
    `<path d="${wall}" fill="none" stroke="${edge}" stroke-width="2"/>` +
    `<g fill="${body}" stroke="${edge}" stroke-width="3">${INNER_TOWERS.map((t) => circle(t, 22)).join('')}</g>` +
    `<rect x="700" y="380" width="200" height="240" fill="${body}" stroke="${edge}" stroke-width="6"/>` +
    `<path d="M800 380V620M720 500H880" fill="none" stroke="${room}" stroke-width="3"/>` +
    `<g fill="${body}" stroke="${edge}" stroke-width="3">${KEEP_TOWERS.map((t) => circle(t, 16)).join('')}</g>` +
    `</svg>`
  )
}
