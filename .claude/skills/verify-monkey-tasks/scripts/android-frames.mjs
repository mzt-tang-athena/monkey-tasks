// Turns a `screenrecord --output-format=frames` file into PNGs, so an
// agent can look at motion without ffmpeg.
//
//   node android-frames.mjs <frames.raw> <out dir> [columns]
//
// Writes <out dir>/NN.png per frame and <out dir>/sheet.png, a grid of
// every frame in order. screenrecord writes a frame only when the screen
// changes, so a still screen gives few frames and motion gives many.
// Each frame is a 20 byte header (bytes after this field, width, height,
// stride, pixel format 3 = RGB 888, all little-endian u32) and the rows.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const [file, out, columnsArg] = process.argv.slice(2);
if (file == null || out == null) {
  console.error("usage: android-frames.mjs <frames.raw> <out dir> [columns]");
  process.exit(2);
}

const raw = readFileSync(file);
const frames = [];
for (let at = 0; at + 20 <= raw.length; ) {
  const rest = raw.readUInt32LE(at);
  const width = raw.readUInt32LE(at + 4);
  const height = raw.readUInt32LE(at + 8);
  const stride = raw.readUInt32LE(at + 12);
  const format = raw.readUInt32LE(at + 16);
  if (format !== 3 || stride < width * 3 || at + 4 + rest > raw.length) break;
  frames.push({ width, height, stride, pixels: raw.subarray(at + 20, at + 20 + stride * height) });
  at += 4 + rest;
}
if (frames.length === 0) {
  console.error(`no RGB frames in ${file}`);
  process.exit(1);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
};
const png = (width, height, rowAt) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const body = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) rowAt(y).copy(body, y * (width * 3 + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(body)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

mkdirSync(out, { recursive: true });
const pad = String(frames.length).length;
frames.forEach((f, i) => {
  const name = join(out, `${String(i + 1).padStart(pad, "0")}.png`);
  writeFileSync(name, png(f.width, f.height, (y) => f.pixels.subarray(y * f.stride, y * f.stride + f.width * 3)));
});

const { width, height } = frames[0];
const gap = 6;
const columns = Math.min(Number(columnsArg) || 6, frames.length);
const rows = Math.ceil(frames.length / columns);
const sheetW = columns * width + (columns - 1) * gap;
const sheetH = rows * height + (rows - 1) * gap;
const sheet = Buffer.alloc(sheetW * 3 * sheetH, 0x80);
frames.forEach((f, i) => {
  const x0 = (i % columns) * (width + gap);
  const y0 = Math.floor(i / columns) * (height + gap);
  for (let y = 0; y < f.height; y++) {
    f.pixels.copy(sheet, ((y0 + y) * sheetW + x0) * 3, y * f.stride, y * f.stride + f.width * 3);
  }
});
writeFileSync(join(out, "sheet.png"), png(sheetW, sheetH, (y) => sheet.subarray(y * sheetW * 3, (y + 1) * sheetW * 3)));
console.log(`${frames.length} frames of ${width}x${height} in ${out}, grid in ${join(out, "sheet.png")}`);
