/**
 * A faint texture over the dark background, tinted with the chat's color. Each is a tiny SVG
 * tiled across the window, so there are no image files. Every chat is given one of these at
 * random (see thread-look.ts) and keeps it, and the face menu can change it.
 */
import { andromedaSvg } from './andromeda-background'
import { castleSvg } from './castle-background'
import { chessSvg } from './chess-background'
import { claudeSvg } from './claude-background'
import { BLACK_HUE, baseHue } from './thread-theme'
export type TextureKind =
  | 'stars'
  | 'caustics'
  | 'dots'
  | 'grid'
  | 'diamonds'
  | 'rain'
  | 'bubbles'
  | 'crosses'
  | 'zigzag'
  | 'triangles'
  | 'confetti'
  | 'hearts'
  | 'fireworks'
  | 'shamrocks'
  | 'eggs'
  | 'pumpkins'
  | 'leaves'
  | 'snowflakes'
  | 'forest'
  | 'mountains'
  | 'branch'
  | 'topography'
  | 'matrix'
  | 'castle'
  | 'chess'
  | 'circuits'
  | 'claude'
  | 'andromeda'
  | 'none'

type Generator = {
  label: string
  /** The picture of one tile, in the color of the given hue. */
  svg: (hue: number) => string
  width: number
  height: number
  /** One picture covering the window, centred, instead of a tile that repeats. */
  scene?: boolean
}

const NS = 'xmlns="http://www.w3.org/2000/svg"'

/** A faint line or fill color at `alpha` in a hue. */
const tint = (hue: number, alpha: number | string, light = 74): string =>
  `hsl(${hue === BLACK_HUE ? '0 0%' : `${hue} 90%`} ${light}% / ${alpha})`

/** A small deterministic sequence, so the same texture is drawn the same way every time. */
function sequence(seed: number): () => number {
  let state = seed
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

/** A four-pointed star of arm length `s` centred on (x, y). */
function starPath(x: number, y: number, s: number): string {
  const n = s * 0.28
  return `M${x} ${y - s}L${x + n} ${y - n}L${x + s} ${y}L${x + n} ${y + n}L${x} ${y + s}L${x - n} ${y + n}L${x - s} ${y}L${x - n} ${y - n}Z`
}

/** A shape drawn around its own centre, then moved and turned into place on the tile. */
const place = (x: number, y: number, turn: number, shape: string): string =>
  `<g transform="translate(${x} ${y}) rotate(${turn})">${shape}</g>`

/** A heart of size `s` centred on the origin. */
const heartPath = (s: number): string =>
  `M0 ${s}C${-2 * s} ${0.1 * s} ${-s} ${-1.2 * s} 0 ${-0.4 * s}C${s} ${-1.2 * s} ${2 * s} ${0.1 * s} 0 ${s}Z`

function hearts(hue: number): string {
  const size = 120
  // x, y, size, turn, filled
  const spots: Array<[number, number, number, number, boolean]> = [
    [20, 22, 6, -12, true],
    [66, 12, 4, 10, false],
    [98, 34, 7, 14, false],
    [44, 56, 5, 8, true],
    [14, 84, 4, -8, false],
    [78, 78, 6, -14, true],
    [104, 106, 4, 6, true],
    [48, 106, 6, 12, false]
  ]
  const shapes = spots.map(([x, y, s, turn, filled]) =>
    place(
      x,
      y,
      turn,
      filled
        ? `<path d="${heartPath(s)}" fill="${tint(hue, 0.16)}"/>`
        : `<path d="${heartPath(s)}" fill="none" stroke="${tint(hue, 0.18)}" stroke-width="1.1"/>`
    )
  )
  return `<svg ${NS} width="${size}" height="${size}">${shapes.join('')}</svg>`
}

function fireworks(hue: number): string {
  const size = 150
  const burst = (
    x: number,
    y: number,
    inner: number,
    outer: number,
    rays: number,
    alpha: number
  ) => {
    const lines: string[] = []
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2
      const [c, s] = [Math.cos(a), Math.sin(a)]
      const f = (r: number): string => `${(x + c * r).toFixed(1)} ${(y + s * r).toFixed(1)}`
      lines.push(`M${f(inner)}L${f(outer)}`)
      lines.push(`M${f(outer + 3)}h0.01`)
    }
    return `<path d="${lines.join('')}" fill="none" stroke="${tint(hue, alpha)}" stroke-width="1.2" stroke-linecap="round"/>`
  }
  const shapes = [
    burst(42, 44, 6, 16, 12, 0.2),
    burst(110, 98, 4, 11, 10, 0.17),
    `<path d="${starPath(112, 28, 4)}" fill="${tint(hue, 0.22, 80)}"/>`,
    `<path d="${starPath(30, 112, 3)}" fill="${tint(hue, 0.2, 80)}"/>`,
    `<circle cx="78" cy="64" r="1" fill="${tint(hue, 0.2, 80)}"/>`
  ]
  return `<svg ${NS} width="${size}" height="${size}">${shapes.join('')}</svg>`
}

