// Unpacks a PNG into RGBA, so a check can read pixels out of a shot
// with no dependency. 8-bit RGB or RGBA, no interlace: what
// `screencap -p` and android-frames.mjs write.
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const signature = [137, 80, 78, 71, 13, 10, 26, 10];

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
};

/** Returns { width, height, data }, one RGBA byte per channel per pixel. */
export function readPng(path) {
  const file = readFileSync(path);
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
