/**
 * The Claude starburst drawn as outlines, once across the whole window: one big logo in the
 * middle and a scatter of small ones in the margins, each turned a different way. Faint and
 * tinted with the chat's color, like the textures.
 */
import { BLACK_HUE } from './thread-theme'

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const W = 1600
const H = 1000

/** A line color at `alpha` in a hue. */
const tint = (hue: number, alpha: number, light = 74): string =>
  `hsl(${hue === BLACK_HUE ? '0 0%' : `${hue} 90%`} ${light}% / ${alpha})`

/** The logo's outline, in a 1200 by 1200 box. */
const LOGO =
  'M 233.9 800.2 L 468.6 668.5 L 472.5 657.1 L 468.6 650.7 L 457.2 650.7 L 417.9 648.3 L 283.8 644.6 L 167.5 639.8 L 54.9 633.8 L 26.5 627.7 L 3.3e-05 592.7 L 2.7 575.2 L 26.5 559.2 L 60.7 562.2 L 136.1 567.3 L 249.4 575.1 L 331.5 580.0 L 453.2 592.6 L 472.5 592.6 L 475.3 584.8 L 468.7 580.0 L 463.5 575.1 L 346.3 495.7 L 219.5 411.8 L 153.1 363.5 L 117.1 339.0 L 99.0 316.1 L 91.2 266.0 L 123.8 230.0 L 167.6 233.0 L 178.8 236.0 L 223.2 270.2 L 318.0 343.5 L 441.8 434.7 L 459.9 449.7 L 467.1 444.6 L 468.0 441.0 L 459.9 427.4 L 392.6 305.7 L 320.7 181.9 L 288.8 130.6 L 280.3 99.8 C 277.3 87.2 275.1 76.5 275.1 63.6 L 312.3 13.2 L 332.8 6.6 L 382.3 13.2 L 403.2 31.3 L 434.0 101.7 L 483.8 212.5 L 561.1 363.2 L 583.8 407.9 L 595.8 449.3 L 600.4 461.9 L 608.2 461.9 L 608.2 454.7 L 614.5 369.8 L 626.3 265.6 L 637.7 131.5 L 641.7 93.7 L 660.4 48.4 L 697.5 24.0 L 726.5 37.8 L 750.3 72 L 747.0 94.0 L 732.8 186.2 L 705.1 330.5 L 686.9 427.1 L 697.5 427.1 L 709.6 415.0 L 758.4 350.1 L 840.6 247.4 L 876.8 206.7 L 919.1 161.7 L 946.3 140.2 L 997.6 140.2 L 1035.3 196.4 L 1018.4 254.4 L 965.6 321.4 L 921.8 378.2 L 859.0 462.7 L 819.7 530.4 L 823.4 535.8 L 832.7 534.9 L 974.6 504.7 L 1051.3 490.8 L 1142.8 475.1 L 1184.2 494.4 L 1188.7 514.1 L 1172.4 554.3 L 1074.6 578.4 L 959.8 601.4 L 788.9 641.8 L 786.8 643.4 L 789.2 646.3 L 866.2 653.6 L 899.1 655.4 L 979.8 655.4 L 1129.9 666.6 L 1169.1 692.5 L 1192.6 724.2 L 1188.7 748.4 L 1128.3 779.1 L 1046.8 759.8 L 856.5 714.6 L 791.3 698.3 L 782.3 698.3 L 782.3 703.7 L 836.6 756.8 L 936.3 846.8 L 1061.0 962.8 L 1067.4 991.4 L 1051.4 1014.1 L 1034.4 1011.7 L 924.8 929.2 L 882.6 892.1 L 786.8 811.4 L 780.4 811.4 L 780.4 819.9 L 802.5 852.2 L 919.0 1027.4 L 925.1 1081.1 L 916.6 1098.6 L 886.4 1109.1 L 853.2 1103.1 L 785.0 1007.3 L 714.6 899.5 L 657.9 802.8 L 650.9 806.8 L 617.4 1167.7 L 601.7 1186.1 L 565.5 1200 L 535.3 1177.0 L 519.3 1139.9 L 535.3 1066.5 L 554.6 970.7 L 570.3 894.6 L 584.5 800.1 L 592.9 768.7 L 592.4 766.6 L 585.5 767.5 L 514.2 865.3 L 405.8 1011.8 L 320.0 1103.6 L 299.5 1111.8 L 263.9 1093.3 L 267.2 1060.4 L 287.1 1031.1 L 405.8 880.1 L 477.4 786.5 L 523.6 732.4 L 523.3 724.6 L 520.5 724.6 L 205.2 929.3 L 149.1 936.6 L 124.9 914.0 L 127.9 876.8 L 139.4 864.8 L 234.2 799.5 L 233.8 799.8 Z'

const BOX = 1200

/** [centre x, centre y, size, turn in degrees]. Placed by hand so the margins fill without a repeat. */
const BIG: [number, number, number, number] = [800, 500, 870, 0]
const SMALL: Array<[number, number, number, number]> = [
  [125, 158, 160, -14],
  [275, 389, 76, 22],
  [100, 593, 110, 9],
  [250, 833, 178, -25],
  [392, 102, 60, 35],
  [433, 917, 68, 12],
  [50, 389, 51, -8],
  [1475, 139, 170, 18],
  [1317, 352, 72, -30],
  [1508, 519, 102, 40],
  [1350, 815, 161, -10],
  [1208, 93, 64, 8],
  [1158, 926, 76, 27],
  [1550, 833, 60, -20],
  [1417, 639, 51, 15],
  [583, 56, 47, -18],
  [1025, 954, 51, 5],
  [200, 731, 47, 30],
  [1300, 528, 42, -12]
]

/** One copy of the logo, moved, turned and shrunk to its size; the line stays the same width. */
function copy([x, y, size, turn]: [number, number, number, number], line: string, width: number): string {
  const scale = size / BOX
  return (
    `<path d="${LOGO}" fill="none" stroke="${line}" stroke-width="${width}" stroke-linejoin="round" vector-effect="non-scaling-stroke" ` +
    `transform="translate(${x} ${y}) rotate(${turn}) scale(${scale.toFixed(4)}) translate(-${BOX / 2} -${BOX / 2})"/>`
  )
}

export function claudeSvg(hue: number): string {
  return (
    `<svg ${NS} width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<g>${SMALL.map((logo) => copy(logo, tint(hue, 0.16), 2)).join('')}</g>` +
    `<g>${copy(BIG, tint(hue, 0.3), 4)}</g></svg>`
  )
}