function shamrock(hue: number, alpha: number): string {
  const leaves = [
    [0, -4],
    [3.6, 2],
    [-3.6, 2]
  ]
    .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="3.6" fill="${tint(hue, alpha)}"/>`)
    .join('')
  return `${leaves}<path d="M0 2Q1 8 4 11" fill="none" stroke="${tint(hue, alpha)}" stroke-width="1.2" stroke-linecap="round"/>`
}

const EGG = 'M0 -10C5 -10 8 -2 8 3C8 8 4.5 10.5 0 10.5C-4.5 10.5 -8 8 -8 3C-8 -2 -5 -10 0 -10Z'

function egg(hue: number): string {
  const line = tint(hue, 0.16)
  return `<path d="${EGG}" fill="none" stroke="${line}" stroke-width="1.1"/><path d="M-7.5 2L-5 -0.6L-2.5 2L0 -0.6L2.5 2L5 -0.6L7.5 2" fill="none" stroke="${line}" stroke-width="1"/>`
}

function leaf(hue: number): string {
  const line = tint(hue, 0.17)
  return `<path d="M0 -9C7 -4 7 5 0 10C-7 5 -7 -4 0 -9Z" fill="${tint(hue, 0.06)}" stroke="${line}" stroke-width="1"/><path d="M0 -9V12M0 -2L3.5 -5M0 -2L-3.5 -5M0 3L3.5 0M0 3L-3.5 0" fill="none" stroke="${line}" stroke-width="0.9" stroke-linecap="round"/>`
}

/**
 * One arm of a snowflake, pointing up from the centre. Its draws come from `next`, so each flake
 * gets its own arm (mirrored left to right, then copied to all six): a stem with a few pairs of branches, each pair forked or ticked, and a V tip.
 */
function flakeArm(len: number, next: () => number): string {
  const seg: string[] = [`M0 0V${-len}`]
  const diag = Math.SQRT1_2
  const pairs = 2 + Math.floor(next() * 3)
  for (let p = 0; p < pairs; p++) {
    // Spread the pairs along the stem, a little differently each time.
    const y = -len * (0.25 + ((p + next() * 0.6) / pairs) * 0.6)
    const bl = len * (0.12 + next() * 0.12)
    const forked = next() < 0.6
    for (const side of [-1, 1]) {
      const [bx, by] = [side * bl * diag, y - bl * diag]
      seg.push(`M0 ${y.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`)
      if (forked) {
        // The fork at the branch tip: one twig straight up, one out to the side.
        seg.push(
          `M${bx.toFixed(1)} ${by.toFixed(1)}V${(by - bl * 0.4).toFixed(1)}M${bx.toFixed(1)} ${by.toFixed(1)}H${(bx + side * bl * 0.4).toFixed(1)}`
        )
      } else {
        // Or a single tick standing up from the middle of the branch.
        const [mx, my] = [bx / 2, (y + by) / 2]
        seg.push(`M${mx.toFixed(1)} ${my.toFixed(1)}V${(my - bl * 0.35).toFixed(1)}`)
      }
    }
  }
  const w = len * (0.1 + next() * 0.12)
  seg.push(
    `M${(-w).toFixed(1)} ${(-len * 0.86).toFixed(1)}L0 ${-len}L${w.toFixed(1)} ${(-len * 0.86).toFixed(1)}`
  )
  return seg.join('')
}

/**
 * A big six-armed snowflake of radius `r` centred on (x, y). Its draws come from `next`, so its arm
 * and its heart (a hexagon, a ring or a small star) are its own.
 */
function bigFlake(
  hue: number,
  next: () => number,
  x: number,
  y: number,
  r: number,
  turn: number
): string {
  const line = tint(hue, 0.24, 80)
  // One arm, turned six times, so the flake is perfectly six-fold symmetrical.
  const arm = flakeArm(r * (0.88 + next() * 0.24), next)
  const arms = Array.from(
    { length: 6 },
    (_, i) => `<g transform="rotate(${i * 60})"><path d="${arm}"/></g>`
  )
  const hexagon = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2
    return `${(Math.sin(a) * r * 0.1).toFixed(1)} ${(-Math.cos(a) * r * 0.1).toFixed(1)}`
  }).join('L')
  const heart = [
    `<path d="M${hexagon}Z"/>`,
    `<circle r="${(r * 0.12).toFixed(1)}"/>`,
    `<path d="${starPath(0, 0, r * 0.12)}"/>`
  ][Math.floor(next() * 3)]
  return `<g transform="translate(${x} ${y}) rotate(${turn})" fill="none" stroke="${line}" stroke-width="${(r / 60 + 2).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${arms.join('')}${heart}</g>`
}

/** A plain three-line star with no detail, for the far-off flakes behind the big ones. */
function tinyFlake(r: number): string {
  const [c, s] = [r * 0.87, r / 2]
  return `<path d="M0 ${-r}V${r}M${-c} ${-s}L${c} ${s}M${-c} ${s}L${c} ${-s}"/>`
}

/**
 * One main snowflake with two smaller ones off to the side, over a crowd of small ones. The small
 * ones sit in two soft blurred layers behind them, so they read as snow far off and out of focus.
 */
function snowflakes(hue: number): string {
  const [w, h] = [1600, 1000]
  const next = sequence(57)
  // Warmed up first, so seeds that sit close together still start from unrelated places.
  const seeded = (seed: number): (() => number) => {
    const draw = sequence(seed)
    for (let i = 0; i < 16; i++) draw()
    return draw
  }
  const crowd = (count: number, rMin: number, rSpan: number, alpha: number): string =>
    Array.from({ length: count }, () => {
      const [x, y] = [next() * w, next() * h]
      const r = rMin + next() * rSpan
      const fill = tint(hue, (alpha * (0.6 + next() * 0.8)).toFixed(3), 80)
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(next() * 60).toFixed(1)})" fill="none" stroke="${fill}" stroke-width="1.2" stroke-linecap="round">${tinyFlake(r)}</g>`
    }).join('')
  const big = [
    bigFlake(hue, seeded(5), 700, 500, 270, 14),
    bigFlake(hue, seeded(19), 1240, 270, 120, -18),
    bigFlake(hue, seeded(77), 1300, 730, 150, 41)
  ]
  return `<svg ${NS} width="${w}" height="${h}"><defs><filter id="far" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter><filter id="near" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2"/></filter></defs><g filter="url(#far)">${crowd(110, 5, 9, 0.12)}</g><g filter="url(#near)">${crowd(45, 10, 12, 0.22)}</g>${big.join('')}</svg>`
}

/** A tile of one small drawing repeated at a few spots, each turned and sized a little differently. */
function scatter(
  hue: number,
  size: number,
  spots: Array<[x: number, y: number, turn: number, scale: number]>,
  draw: (hue: number, index: number) => string
): string {
  const shapes = spots.map(([x, y, turn, scale], i) =>
    place(x, y, turn, `<g transform="scale(${scale})">${draw(hue, i)}</g>`)
  )
  return `<svg ${NS} width="${size}" height="${size}">${shapes.join('')}</svg>`
}

function stars(hue: number): string {
  const size = 1200
  const next = sequence(7)
  const shapes: string[] = []
  for (let i = 0; i < Math.round(26 * (size / 256) ** 2); i++) {
    const x = Math.round(next() * size)
    const y = Math.round(next() * size)
    const roll = next()
    const fill = tint(hue, (0.1 + next() * 0.26).toFixed(2), 80)
    if (roll < 0.62) {
      shapes.push(
        `<circle cx="${x}" cy="${y}" r="${(0.7 + next() * 0.7).toFixed(1)}" fill="${fill}"/>`
      )
    } else {
      shapes.push(`<path d="${starPath(x, y, roll < 0.9 ? 3 : 5)}" fill="${fill}"/>`)
    }
  }
  return `<svg ${NS} width="${size}" height="${size}">${shapes.join('')}</svg>`
}

function confetti(hue: number): string {
  const size = 160
  const next = sequence(21)
  const bits: string[] = []
  for (let i = 0; i < 16; i++) {
    const x = Math.round(next() * size)
    const y = Math.round(next() * size)
    const turn = Math.round(next() * 180)
    const alpha = (0.1 + next() * 0.2).toFixed(2)
    bits.push(
      `<rect x="${x - 3}" y="${y - 1}" width="6" height="2" rx="1" fill="${tint(hue, alpha, 76)}" transform="rotate(${turn} ${x} ${y})"/>`
    )
  }
  return `<svg ${NS} width="${size}" height="${size}">${bits.join('')}</svg>`
}

/** A tree about 46 tall standing on the origin: a pine of stacked tiers, or a round-topped tree. */
function tree(hue: number, round: boolean): string {
  const line = tint(hue, 0.17)
  const fill = tint(hue, 0.07)
  const crown = round
    ? 'M-9 -9C-17 -14 -12 -27 -3 -25C0 -34 12 -31 11 -22C19 -18 16 -8 8 -9Z'
    : 'M0 -44L8 -28H-8ZM0 -35L12 -15H-12ZM0 -24L16 -4H-16Z'
  return `<path d="${crown}" fill="${fill}" stroke="${line}" stroke-width="1" stroke-linejoin="round"/><path d="M0 -4V5" stroke="${line}" stroke-width="1.3" stroke-linecap="round"/>`
}

