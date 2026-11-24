// Reads a screenshot and reports the text field's insertion handle
// against the caret, so a check can prove the handle sits with the
// cursor after a sheet lifts the field.
//
//   node android-handle.mjs <shot.png> [more.png ...]
//
// The theme draws both in the accent ink, so one pass finds both: the
// handle is the teardrop beside the caret, the caret the thin tall bar.
// Prints one line per image: `ok`, `no caret`, `no handle`, or
// `stranded`. A stranded handle sits away from the caret's line, which
// is what a field moved by a transform leaves behind. Exit code 1 when
// any image reads stranded.
//
// Sizes are shares of the image, so this reads a full screenshot and a
// quarter-size screenrecord frame alike. `png.mjs` unpacks the PNG, so
// this needs no dependency.
import { readPng } from "./png.mjs";

const ACCENT = [15, 64, 49];
const near = (r, g, b) =>
  Math.abs(r - ACCENT[0]) < 24 &&
  Math.abs(g - ACCENT[1]) < 24 &&
  Math.abs(b - ACCENT[2]) < 24;

function blobs(path) {
  const { width: w, height: h, data } = readPng(path);
  const seen = new Uint8Array(w * h);
  const accent = (x, y) => {
    const i = (y * w + x) * 4;
    return near(data[i], data[i + 1], data[i + 2]);
  };
  const found = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (seen[y * w + x] || !accent(x, y)) continue;
      const stack = [[x, y]];
      seen[y * w + x] = 1;
      let n = 0;
      let left = x;
      let right = x;
      let top = y;
      let bottom = y;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        n += 1;
        if (cx < left) left = cx;
        if (cx > right) right = cx;
        if (cy < top) top = cy;
        if (cy > bottom) bottom = cy;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (seen[ny * w + nx] || !accent(nx, ny)) continue;
          seen[ny * w + nx] = 1;
          stack.push([nx, ny]);
        }
      }
      if (n >= 12) {
        found.push({
          n,
          left,
          top,
          right,
          bottom,
          width: right - left + 1,
          height: bottom - top + 1,
        });
      }
    }
  }
  return { width: w, height: h, found };
}

let failed = 0;
for (const path of process.argv.slice(2)) {
  const { width, height, found } = blobs(path);
  const name = path.split("/").pop();
  const caret = found
    .filter((b) => b.width <= width * 0.02 && b.height >= height * 0.02)
    .filter((b) => b.height >= b.width * 2.5)
    .sort((a, b) => b.bottom - a.bottom)[0];
  if (caret == null) {
    console.log(`${name} no caret`);
    continue;
  }
  const c = caret.height;
  // The insertion handle hangs from the caret's line, so only a solid
  // block at that line can be it. Anything else is another accent mark.
  const handle = found
    .filter((b) => b.width >= width * 0.03 && b.height >= height * 0.02)
    .filter((b) => b.n >= b.width * b.height * 0.45)
    .filter((b) => b.top > caret.bottom - c * 6 && b.top < caret.bottom + c * 3)
    .filter((b) => b.right >= caret.left - c && b.left <= caret.right + c)
    .sort((a, b) => b.n - a.n)[0];
  if (handle == null) {
    console.log(`${name} no handle`);
    continue;
  }
  const onLine =
    handle.top >= caret.bottom - c * 0.5 &&
    handle.top <= caret.bottom + c * 1.5;
  if (!onLine) {
    failed += 1;
    console.log(
      `${name} stranded, handle top ${handle.top}, caret bottom ${caret.bottom}`,
    );
    continue;
  }
  console.log(`${name} ok, handle ${handle.left},${handle.top}`);
}
process.exit(failed > 0 ? 1 : 0);
