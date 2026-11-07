/**
 * A chessboard seen from above and turned a little, drawn once across the whole window, as a
 * background of its own: the squares run off every side, and ranks of pieces stand on the tinted
 * squares, turned with the board. Faint and tinted with the chat's color, like the textures.
 */
import { BLACK_HUE } from './thread-theme'

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const W = 1600
const H = 1000

/** A line or fill color at `alpha` in a hue. */
const tint = (hue: number, alpha: number, light = 74): string =>
  `hsl(${hue === BLACK_HUE ? '0 0%' : `${hue} 90%`} ${light}% / ${alpha})`

/** The board is turned a little, so it is not stiff; the squares themselves stay square. */
const TILT = -8
const SQUARE = 120
/** Squares either side of the middle: enough that the board runs past every edge of the picture. */
const HALF = 10

const round = (n: number): number => Math.round(n * 10) / 10

/** A step along the right-hand side of a piece, going up from the middle of its base. */
type Step = ['L', number, number] | ['C', number, number, number, number, number, number]

/**
 * A piece that is the same on both sides, from the steps up its right-hand side (from the middle
 * of the base to the middle of the top): the left side is those steps run back down, mirrored.
 */
function symmetric(steps: Step[]): string {
  const right: string[] = []
  const left: string[] = []
  let from: [number, number] = [0, 0]
  for (const step of steps) {
    if (step[0] === 'L') {
      right.push(`L${step[1]} ${step[2]}`)
      left.unshift(`L${-from[0]} ${from[1]}`)
      from = [step[1], step[2]]
    } else {
      const [, x1, y1, x2, y2, x, y] = step
      right.push(`C${x1} ${y1} ${x2} ${y2} ${x} ${y}`)
      left.unshift(`C${-x2} ${y2} ${-x1} ${y1} ${-from[0]} ${from[1]}`)
      from = [x, y]
    }
  }
  return `M0 0${right.join('')}L${-from[0]} ${from[1]}${left.join('')}Z`
}

/** The foot every piece stands on: a flat plinth, a rounded step, then the neck of the piece. */
const FOOT: Step[] = [
  ['L', 38, 0],
  ['L', 38, -8],
  ['L', 32, -14],
  ['L', 24, -14]
]

/**
 * The pieces, each drawn standing on the origin (its base sitting at y = 0, a little under 100
 * across) so one scale and one move puts it on a square.
 */
const PIECES = {
  pawn: symmetric([
    ...FOOT,
    ['C', 24, -30, 14, -38, 10, -48],
    ['L', 20, -48],
    ['L', 20, -54],
    ['L', 10, -54],
    ['C', 20, -60, 16, -82, 0, -82]
  ]),
  rook: symmetric([
    ...FOOT,
    ['L', 24, -22],
    ['L', 20, -66],
    ['L', 32, -70],
    ['L', 32, -108],
    ['L', 22, -108],
    ['L', 22, -98],
    ['L', 12, -98],
    ['L', 12, -108],
    ['L', 0, -108]
  ]),
  bishop: symmetric([
    ...FOOT,
    ['C', 24, -30, 12, -40, 10, -54],
    ['L', 20, -54],
    ['L', 20, -60],
    ['L', 10, -60],
    ['C', 34, -76, 20, -104, 0, -112]
  ]),
  queen: symmetric([
    ...FOOT,
    ['C', 24, -34, 12, -50, 10, -66],
    ['L', 22, -66],
    ['L', 22, -72],
    ['L', 10, -72],
    ['L', 40, -112],
    ['L', 28, -118],
    ['L', 24, -138],
    ['L', 14, -120],
    ['L', 0, -142]
  ]),
  king: symmetric([
    ...FOOT,
    ['C', 24, -34, 12, -50, 10, -66],
    ['L', 22, -66],
    ['L', 22, -72],
    ['L', 10, -72],
    ['L', 36, -104],
    ['C', 38, -116, 22, -122, 6, -122],
    ['L', 6, -130],
    ['L', 14, -130],
    ['L', 14, -138],
    ['L', 6, -138],
    ['L', 6, -150],
    ['L', 0, -150]
  ]),
  // The horse is the one piece that is not the same on both sides: it looks to the left.
  knight:
    'M-38 0H38V-8L32 -14H30C30 -44 40 -66 20 -94C10 -106 4 -110 -2 -118L-8 -128L-14 -116' +
    'C-30 -104 -42 -88 -42 -76L-42 -70C-40 -64 -30 -62 -24 -66L-16 -72' +
    'C-24 -56 -34 -40 -30 -14H-32L-38 -8Z'
} as const