/** Trees dotted about at random, never touching, so it reads as woods and not as a pattern. */
function forest(hue: number): string {
  const [w, h] = [288, 224]
  const next = sequence(31)
  const spots: Array<[number, number]> = []
  const shapes: string[] = []
  for (let tries = 0; tries < 200 && spots.length < 11; tries++) {
    const x = Math.round(24 + next() * (w - 48))
    const y = Math.round(52 + next() * (h - 60))
    const scale = 0.7 + next() * 0.5
    const round = next() < 0.35
    if (spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 40)) continue
    spots.push([x, y])
    shapes.push(place(x, y, 0, `<g transform="scale(${scale.toFixed(2)})">${tree(hue, round)}</g>`))
  }
  return `<svg ${NS} width="${w}" height="${h}">${shapes.join('')}</svg>`
}

/**
 * A ridgeline across the whole scene by midpoint displacement, the classic fractal-terrain method:
 * the two ends start level, then each round puts a point in the middle of every stretch and nudges
 * it up or down by a smaller amount (`roughness` per round). Big shapes come first and smaller ones
 * fill in after, which is why real ranges look broken up at every scale. Nothing is clamped, so the
 * valleys dip as low as the peaks rise and no stretch runs flat. A power curve sharpens the summits.
 */
function ridgePoints(
  next: () => number,
  w: number,
  top: number,
  bottom: number,
  rounds: number,
  roughness: number
): Array<[number, number]> {
  let heights = [0, 0]
  let scale = 1
  for (let round = 0; round < rounds; round++) {
    const grown: number[] = []
    for (let i = 0; i < heights.length - 1; i++) {
      // Two uniform draws make a rough bell curve, so most nudges are small and a few are large.
      const nudge = (next() + next() - 1) * scale
      grown.push(heights[i], (heights[i] + heights[i + 1]) / 2 + nudge)
    }
    grown.push(heights[heights.length - 1])
    heights = grown
    scale *= roughness
  }
  const low = Math.min(...heights)
  const span = Math.max(1e-6, Math.max(...heights) - low)
  return heights.map((height, i) => [
    (i / (heights.length - 1)) * w,
    bottom - (bottom - top) * ((height - low) / span) ** 1.3
  ])
}

/**
 * Four ranges stacked across one picture of the whole window, far ones first so the near ones sit
 * in front. The scene is cropped to fit the window (it is drawn "cover"), so every peak and valley
 * stays inside the middle band that survives the crop on a wide window. The ranges sit in separate,
 * non-overlapping vertical bands so their lines never cross.
 */
function mountains(hue: number): string {
  const [w, h] = [1600, 1000]
  const next = sequence(17)
  // Far ranges are fainter and smoother, near ones bolder and rougher, so the stack reads as depth.
  // [top of the highest peak, bottom of the lowest valley, midpoint rounds, roughness, line, haze]
  // Each range gets its own band, and the bands do not overlap, so no two ridgelines can cross.
  const layers: Array<[number, number, number, number, number, number]> = [
    [140, 330, 8, 0.55, 0.12, 0.04],
    [350, 540, 8, 0.58, 0.14, 0.055],
    [560, 750, 7, 0.6, 0.17, 0.07],
    [770, 940, 7, 0.62, 0.2, 0.085]
  ]
  // The haze under each ridge fades out toward the bottom of the picture, so no ridge has a hard edge.
  const range = (
    id: number,
    [top, bottom, rounds, roughness, line, fill]: (typeof layers)[number]
  ): string => {
    const d = ridgePoints(next, w, top, bottom, rounds, roughness)
      .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join('')
    const haze = `<linearGradient id="haze${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${h}"><stop offset="0" stop-color="${tint(hue, fill)}"/><stop offset="1" stop-color="${tint(hue, 0)}"/></linearGradient>`
    return `<defs>${haze}</defs><path d="${d}V${h}H0Z" fill="url(#haze${id})" stroke="none"/><path d="${d}" fill="none" stroke="${tint(hue, line)}" stroke-width="2.2" stroke-linejoin="round"/>`
  }
  const shapes = layers.map((layer, id) => range(id, layer))
  return `<svg ${NS} width="${w}" height="${h}">${shapes.join('')}</svg>`
}

/**
 * Contour lines of rolling hills, like a map. A few whole waves across the tile make the height
 * field, so it wraps and the tiles join; the lines are traced at even heights (marching squares),
 * and every fourth is drawn heavier, as on a real map.
 */
