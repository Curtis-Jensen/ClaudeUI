/**
 * The Andromeda galaxy seen nearly edge-on, drawn once across the whole window: a warm glowing
 * core, two blue-white spiral arms with dark dust lanes, and its two small companions, with
 * distant stars around it. The glow and the stars take a hint of the chat's color.
 */
import { BLACK_HUE } from './thread-theme'

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const W = 1600
const H = 1000

/** A color at `alpha` in a hue; black chats stay neutral gray. */
const tint = (hue: number, alpha: number, light = 74): string =>
  `hsl(${hue === BLACK_HUE ? '0 0%' : `${hue} 90%`} ${light}% / ${alpha})`

/** A small deterministic sequence, so the galaxy is drawn the same way every time. */
function sequence(seed: number): () => number {
  let state = seed
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const round = (n: number): number => Math.round(n * 10) / 10

/** The galaxy's long axis, turned from level, and how open the disk is (1 = face-on). */
const TILT = (-32 * Math.PI) / 180
const OPEN = 0.3
const REACH = 920
const ARMS = 2
const WIND = 3.4

/** A spot in the galaxy's own flat plane, laid onto the window. */
function project(gx: number, gy: number): [number, number] {
  const flat = gy * OPEN
  return [
    W / 2 + gx * Math.cos(TILT) - flat * Math.sin(TILT),
    H / 2 + gx * Math.sin(TILT) + flat * Math.cos(TILT)
  ]
}

/** The angle of an arm at a distance from the middle, as a fraction of REACH. */
const armAngle = (arm: number, along: number): number =>
  arm * Math.PI + WIND * Math.log(1 + along * 4)

/** Scatter with a bell-shaped spread, from two uniform draws. */
const bell = (next: () => number): number =>
  Math.sqrt(-2 * Math.log(next() + 1e-9)) * Math.cos(2 * Math.PI * next())

function distantStars(hue: number, next: () => number): string {
  let out = ''
  for (let i = 0; i < 260; i++) {
    const bright = Math.pow(next(), 4)
    const warm = next() < 0.25
    const fill = warm
      ? 'hsl(30 90% 85%'
      : next() < 0.5
        ? 'hsl(215 90% 88%'
        : tint(hue, 1, 90).slice(0, -4)
    out += `<circle cx="${round(next() * W)}" cy="${round(next() * H)}" r="${round(0.5 + bright * 1.3)}" fill="${fill} / ${round(0.12 + bright * 0.28)})"/>`
  }
  return out
}

/**
 * Andromeda's disk is a broad smooth glow with bright rings of star-forming gas, not two sharp
 * arms: most stars sit in a fading disk, a good share in two rings, and the rest on loose arms.
 */
function armStars(next: () => number): string {
  let out = ''
  for (let i = 0; i < 6500; i++) {
    const pick = next()
    let along: number
    let angle = next() * Math.PI * 2
    if (pick < 0.4) {
      along = Math.min(1, -Math.log(1 - next() * 0.97) * 0.38)
    } else if (pick < 0.7) {
      along = Math.max(0.02, next() < 0.55 ? 0.3 + bell(next) * 0.05 : 0.62 + bell(next) * 0.09)
    } else {
      along = Math.pow(next(), 1.4)
      angle = armAngle(Math.floor(next() * ARMS), along) + bell(next) * (0.45 + along * 0.2)
    }
    // Fold the straggling tail back in, so the disk ends in an edge instead of fading to nothing.
    if (along > 0.93) along = 0.93 - next() * 0.08
    const [x, y] = project(
      Math.cos(angle) * along * REACH + bell(next) * 8,
      Math.sin(angle) * along * REACH + bell(next) * 8
    )
    // Old yellow stars toward the middle, young blue-white ones out in the rings.
    const t = Math.min(1, along * 1.5)
    const color = `rgb(${Math.round(255 - t * 100)} ${Math.round(205 - t * 20)} ${Math.round(150 + t * 105)})`
    out += `<circle cx="${round(x)}" cy="${round(y)}" r="${round(0.5 + next() * 1.3)}" fill="${color}" fill-opacity="${round((0.1 + next() * 0.3) * (1 - along * 0.35) * Math.min(1, 0.25 + along * 2.5))}"/>`
  }
  return out
}

/** Pink and blue knots of new stars strung along the arms. */
function starClouds(next: () => number): string {
  let out = ''
  for (let i = 0; i < 150; i++) {
    const along = 0.22 + next() * 0.7
    const angle = armAngle(Math.floor(next() * ARMS), along) + bell(next) * 0.08
    const [x, y] = project(Math.cos(angle) * along * REACH, Math.sin(angle) * along * REACH)
    const color = next() < 0.5 ? '255 150 200' : '150 190 255'
    out += `<circle cx="${round(x)}" cy="${round(y)}" r="${round(1.5 + next() * 3.5)}" fill="rgb(${color} / 0.2)"/>`
  }
  return out
}

/** Dark dust hugging the inner edge of each arm, blurred so it reads as lanes, not dots. */
function dustLanes(hue: number, next: () => number): string {
  const ink = hue === BLACK_HUE ? 'hsl(0 0% 3%' : `hsl(${hue} 70% 4%`
  let out = ''
  // Short curved filaments along the two gas rings, each a run of soft dark dabs.
  for (let lane = 0; lane < 22; lane++) {
    const ring = next() < 0.5 ? 0.22 : 0.5
    const start = next() * Math.PI * 2
    const span = 0.5 + next() * 0.9
    for (let i = 0; i < 18; i++) {
      const along = ring + bell(next) * 0.025
      const angle = start + (i / 18) * span
      const [x, y] = project(Math.cos(angle) * along * REACH, Math.sin(angle) * along * REACH)
      out += `<circle cx="${round(x)}" cy="${round(y)}" r="${round(5 + next() * 11)}" fill="${ink} / 0.1)"/>`
    }
  }
  return `<g filter="url(#soft)">${out}</g>`
}

export function andromedaSvg(hue: number): string {
  const next = sequence(31)
  const turn = round((TILT * 180) / Math.PI)
  const [m32x, m32y] = project(REACH * 0.12, -REACH * 0.95)
  const [m110x, m110y] = project(-REACH * 0.55, REACH * 1.25)
  return (
    `<svg ${NS} width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>` +
    `<radialGradient id="halo"><stop offset="0" stop-color="${tint(hue, 0.12, 72)}"/><stop offset="0.5" stop-color="${tint(hue, 0.07, 60)}"/><stop offset="1" stop-color="${tint(hue, 0, 50)}"/></radialGradient>` +
    `<radialGradient id="disk"><stop offset="0" stop-color="rgb(170 190 255 / 0.1)"/><stop offset="0.7" stop-color="rgb(120 150 230 / 0.08)"/><stop offset="0.9" stop-color="rgb(110 140 225 / 0.07)"/><stop offset="1" stop-color="rgb(100 130 220 / 0)"/></radialGradient>` +
    `<radialGradient id="bulge"><stop offset="0" stop-color="rgb(255 238 205 / 0.14)"/><stop offset="0.15" stop-color="rgb(255 214 150 / 0.1)"/><stop offset="0.5" stop-color="rgb(230 160 100 / 0.06)"/><stop offset="1" stop-color="rgb(200 120 80 / 0)"/></radialGradient>` +
    `<radialGradient id="nucleus"><stop offset="0" stop-color="rgb(255 255 255 / 0.12)"/><stop offset="0.4" stop-color="rgb(255 240 210 / 0.08)"/><stop offset="1" stop-color="rgb(255 220 170 / 0)"/></radialGradient>` +
    `<radialGradient id="companion"><stop offset="0" stop-color="rgb(255 230 190 / 0.35)"/><stop offset="0.4" stop-color="rgb(240 190 140 / 0.15)"/><stop offset="1" stop-color="rgb(220 160 110 / 0)"/></radialGradient>` +
    `</defs>` +
    distantStars(hue, next) +
    `<g transform="translate(${W / 2} ${H / 2}) rotate(${turn})">` +
    `<ellipse rx="${REACH * 1.1}" ry="${round(REACH * (OPEN + 0.12) * 1.1)}" fill="url(#halo)"/></g>` +
    `<g transform="translate(${W / 2} ${H / 2}) rotate(${turn})"><ellipse rx="${REACH * 0.95}" ry="${round(REACH * OPEN * 0.95)}" fill="url(#disk)"/></g>` +
    armStars(next) +
    starClouds(next) +
    dustLanes(hue, next) +
    `<g transform="translate(${W / 2} ${H / 2}) rotate(${turn})">` +
    `<ellipse rx="${REACH * 0.36}" ry="${round(REACH * 0.2)}" fill="url(#bulge)"/>` +
    `<circle r="${round(REACH * 0.05)}" fill="url(#nucleus)"/></g>` +
    `<circle cx="${round(m32x)}" cy="${round(m32y)}" r="${round(REACH * 0.05)}" fill="url(#companion)"/>` +
    `<g transform="translate(${round(m110x)} ${round(m110y)}) rotate(${round(turn + 28)})">` +
    `<ellipse rx="${round(REACH * 0.12)}" ry="${round(REACH * 0.06)}" fill="url(#companion)" fill-opacity="0.6"/></g>` +
    `</svg>`
  )
}
