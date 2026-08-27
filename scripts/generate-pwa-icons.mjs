import { deflateSync } from "zlib";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function makePng(width, height, paint) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = paint(x, y, width, height);
      const o = row + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function roundedRect(px, py, size, radius) {
  const x = Math.min(px, size - 1 - px);
  const y = Math.min(py, size - 1 - py);
  if (x >= radius || y >= radius) return true;
  const dx = radius - x;
  const dy = radius - y;
  return dx * dx + dy * dy <= radius * radius;
}

function inDrop(nx, ny) {
  // Logo coords in 0..1 with drop centered like public/logo.svg (64 viewBox).
  const x = nx * 64;
  const y = ny * 64;
  const cx = 32;
  const cy = 35;
  const r = 11;
  if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return true;
  if (y < 14 || y > 35) return false;
  const t = (y - 14) / 21;
  const half = 2 + t * 11;
  return Math.abs(x - 32) <= half;
}

function inInnerDrop(nx, ny) {
  const x = nx * 64;
  const y = ny * 64;
  const cx = 32;
  const cy = 35;
  const r = 6;
  if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return true;
  if (y < 22 || y > 35) return false;
  const t = (y - 22) / 13;
  const half = 1 + t * 6;
  return Math.abs(x - 32) <= half;
}

function paintIcon(maskable) {
  return (x, y, width) => {
    const pad = maskable ? 0.12 : 0.06;
    const nx = x / (width - 1);
    const ny = y / (width - 1);
    const inner = (v) => (v - pad) / (1 - 2 * pad);
    const ix = inner(nx);
    const iy = inner(ny);
    if (ix < 0 || iy < 0 || ix > 1 || iy > 1) {
      return maskable ? [14, 107, 111, 255] : [0, 0, 0, 0];
    }
    const px = ix * (width - 1);
    const py = iy * (width - 1);
    const size = width;
    const radius = size * 0.22;
    if (!roundedRect(px, py, size, radius)) return [0, 0, 0, 0];
    if (inInnerDrop(ix, iy)) return [201, 163, 91, 255];
    if (inDrop(ix, iy)) return [247, 245, 242, 255];
    return [14, 107, 111, 255];
  };
}

const dir = path.join(process.cwd(), "public", "icons");
mkdirSync(dir, { recursive: true });

const files = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-512-maskable.png", 512, true],
  ["apple-touch-icon.png", 180, false],
];

for (const [name, size, maskable] of files) {
  writeFileSync(path.join(dir, name), makePng(size, size, paintIcon(maskable)));
  console.log("wrote", name);
}