function topography(hue: number): string {
  const size = 640
  const step = 8
  const n = size / step
  const next = sequence(41)
  // Many waves of mixed sizes, the big ones strongest: broad rolling hills with smaller bumps on
  // them, and no one size that repeats often enough to spot.
  const waves = Array.from({ length: 12 }, () => {
    const kx = Math.floor(next() * 11) - 5
    const ky = Math.floor(next() * 11) - 5
    const [fx, fy] = kx === 0 && ky === 0 ? [1, 2] : [kx, ky]
    return {
      kx: fx,
      ky: fy,
      phase: next() * Math.PI * 2,
      amp: (0.6 + next()) / Math.hypot(fx, fy)
    }
  })
  // Fine, faint ripples on top: they make the contour lines wobble and fray like rough ground.
  for (let i = 0; i < 8; i++) {
    const sign = next() < 0.5 ? -1 : 1
    waves.push({
      kx: sign * (8 + Math.floor(next() * 7)),
      ky: Math.floor(next() * 29) - 14,
      phase: next() * Math.PI * 2,
      amp: 0.04 + next() * 0.06
    })
  }
  const height = (x: number, y: number): number =>
    waves.reduce(
      (sum, w) => sum + w.amp * Math.sin(((w.kx * x + w.ky * y) / size) * Math.PI * 2 + w.phase),
      0
    )
  const grid = Array.from({ length: n + 1 }, (_, j) =>
    Array.from({ length: n + 1 }, (_, i) => height(i * step, j * step))
  )
  const all = grid.flat()
  const [low, high] = [Math.min(...all), Math.max(...all)]
  const levels = 9
  const ordinary: string[] = []
  const index: string[] = []
  for (let k = 0; k < levels; k++) {
    const level = low + ((k + 0.5) / levels) * (high - low)
    const out = k % 4 === 0 ? index : ordinary
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const [tl, tr, br, bl] = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
        const at = (a: number, b: number): number => (level - a) / (b - a)
        // Where the line crosses each side of this square.
        const edge = {
          top: [(i + at(tl, tr)) * step, j * step],
          right: [(i + 1) * step, (j + at(tr, br)) * step],
          bottom: [(i + at(bl, br)) * step, (j + 1) * step],
          left: [i * step, (j + at(tl, bl)) * step]
        }
        const line = (a: keyof typeof edge, b: keyof typeof edge): void => {
          const [[x1, y1], [x2, y2]] = [edge[a], edge[b]]
          out.push(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`)
        }
        const inside =
          (tl >= level ? 1 : 0) |
          (tr >= level ? 2 : 0) |
          (br >= level ? 4 : 0) |
          (bl >= level ? 8 : 0)
        const centre = (tl + tr + br + bl) / 4 >= level
        switch (inside) {
          case 1:
          case 14:
            line('left', 'top')
            break
          case 2:
          case 13:
            line('top', 'right')
            break
          case 3:
          case 12:
            line('left', 'right')
            break
          case 4:
          case 11:
            line('right', 'bottom')
            break
          case 6:
          case 9:
            line('top', 'bottom')
            break
          case 7:
          case 8:
            line('left', 'bottom')
            break
          // Two opposite corners are high: the centre decides which way the lines pair up.
          case 5:
          case 10: {
            const joined = (inside === 5) === centre
            line(joined ? 'top' : 'left', joined ? 'right' : 'top')
            line(joined ? 'left' : 'right', 'bottom')
            break
          }
        }
      }
    }
  }
  const stroke = (d: string[], alpha: number, width: number): string =>
    `<path d="${d.join('')}" fill="none" stroke="${tint(hue, alpha, 72)}" stroke-width="${width}" stroke-linecap="round"/>`
  return `<svg ${NS} width="${size}" height="${size}">${stroke(ordinary, 0.09, 1)}${stroke(index, 0.17, 1.4)}</svg>`
}

/** One branch forking up and across the tile, with a leaf or two at each twig: a single tree up close. */
function branch(hue: number): string {
  const size = 360
  const next = sequence(13)
  const stems: string[] = []
  const leaves: string[] = []
  const grow = (
    x: number,
    y: number,
    len: number,
    lean: number,
    width: number,
    depth: number
  ): void => {
    const x2 = x + Math.sin(lean) * len
    const y2 = y - Math.cos(lean) * len
    // Keep the whole branch inside the tile, so no leaf is cut off at an edge.
    if (x2 < 16 || x2 > size - 16 || y2 < 16 || y2 > size - 16) return
    stems.push(`M${x.toFixed(1)} ${y.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`)
    const addLeaf = (lx: number, ly: number, scale: number): void => {
      const turn = (lean * 180) / Math.PI + (next() - 0.5) * 120
      leaves.push(place(lx, ly, turn, `<g transform="scale(${scale.toFixed(2)})">${leaf(hue)}</g>`))
    }
    if (depth === 0) {
      addLeaf(x2, y2, 0.6 + next() * 0.3)
      addLeaf(x2 + (next() - 0.5) * 14, y2 + (next() - 0.5) * 14, 0.5 + next() * 0.3)
      return
    }
    if (depth <= 2) addLeaf(x + (x2 - x) * 0.55, y + (y2 - y) * 0.55, 0.5 + next() * 0.25)
    grow(x2, y2, len * (0.74 + next() * 0.1), lean - (0.3 + next() * 0.4), width * 0.72, depth - 1)
    grow(x2, y2, len * (0.7 + next() * 0.1), lean + (0.25 + next() * 0.4), width * 0.72, depth - 1)
  }
  // Branches of different sizes reaching in from different sides, so the tile never reads as one sprig repeated.
  grow(size * 0.14, size * 0.96, 64, 0.5, 1.8, 4)
  grow(size * 0.95, size * 0.56, 50, -0.65, 1.5, 4)
  grow(size * 0.04, size * 0.4, 38, 1.05, 1.2, 3)
  const twigs = `<path d="${stems.join('')}" fill="none" stroke="${tint(hue, 0.15)}" stroke-width="1.3" stroke-linecap="round"/>`
  return `<svg ${NS} width="${size}" height="${size}">${twigs}${leaves.join('')}</svg>`
}

/** Draws a shape at its spot and, if it crosses a tile edge, again on the far side, so tiles join without a cut. */
function wrapped(
  w: number,
  h: number,
  x: number,
  y: number,
  reach: number,
  draw: (x: number, y: number) => string
): string {
  const xs = [x]
  if (x < reach) xs.push(x + w)
  if (x > w - reach) xs.push(x - w)
  const ys = [y]
  if (y < reach) ys.push(y + h)
  if (y > h - reach) ys.push(y - h)
  return xs.flatMap((px) => ys.map((py) => draw(px, py))).join('')
}

/** Rain as it looks falling: streaks of every length, near ones long and bright, far ones short and faint, with a few splashes. */
function rainfall(hue: number): string {
  const [w, h] = [256, 256]
  const next = sequence(3)
  const shapes: string[] = []
  for (let i = 0; i < 48; i++) {
    const [x, y] = [next() * w, next() * h]
    const near = next()
    const len = 6 + near * near * 30 + next() * 6
    const width = 0.7 + near * 1.1
    const lean = 0.2 + (next() - 0.5) * 0.1
    const fill = tint(hue, (0.05 + near * 0.17).toFixed(2), 78)
    shapes.push(
      wrapped(w, h, x, y, len + 4, (px, py) => {
        const [tx, ty] = [px - len * lean, py - len]
        return `<path d="M${tx.toFixed(1)} ${ty.toFixed(1)}L${(px - width / 2).toFixed(1)} ${py.toFixed(1)}L${(px + width / 2).toFixed(1)} ${py.toFixed(1)}Z" fill="${fill}"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(width / 2).toFixed(2)}" fill="${fill}"/>`
      })
    )
  }
  for (let i = 0; i < 9; i++) {
    const [x, y] = [next() * w, next() * h]
    const rx = 3 + next() * 4
    const stroke = tint(hue, (0.07 + next() * 0.07).toFixed(2), 78)
    shapes.push(
      wrapped(
        w,
        h,
        x,
        y,
        rx + 3,
        (px, py) =>
          `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${(rx * 0.35).toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="0.9"/>`
      )
    )
  }
  return `<svg ${NS} width="${w}" height="${h}">${shapes.join('')}</svg>`
}

/** Columns of falling code frozen mid-fall: a bright head, a fading trail, each column its own length and place. */
function matrixRain(hue: number): string {
  const [w, h] = [1600, 1000]
  const size = 18
  const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789{}[]=+*/;'
  const next = sequence(11)
  const shapes: string[] = []
  for (let x = 0; x < w; x += size) {
    // Several streams can share a column, never on the same rows, so the rain is dense but never a solid wall.
    const taken = new Set<number>()
    for (let stream = 0; stream < 3; stream++) {
      // Some streams are missing, so the rain is patchy.
      if (next() < 0.35) continue
      const length = 6 + Math.floor(next() * 28)
      const head = Math.floor(next() * (h / size + length))
      for (let i = 0; i < length; i++) {
        const row = head - i
        if (row < 0 || row * size > h || taken.has(row)) continue
        taken.add(row)
        const glyph = glyphs[Math.floor(next() * glyphs.length)]
        const fade = 1 - i / length
        const alpha = i === 0 ? 0.34 : 0.04 + fade * fade * 0.18
        shapes.push(
          `<text x="${x}" y="${row * size}" fill="${tint(hue, alpha.toFixed(2), i === 0 ? 88 : 70)}">${glyph}</text>`
        )
      }
    }
  }
  return `<svg ${NS} width="${w}" height="${h}"><g font-family="Menlo, 'Hiragino Kaku Gothic ProN', monospace" font-size="${size - 2}">${shapes.join('')}</g></svg>`
}

