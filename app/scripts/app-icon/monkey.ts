/**
 * The monkey face, traced from the operator's 2026-11-24 drawing. The
 * units match the drawing: the head is 100 wide and the tile is 108.
 * Every committed icon asset comes from this file.
 */

type Ellipse = readonly [cx: number, cy: number, rx: number, ry: number];

export const TILE = 108;

/** The mark's width in tile units, half the tile. */
export const MARK_SIZE = 54;

export const PALETTE = {
  bg: "#DFB431", // Flexoki yellow-300
  wave: "#D0A215", // yellow-400
  fur: "#9D4310", // orange-700
  outline: "#71320D", // orange-800
  face: "#FFE7CE", // orange-50
  inner: "#FED3AF", // orange-100
  eye: "#27180E", // orange-950
  outlineWidth: 3.5,
} as const;

/** The cap fills the V and rises into the dome. */
const CAP = "M0,0 C0,-30 20,-40 50,-40 C80,-40 100,-30 100,0 L50,22 Z";
const HEAD = "M0,75 V0 C0,-30 20,-40 50,-40 C80,-40 100,-30 100,0 V75 Z";
const V_CUT = "M0,0 L50,22 L100,0";

const EARS: readonly Ellipse[] = [
  [-1, 46, 41, 29],
  [101, 46, 41, 29],
];
const INNER_EARS: readonly Ellipse[] = [
  [-1, 46, 23, 16],
  [101, 46, 23, 16],
];
const EYES: readonly Ellipse[] = [
  [29, 46, 10.5, 9.5],
  [71, 46, 10.5, 9.5],
];

/** Everything the mark draws, ears and outline included. */
const MARK_BOUNDS = [-42, -40, 142, 75] as const;

/** Tile units per drawing unit, with the mark at its size. */
const SCALE = MARK_SIZE / (MARK_BOUNDS[2] - MARK_BOUNDS[0]);

/** A point in the drawing's units, placed on the tile. */
export function inTile(x: number, y: number): [number, number] {
  const [left, top, right, bottom] = MARK_BOUNDS;
  return [
    TILE / 2 + (x - (left + right) / 2) * SCALE,
    TILE / 2 + (y - (top + bottom) / 2) * SCALE,
  ];
}

function place(body: string): string {
  const [x, y] = inTile(0, 0);
  return `<g transform="translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${SCALE.toFixed(4)})">${body}</g>`;
}

function ellipse(e: Ellipse, attrs: string): string {
  const [cx, cy, rx, ry] = e;
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${attrs}/>`;
}

/** The mark's farthest reach from the tile centre, outline included. */
export function markReach(): number {
  const [left, top, right, bottom] = MARK_BOUNDS;
  const outline = (PALETTE.outlineWidth / 2) * SCALE;
  const corners: [number, number][] = [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
  ];
  return (
    Math.max(
      ...corners.map(([x, y]) => {
        const [tx, ty] = inTile(x, y);
        return Math.hypot(tx - TILE / 2, ty - TILE / 2);
      }),
    ) + outline
  );
}

/** The ears sit behind the head, so the head's line cuts them. */
function mark(): string {
  const line = `stroke="${PALETTE.outline}" stroke-width="${PALETTE.outlineWidth}" stroke-linejoin="round"`;
  const parts = [
    ...EARS.map((e) => ellipse(e, `fill="${PALETTE.fur}" ${line}`)),
    ...INNER_EARS.map((e) => ellipse(e, `fill="${PALETTE.inner}" ${line}`)),
    `<path d="${HEAD}" fill="${PALETTE.face}" ${line}/>`,
    `<path d="${CAP}" fill="${PALETTE.fur}" ${line}/>`,
    ...EYES.map((e) => ellipse(e, `fill="${PALETTE.eye}"`)),
  ];
  return place(parts.join(""));
}

/**
 * The themed layer: the lines alone, and heavier than the colour
 * outline so the mask still reads. The ear lines hide behind the head.
 */
function monoLine(): string {
  const line = `fill="none" stroke="#000" stroke-width="6" stroke-linejoin="round"`;
  const mask =
    `<mask id="ears"><rect x="-60" y="-60" width="220" height="160" fill="#FFF"/>` +
    `<path d="${HEAD}" fill="#000"/></mask>`;
  const body =
    `<g mask="url(#ears)">` +
    [...EARS, ...INNER_EARS].map((e) => ellipse(e, line)).join("") +
    `</g>` +
    `<path d="${HEAD}" ${line}/>` +
    `<path d="${V_CUT}" ${line}/>` +
    EYES.map((e) => ellipse(e, `fill="#000"`)).join("");
  return mask + place(body);
}

/** Soft diagonal waves, one shade off the tile. */
function waves(): string {
  const { amplitude, period, gap, width } = { amplitude: 2.6, period: 24, gap: 15, width: 3.6 };
  const d = `M0,${gap / 2} q${period / 4},${-amplitude} ${period / 2},0 t${period / 2},0`;
  return (
    `<pattern id="waves" width="${period}" height="${gap}" patternUnits="userSpaceOnUse"` +
    ` patternTransform="rotate(-35 ${TILE / 2} ${TILE / 2})">` +
    `<path d="${d}" fill="none" stroke="${PALETTE.wave}" stroke-width="${width}" stroke-linecap="round"/>` +
    `</pattern>` +
    `<rect width="${TILE}" height="${TILE}" fill="${PALETTE.bg}"/>` +
    `<rect width="${TILE}" height="${TILE}" fill="url(#waves)"/>`
  );
}

/** The favicon rounds its corners. The launcher adds its own mask. */
const CORNER = 13.5;

function tile(rounded: boolean): string {
  const back = waves();
  if (!rounded) return back;
  return (
    `<clipPath id="tile"><rect width="${TILE}" height="${TILE}" rx="${CORNER}"/></clipPath>` +
    `<g clip-path="url(#tile)">${back}</g>`
  );
}

function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${TILE}">${body}</svg>`;
}

export const DRAWINGS = {
  "tile-square": svg(tile(false) + mark()),
  "tile-round": svg(tile(true) + mark()),
  "adaptive-foreground": svg(mark()),
  "adaptive-background": svg(waves()),
  monochrome: svg(monoLine()),
} as const;

export type Drawing = keyof typeof DRAWINGS;