type Piece = keyof typeof PIECES

/**
 * How much each piece is squashed from the top, so all of them stand about as tall as the pawn
 * (the one height that looked right) instead of towering over it.
 */
const HEIGHT: Record<Piece, number> = {
  pawn: 1,
  rook: 0.78,
  knight: 0.84,
  bishop: 0.74,
  queen: 0.6,
  king: 0.57
}

/** The back rank, in order. */
const BACK_RANK: readonly Piece[] = [
  'rook',
  'knight',
  'bishop',
  'queen',
  'king',
  'bishop',
  'knight',
  'rook'
]
/** The rows (counted from the middle) that hold a back rank; the row below each holds pawns. */
const BACK_ROWS = [-5, -1, 3]

/** The square a piece stands on, and what it is. Only tinted squares get one, so a dark piece never stands on a dark square. */
function lineup(): Array<{ piece: Piece; column: number; row: number }> {
  const pieces: Array<{ piece: Piece; column: number; row: number }> = []
  for (const back of BACK_ROWS) {
    for (const row of [back, back + 1]) {
      for (let column = -HALF; column < HALF; column++) {
        if ((column + row) % 2 === 0) continue
        // Neighbouring tinted squares are two columns apart, so the ranks count along by twos.
        const place = Math.floor((column + 2 * HALF) / 2)
        pieces.push({
          piece: row === back ? BACK_RANK[place % BACK_RANK.length] : 'pawn',
          column,
          row
        })
      }
    }
  }
  return pieces
}

/** The dark squares and the faint lines between all of them. */
function squares(hue: number): string {
  const dark: string[] = []
  const lines: string[] = []
  for (let row = -HALF; row < HALF; row++) {
    for (let column = -HALF; column < HALF; column++) {
      if ((column + row) % 2 === 0) continue
      dark.push(`M${column * SQUARE} ${row * SQUARE}h${SQUARE}v${SQUARE}h${-SQUARE}z`)
    }
  }
  for (let i = -HALF; i <= HALF; i++) {
    lines.push(
      `M${i * SQUARE} ${-HALF * SQUARE}V${HALF * SQUARE}M${-HALF * SQUARE} ${i * SQUARE}H${HALF * SQUARE}`
    )
  }
  return (
    `<path d="${dark.join('')}" fill="${tint(hue, 0.1, 66)}"/>` +
    `<path d="${lines.join('')}" fill="none" stroke="${tint(hue, 0.07)}" stroke-width="1.2"/>`
  )
}

/** The pieces, in the board's own turned frame, so they lean exactly as the squares do. */
function standing(hue: number): string {
  const body = tint(hue, 0.4, 6)
  const edge = tint(hue, 0.3)
  const scale = round((SQUARE / 100) * 0.72)
  const shadow = `<ellipse cx="0" cy="2" rx="44" ry="8" fill="${tint(hue, 0.08, 40)}"/>`
  return lineup()
    .map(
      ({ piece, column, row }) =>
        `<g transform="translate(${(column + 0.5) * SQUARE} ${(row + 0.5) * SQUARE + SQUARE * 0.32}) scale(${scale} ${round(scale * HEIGHT[piece])})">${shadow}` +
        `<path d="${PIECES[piece]}" fill="${body}" stroke="${edge}" stroke-width="${round(2.4 / scale)}" stroke-linejoin="round"/></g>`
    )
    .join('')
}

export function chessSvg(hue: number): string {
  return (
    `<svg ${NS} width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<g transform="translate(${W / 2} ${H / 2}) rotate(${TILT})">${squares(hue)}${standing(hue)}</g></svg>`
  )
}