/** A few big bubbles, some middling ones and lots of tiny ones, none touching, each with a glint. */
function bubbleField(hue: number): string {
  const [w, h] = [1200, 1200]
  // The counts below are for a 320px field; scale them so the bubbles stay as dense.
  const crowd = (w * h) / (320 * 320)
  const next = sequence(11)
  const radii = [
    ...Array.from({ length: Math.round(3 * crowd) }, () => 26 + next() * 18),
    ...Array.from({ length: Math.round(5 * crowd) }, () => 10 + next() * 8),
    ...Array.from({ length: Math.round(22 * crowd) }, () => 1.8 + next() * 3.2)
  ]
  const placed: Array<[number, number, number]> = []
  const shapes: string[] = []
  for (const r of radii) {
    for (let tries = 0; tries < 300; tries++) {
      const [x, y] = [next() * w, next() * h]
      const clear = placed.every(([px, py, pr]) => {
        const [dx, dy] = [Math.abs(px - x), Math.abs(py - y)]
        return Math.hypot(Math.min(dx, w - dx), Math.min(dy, h - dy)) > r + pr + 6
      })
      if (!clear) continue
      placed.push([x, y, r])
      const ring = tint(hue, r > 8 ? 0.13 : 0.18, 76)
      shapes.push(
        wrapped(w, h, x, y, r + 2, (px, py) => {
          const body = `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" fill="${tint(hue, r > 8 ? 0.025 : 0, 76)}" stroke="${ring}" stroke-width="${r > 20 ? 1.2 : 1}"/>`
          if (r < 8) return body
          const rr = r * 0.72
          const at = (a: number): string =>
            `${(px + Math.cos(a) * rr).toFixed(1)} ${(py + Math.sin(a) * rr).toFixed(1)}`
          return `${body}<path d="M${at(-2.7)}A${rr.toFixed(1)} ${rr.toFixed(1)} 0 0 1 ${at(-1.95)}" fill="none" stroke="${tint(hue, 0.22, 82)}" stroke-width="1.3" stroke-linecap="round"/>`
        })
      )
      break
    }
  }
  return `<svg ${NS} width="${w}" height="${h}">${shapes.join('')}</svg>`
}

/**
 * Caustics: the soft, rippling light a pool throws onto its floor. Turbulence noise is cut into
 * bright cells, then blurred so their edges glow instead of showing as thin lines. It is drawn
 * once over the whole window rather than as a tile, so no repeat shows.
 */
function caustics(hue: number): string {
  const [w, h] = [1600, 1000]
  return `<svg ${NS} width="${w}" height="${h}"><filter id="light" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse"><feTurbulence type="turbulence" baseFrequency="0.006" numOctaves="1" seed="5" result="noise"/><feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -6 0 0 0 1.2" result="cells"/><feGaussianBlur in="cells" stdDeviation="6" result="lines"/><feFlood flood-color="${tint(hue, 0.16, 84)}"/><feComposite in2="lines" operator="in"/></filter><rect width="${w}" height="${h}" fill="#000" fill-opacity="0" filter="url(#light)"/></svg>`
}

/**
 * A printed circuit board seen from above, drawn once across the window and locked to one grid, so
 * the picture is even everywhere. Chips sit on an even lattice, each with a row of pins a side. The
 * right-angle traces, with chamfered corners and a few vias at the bends, start from the pins and
 * from points spread evenly over the board.
 */
function circuitTraces(hue: number): string {
  const [w, h] = [1600, 1000]
  const grid = 20
  const bevel = 8
  const next = sequence(73)
  const line = tint(hue, 0.3, 70)
  const inside = (x: number, y: number): boolean =>
    x >= grid && x <= w - grid && y >= grid && y <= h - grid
  const shapes: string[] = []

  // Chips on every other cell of a 200 px lattice, so they never touch.
  const chips: Array<{ x: number; y: number }> = []
  const pins: Array<{ x: number; y: number; dy: number }> = []
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2) continue
      const [x, y] = [100 + col * 200, 100 + row * 200]
      chips.push({ x, y })
      shapes.push(
        `<rect x="${x - 70}" y="${y - 30}" width="140" height="60" rx="4" fill="none" stroke="${line}" stroke-width="1.5"/>`,
        `<circle cx="${x - 56}" cy="${y - 16}" r="3" fill="${line}"/>`
      )
      for (let k = -3; k <= 3; k++) {
        const px = x + k * grid
        shapes.push(
          `<path d="M${px} ${y - 30}V${y - 40}M${px} ${y + 30}V${y + 40}" stroke="${line}" stroke-width="2"/>`
        )
        pins.push({ x: px, y: y - 40, dy: -1 }, { x: px, y: y + 40, dy: 1 })
      }
    }
  }
  const onChip = (x: number, y: number): boolean =>
    chips.some((chip) => Math.abs(chip.x - x) < 90 && Math.abs(chip.y - y) < 50)

  // Trace starts: a lattice of points 80 px apart over the whole board, and some of the pins.
  const starts: Array<{ x: number; y: number; vertical: boolean; sign: number }> = []
  for (let col = 0; col < 20; col++) {
    for (let row = 0; row < 12; row++) {
      const [x, y] = [40 + col * 80, 60 + row * 80]
      if (onChip(x, y) || next() >= 0.4) continue
      starts.push({ x, y, vertical: next() < 0.5, sign: next() < 0.5 ? -1 : 1 })
    }
  }
  for (const pin of pins) {
    if (next() < 0.25) starts.push({ x: pin.x, y: pin.y, vertical: true, sign: pin.dy })
  }

  // The trace is a run of right angles; each corner is cut back by the bevel, so it reads as a bend.
  const trail = (pts: Array<[number, number]>): string => {
    let d = `M${pts[0][0]} ${pts[0][1]}`
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, py] = pts[i - 1]
      const [x, y] = pts[i]
      const [nx, ny] = pts[i + 1]
      const c = Math.min(
        bevel,
        (Math.abs(x - px) + Math.abs(y - py)) / 2,
        (Math.abs(nx - x) + Math.abs(ny - y)) / 2
      )
      const [ux, uy] = [Math.sign(x - px), Math.sign(y - py)]
      const [vx, vy] = [Math.sign(nx - x), Math.sign(ny - y)]
      d += `L${x - ux * c} ${y - uy * c}L${x + vx * c} ${y + vy * c}`
    }
    const [lx, ly] = pts[pts.length - 1]
    return `${d}L${lx} ${ly}`
  }
  for (const start of starts) {
    let { x, y, vertical, sign } = start
    const pts: Array<[number, number]> = [[x, y]]
    const legs = 3 + Math.floor(next() * 3)
    for (let leg = 0; leg < legs; leg++) {
      const len = 80 * (1 + Math.floor(next() * 2))
      const [nx, ny] = vertical ? [x, y + sign * len] : [x + sign * len, y]
      if (!inside(nx, ny)) break
      ;[x, y] = [nx, ny]
      pts.push([x, y])
      vertical = !vertical
      sign = next() < 0.5 ? -1 : 1
    }
    if (pts.length < 2) continue
    shapes.push(
      `<path d="${trail(pts)}" fill="none" stroke="${tint(hue, 0.22, 70)}" stroke-width="2"/>`
    )
    for (const [px, py] of [pts[0], pts[pts.length - 1]]) {
      shapes.push(`<circle cx="${px}" cy="${py}" r="3.5" fill="${tint(hue, 0.34, 80)}"/>`)
    }
    for (let i = 1; i < pts.length - 1; i++) {
      if (next() < 0.25) {
        shapes.push(
          `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="5" fill="none" stroke="${line}" stroke-width="1.5"/>`
        )
      }
    }
  }
  return `<svg ${NS} width="${w}" height="${h}">${shapes.join('')}</svg>`
}

