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
// quarter-size screenrecord frame alike. It unpacks the PNG itself, so
// it needs no dependency.
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const ACCENT = [15, 64, 49];
const near = (r, g, b) =>
  Math.abs(r - ACCENT[0]) < 24 &&
  Math.abs(g - ACCENT[1]) < 24 &&
  Math.abs(b - ACCENT[2]) < 24;

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
};

// 8-bit RGB or RGBA, no interlace: what `screencap -p` and the frame
// decoder write. Returns one RGBA byte per channel per pixel.
function readPng(path) {
  const file = readFileSync(path);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < signature.length; i += 1) {
    if (file[i] !== signature[i]) throw new Error(`${path}: not a PNG`);
  }
  let at = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const parts = [];
  while (at < file.length) {
    const length = file.readUInt32BE(at);
    const type = file.toString("ascii", at + 4, at + 8);
    const body = file.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      const color = body[9];
      const interlace = body[12];
      if (depth !== 8 || interlace !== 0 || (color !== 2 && color !== 6)) {
        throw new Error(`${path}: unsupported PNG`);
      }
      channels = color === 6 ? 4 : 3;
    } else if (type === "IDAT") {
      parts.push(body);
    } else if (type === "IEND") {
      break;
    }
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const data = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = new Uint8Array(stride);
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? out[i - channels] : 0;
      const b = previous[i];
      const c = i >= channels ? previous[i - channels] : 0;
      let value = line[i];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) value += paeth(a, b, c);
      out[i] = value & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const from = x * channels;
      const to = (y * width + x) * 4;
      data[to] = out[from];
      data[to + 1] = out[from + 1];
      data[to + 2] = out[from + 2];
      data[to + 3] = channels === 4 ? out[from + 3] : 255;
    }
    previous = out;
  }
  return { width, height, data };
}

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