/**
 * Leafy boughs reaching in from the edges. Each limb bends a little as it grows, thins toward the
 * tip, and puts out side twigs on alternating sides; leaves hang from short stalks along the twigs.
 */
function boughs(hue: number): string {
  const size = 340
  const next = sequence(41)
  const wood: string[] = []
  const leaves: string[] = []
  const inside = (x: number, y: number): boolean =>
    x > 14 && x < size - 14 && y > 14 && y < size - 14
  const hang = (x: number, y: number, heading: number, scale: number): void => {
    const [dx, dy] = [Math.sin(heading), -Math.cos(heading)]
    const stalk = 4 * scale
    const reach = (stalk + 10 * scale).toFixed(1)
    wood.push(
      `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l${(dx * stalk).toFixed(1)} ${(dy * stalk).toFixed(1)}" stroke-width="0.8"/>`
    )
    leaves.push(
      place(
        x + dx * Number(reach),
        y + dy * Number(reach),
        (heading * 180) / Math.PI,
        `<g transform="scale(${scale.toFixed(2)})">${leaf(hue)}</g>`
      )
    )
  }
  const limb = (
    x: number,
    y: number,
    dir: number,
    len: number,
    width: number,
    depth: number
  ): void => {
    const steps = 3 + depth
    const seg = len / steps
    let [cx, cy, heading, thick, side] = [x, y, dir, width, next() < 0.5 ? 1 : -1]
    for (let i = 0; i < steps; i++) {
      heading += (next() - 0.5) * 0.4
      const [nx, ny] = [cx + Math.sin(heading) * seg, cy - Math.cos(heading) * seg]
      if (!inside(nx, ny)) return
      wood.push(
        `<path d="M${cx.toFixed(1)} ${cy.toFixed(1)}L${nx.toFixed(1)} ${ny.toFixed(1)}" stroke-width="${thick.toFixed(2)}"/>`
      )
      if (i > 0 && i % 2 === 1 && depth > 0 && next() < 0.7) {
        limb(
          nx,
          ny,
          heading + side * (0.55 + next() * 0.5),
          len * (0.4 + next() * 0.2),
          thick * 0.6,
          depth - 1
        )
      }
      if (depth <= 1 && next() < 0.55)
        hang(nx, ny, heading - side * (0.8 + next() * 0.6), 0.42 + next() * 0.2)
      cx = nx
      cy = ny
      thick *= 0.9
      side = -side
    }
    hang(cx, cy, heading, 0.55 + next() * 0.2)
  }
  limb(10, size * 0.9, 0.9, 170, 2.4, 2)
  limb(size * 0.55, size - 6, -0.3, 150, 2.2, 2)
  limb(size - 8, size * 0.22, -2.1, 130, 1.8, 2)
  // Solid, faded by the group's stroke-opacity, so twigs that overlap at a joint do not double up.
  const stem = `hsl(${hue} 90% 74%)`
  return `<svg ${NS} width="${size}" height="${size}"><g stroke="${stem}" stroke-opacity="0.17" fill="none" stroke-linecap="round">${wood.join('')}</g>${leaves.join('')}</svg>`
}

/** A solid color in a hue (grey for the black chat), for shapes faded together by a group's opacity. */
const solid = (hue: number, sat: number, light: number): string =>
  `hsl(${hue === BLACK_HUE ? '0 0%' : `${hue} ${sat}%`} ${light}%)`

/**
 * One big pumpkin sitting in dirt, as a single picture covering the window: bare soil with clods,
 * pebbles and a few furrows, then the pumpkin's shadow, its ribbed lobes (the middle one drawn last,
 * so it overlaps its neighbours), a thick stem, and a curling vine with a leaf.
 */
function pumpkinPatch(hue: number): string {
  const [w, h] = [1600, 1000]
  const next = sequence(31)
  const [cx, cy] = [800, 570]
  const line = solid(hue, 90, 74)

  // The ground is seen from the side: it starts at a horizon, and everything on it shrinks and
  // flattens toward the back, so the dirt sits in the same view as the pumpkin.
  const horizon = 330
  const depth = (y: number): number => (y - horizon) / (h - horizon)
  const inPatch = (x: number, y: number, pad: number): boolean =>
    ((x - cx) / (400 + pad)) ** 2 + ((y - cy) / (330 + pad)) ** 2 < 1

  // Clods and pebbles, wide and flat, bigger the closer they are.
  const soil: string[] = []
  for (let i = 0; i < 340; i++) {
    const x = next() * w
    const y = horizon + 10 + next() * (h - horizon - 10)
    const r = (3 + next() * next() * 26) * (0.25 + depth(y) * 0.9)
    if (inPatch(x, y, 0)) continue
    soil.push(
      `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${r.toFixed(1)}" ry="${(r * (0.28 + next() * 0.14)).toFixed(1)}" fill="${solid(hue, 50, 30)}" stroke="${line}" stroke-width="1"/>`
    )
  }
  // Furrows run away from the viewer, fanning out from the horizon to well past both sides.
  const furrows: string[] = []
  for (let i = -9; i <= 9; i++) {
    if (i === 0) continue
    const bottomX = cx + i * 270 + (next() - 0.5) * 80
    const midX = cx + (bottomX - cx) * 0.5 + (next() - 0.5) * 30
    furrows.push(
      `<path d="M${cx + i * 36} ${horizon + 6}Q${midX.toFixed(0)} ${(horizon + h) / 2} ${bottomX.toFixed(0)} ${h + 20}" fill="none" stroke="${line}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="${(90 + next() * 90).toFixed(0)} ${(25 + next() * 40).toFixed(0)}"/>`
    )
  }
  // A few grass tufts, upright and larger toward the front.
  const tufts: string[] = []
  for (let i = 0; i < 36; i++) {
    const x = next() * w
    const y = horizon + 30 + next() * (h - horizon - 40)
    if (inPatch(x, y, 20)) continue
    const k = 0.4 + depth(y) * 1.1
    const blades = [-8, 0, 8].map(
      (dx) =>
        `M${x.toFixed(0)} ${y.toFixed(0)}q${(dx * 0.3 * k).toFixed(1)} ${(-12 * k).toFixed(1)} ${(dx * k).toFixed(1)} ${(-(18 + next() * 12) * k).toFixed(1)}`
    )
    tufts.push(
      `<path d="${blades.join('')}" fill="none" stroke="${line}" stroke-width="1.6" stroke-linecap="round"/>`
    )
  }

  // Other pumpkins out in the field, drawn the same way as the big one but smaller and flatter-
  // looking the further back they sit, farthest first so nearer ones overlap them.
  const spots: Array<[number, number]> = []
  for (let i = 0; i < 200 && spots.length < 14; i++) {
    const [x, y] = [next() * w, horizon + 18 + next() * next() * 330]
    const crowded = spots.some(
      ([sx, sy]) => Math.abs(sx - x) < 130 + depth(y) * 200 && Math.abs(sy - y) < 70
    )
    if (!inPatch(x, y - 40, 90) && !crowded) spots.push([x, y])
  }
  spots.sort((p, q) => p[1] - q[1])
  const grove = `fill="${solid(hue, 55, 28)}" stroke="${line}" stroke-width="1.6" stroke-linejoin="round"`
  const farPumpkins = spots.map(([x, y]) => {
    const s = 12 + depth(y) * 100 * (0.8 + next() * 0.4)
    const mid = y - s
    const lobe = (dx: number, rx: number, ry: number): string =>
      `<ellipse cx="${(x + dx * s).toFixed(1)}" cy="${mid.toFixed(1)}" rx="${(rx * s).toFixed(1)}" ry="${(ry * s).toFixed(1)}"/>`
    const stalk = `<path d="M${(x - 0.1 * s).toFixed(1)} ${(mid - 0.9 * s).toFixed(1)}L${(x - 0.06 * s).toFixed(1)} ${(mid - 1.25 * s).toFixed(1)}L${(x + 0.14 * s).toFixed(1)} ${(mid - 1.2 * s).toFixed(1)}L${(x + 0.1 * s).toFixed(1)} ${(mid - 0.9 * s).toFixed(1)}Z"/>`
    const lobes = [
      lobe(-0.94, 0.44, 0.88),
      lobe(0.94, 0.44, 0.88),
      lobe(-0.55, 0.55, 0.96),
      lobe(0.55, 0.55, 0.96),
      lobe(0, 0.55, 1)
    ].join('')
    return {
      // Black copy of the body, to cut it out of the dirt layers drawn behind it.
      hole: lobes.replaceAll('/>', ' fill="#000"/>'),
      art: `<g ${grove}><ellipse cx="${(x + s * 0.1).toFixed(1)}" cy="${y.toFixed(1)}" rx="${(s * 1.5).toFixed(1)}" ry="${(s * 0.22).toFixed(1)}" fill="${solid(hue, 60, 14)}" stroke="none"/>${lobes}${stalk}</g>`
    }
  })
  const pumpkins = farPumpkins.map((f) => f.art).join('')
  const farHoles = farPumpkins.map((f) => f.hole).join('')

  // Lobes, outermost first: x offset from centre, half width, half height.
  const lobes: Array<[number, number, number]> = [
    [-255, 120, 238],
    [255, 120, 238],
    [-150, 150, 262],
    [150, 150, 262],
    [0, 150, 272]
  ]
  // Each lobe's outline wobbles a little, by a few slow sine waves with their own phases, so
  // the ribs read as grown rather than drawn with a compass.
  const wavy = (x: number, rx: number, ry: number): string => {
    const waves = [3, 5, 8].map((k, i) => ({ k, amp: 0.026 / (i + 1), phase: next() * 6.28 }))
    const pts: string[] = []
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2
      const r = 1 + waves.reduce((sum, v) => sum + v.amp * Math.sin(v.k * a + v.phase), 0)
      pts.push(`${(x + rx * r * Math.cos(a)).toFixed(1)} ${(cy + ry * r * Math.sin(a)).toFixed(1)}`)
    }
    return `M${pts.join('L')}Z`
  }
  const lobePaths = lobes.map(([dx, rx, ry]) => wavy(cx + dx, rx, ry))
  const body = lobePaths
    .map(
      (d) =>
        `<path d="${d}" fill="${solid(hue, 60, 34)}" stroke="${line}" stroke-width="2.4" stroke-linejoin="round"/>`
    )
    .join('')
  // A few rib lines down the middle lobe, each swaying as it goes.
  const ribs = [-70, -25, 25, 70]
    .map((dx) => {
      const phase = next() * 6.28
      const pts: string[] = []
      for (let i = 0; i <= 40; i++) {
        const t = i / 40
        const bow = Math.sin(Math.PI * t) * 0.35 + 0.65
        const x = cx + dx * bow + Math.sin(t * 11 + phase) * 5
        pts.push(`${x.toFixed(1)} ${(cy - 245 + 490 * t).toFixed(1)}`)
      }
      return `<path d="M${pts.join('L')}" fill="none" stroke="${line}" stroke-width="1.5" stroke-linecap="round"/>`
    })
    .join('')

  // The pumpkin's outline, in black, to hide the dirt behind it.
  const cutout = lobePaths.map((d) => `<path d="${d}" fill="#000"/>`).join('')

  const stemTop = [cx + 30, cy - 330]
  const stem = `<path d="M${cx - 34} ${cy - 262}C${cx - 40} ${cy - 300} ${cx - 10} ${cy - 330} ${stemTop[0] - 22} ${stemTop[1]}L${stemTop[0] + 24} ${stemTop[1] - 6}C${cx + 40} ${cy - 320} ${cx + 38} ${cy - 290} ${cx + 34} ${cy - 262}Z" fill="${solid(hue, 60, 30)}" stroke="${line}" stroke-width="2.4" stroke-linejoin="round"/>`

  // A vine curling from the stem across the dirt, with a curl at its end and a broad leaf.
  const vine = `<path d="M${cx + 30} ${cy - 300}C${cx + 160} ${cy - 400} ${cx + 470} ${cy - 330} ${cx + 470} ${cy - 100}C${cx + 470} ${cy + 120} ${cx + 450} ${cy + 200} ${cx + 500} ${cy + 225}C${cx + 545} ${cy + 245} ${cx + 565} ${cy + 200} ${cx + 540} ${cy + 185}" fill="none" stroke="${line}" stroke-width="5" stroke-linecap="round"/>`
  const leafShape = `<g transform="translate(${cx + 190} ${cy - 372}) rotate(-24)"><path d="M0 0C20 -70 110 -80 150 -30C175 10 120 60 60 50C40 70 10 40 0 0Z" fill="${solid(hue, 60, 30)}" stroke="${line}" stroke-width="2.4" stroke-linejoin="round"/><path d="M0 0C50 -10 100 -10 140 -26M60 -8L80 -44M60 -8L84 18M100 -14L118 -44" fill="none" stroke="${line}" stroke-width="1.6" stroke-linecap="round"/></g>`

  return `<svg ${NS} width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fff"/>${cutout}</mask>
<mask id="cutDirt" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fff"/>${cutout}${farHoles}</mask>
<g mask="url(#cutDirt)">
<g opacity="0.1">${furrows.join('')}</g>
<g opacity="0.16">${soil.join('')}</g>
<g opacity="0.2">${tufts.join('')}</g>
</g>
<g mask="url(#cut)">
<g opacity="0.16">${pumpkins}</g>
<ellipse cx="${cx + 40}" cy="${cy + 255}" rx="430" ry="70" fill="${solid(hue, 60, 14)}" opacity="0.5"/>
</g>
<g opacity="0.3">${leafShape}${vine}${body}${ribs}${stem}</g>
</svg>`
}

const GENERATORS: Record<Exclude<TextureKind, 'none'>, Generator> = {
  stars: { label: 'Stars', svg: stars, width: 1200, height: 1200, scene: true },
  forest: { label: 'Forest', svg: forest, width: 288, height: 224 },
  mountains: { label: 'Mountains', svg: mountains, width: 1600, height: 1000, scene: true },
  branch: { label: 'Branch', svg: branch, width: 360, height: 360 },
  topography: { label: 'Topography', svg: topography, width: 640, height: 640 },
  matrix: { label: 'Matrix', svg: matrixRain, width: 1600, height: 1000, scene: true },
  castle: { label: 'Castle', svg: castleSvg, width: 1600, height: 1000, scene: true },
  chess: { label: 'Chess', svg: chessSvg, width: 1600, height: 1000, scene: true },
  circuits: { label: 'Circuits', svg: circuitTraces, width: 1600, height: 1000, scene: true },
  claude: { label: 'Claude', svg: claudeSvg, width: 1600, height: 1000, scene: true },
  andromeda: { label: 'Andromeda', svg: andromedaSvg, width: 1600, height: 1000, scene: true },
  // Keeps the old "waves" id, so chats already given this texture still find it.
  caustics: { label: 'Caustics', svg: caustics, width: 1600, height: 1000, scene: true },
  dots: {
    label: 'Dots',
    svg: (h) =>
      `<svg ${NS} width="28" height="28"><circle cx="7" cy="7" r="1.1" fill="${tint(h, 0.16)}"/><circle cx="21" cy="21" r="1.1" fill="${tint(h, 0.16)}"/></svg>`,
    width: 28,
    height: 28
  },
  grid: {
    label: 'Grid',
    svg: (h) =>
      `<svg ${NS} width="32" height="32"><path d="M0.5 0V32M0 0.5H32" fill="none" stroke="${tint(h, 0.07)}" stroke-width="1"/></svg>`,
    width: 32,
    height: 32
  },
  diamonds: {
    label: 'Diamonds',
    svg: (h) =>
      `<svg ${NS} width="36" height="36"><path d="M18 3L33 18L18 33L3 18Z" fill="none" stroke="${tint(h, 0.09)}" stroke-width="1"/></svg>`,
    width: 36,
    height: 36
  },
  rain: { label: 'Rain', svg: rainfall, width: 256, height: 256 },
  bubbles: { label: 'Bubbles', svg: bubbleField, width: 1200, height: 1200, scene: true },
  crosses: {
    label: 'Crosses',
    svg: (h) =>
      `<svg ${NS} width="32" height="32"><path d="M16 11v10M11 16h10" fill="none" stroke="${tint(h, 0.13)}" stroke-width="1.2" stroke-linecap="round"/></svg>`,
    width: 32,
    height: 32
  },
  zigzag: {
    label: 'Zigzag',
    svg: (h) =>
      `<svg ${NS} width="24" height="14"><path d="M0 10L6 4L12 10L18 4L24 10" fill="none" stroke="${tint(h, 0.08)}" stroke-width="1"/></svg>`,
    width: 24,
    height: 14
  },
  triangles: {
    label: 'Triangles',
    svg: (h) =>
      `<svg ${NS} width="30" height="26"><path d="M15 3L27 23H3Z" fill="none" stroke="${tint(h, 0.09)}" stroke-width="1"/></svg>`,
    width: 30,
    height: 26
  },
  confetti: { label: 'Confetti', svg: confetti, width: 160, height: 160 },
  hearts: { label: 'Hearts', svg: hearts, width: 120, height: 120 },
  fireworks: { label: 'Fireworks', svg: fireworks, width: 150, height: 150 },
  shamrocks: {
    label: 'Shamrocks',
    svg: (h) =>
      scatter(
        h,
        96,
        [
          [22, 20, -10, 1],
          [70, 34, 14, 0.8],
          [38, 70, 6, 0.7],
          [82, 82, -16, 1]
        ],
        (hue, i) => shamrock(hue, 0.14 + (i % 2) * 0.05)
      ),
    width: 96,
    height: 96
  },
  eggs: {
    label: 'Eggs',
    svg: (h) =>
      scatter(
        h,
        96,
        [
          [24, 24, -14, 1],
          [72, 38, 12, 0.8],
          [34, 74, 8, 0.7],
          [80, 82, -10, 0.9]
        ],
        egg
      ),
    width: 96,
    height: 96
  },
  pumpkins: { label: 'Pumpkins', svg: pumpkinPatch, width: 1600, height: 1000, scene: true },
  leaves: { label: 'Leaves', svg: boughs, width: 340, height: 340 },
  snowflakes: { label: 'Snowflakes', svg: snowflakes, width: 1600, height: 1000, scene: true }
}

/** Every texture, in the order the menu goes through them; "none" last. */
export const TEXTURE_KINDS: readonly TextureKind[] = [
  ...(Object.keys(GENERATORS) as Array<Exclude<TextureKind, 'none'>>),
  'none'
]

/** The textures a chat can be given on its own: all but "none". */
export const ASSIGNABLE_TEXTURES: readonly TextureKind[] = TEXTURE_KINDS.filter(
  (kind) => kind !== 'none'
)

/**
 * The folders the menu groups textures into. Every real texture is in exactly one; "none" stays
 * outside them, since it is not a picture.
 */
export const TEXTURE_FOLDERS: ReadonlyArray<{ name: string; kinds: readonly TextureKind[] }> = [
  {
    name: 'Patterns',
    kinds: [
      'dots',
      'grid',
      'diamonds',
      'crosses',
      'zigzag',
      'triangles',
      'rain',
      'bubbles',
      'leaves'
    ]
  },
  {
    name: 'Nature',
    kinds: ['stars', 'andromeda', 'forest', 'mountains', 'caustics', 'branch', 'topography']
  },
  {
    name: 'Holidays',
    kinds: ['confetti', 'hearts', 'fireworks', 'shamrocks', 'eggs', 'pumpkins', 'snowflakes']
  },
  { name: 'Places', kinds: ['castle', 'chess'] },
  { name: 'Tech', kinds: ['matrix', 'circuits', 'claude'] }
]

export function textureLabel(kind: TextureKind): string {
  return kind === 'none' ? 'No texture' : GENERATORS[kind].label
}

/** The CSS for a texture: the picture, the size of one tile, and where it sits. Null for none. */
export function textureCss(
  kind: TextureKind,
  hue: number
): { image: string; size: string; position: string } | null {
  if (kind === 'none') return null
  const generator = GENERATORS[kind]
  return {
    image: `url("data:image/svg+xml,${encodeURIComponent(generator.svg(baseHue(hue)))}")`,
    size: generator.scene ? 'cover' : `${generator.width}px ${generator.height}px`,
    position: generator.scene ? 'center' : '0 0'
  }
}

export const TEXTURE_IMAGE_VAR = '--app-texture'
export const TEXTURE_SIZE_VAR = '--app-texture-size'
export const TEXTURE_POSITION_VAR = '--app-texture-position'
