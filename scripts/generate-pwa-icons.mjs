import { deflateSync } from "zlib";
import { existsSync, mkdirSync, writeFileSync } from "fs";
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

const resources = path.join(process.cwd(), "resources");
mkdirSync(resources, { recursive: true });
writeFileSync(path.join(resources, "icon.png"), makePng(1024, 1024, paintIcon(true)));
console.log("wrote resources/icon.png");

function writeSplash(file, width, height) {
  const icon = Math.min(512, Math.floor(Math.min(width, height) * 0.28));
  const paintIconFn = paintIcon(false);
  const png = makePng(width, height, (x, y) => {
    const left = Math.floor((width - icon) / 2);
    const top = Math.floor((height - icon) / 2);
    if (x >= left && x < left + icon && y >= top && y < top + icon) {
      return paintIconFn(x - left, y - top, icon, icon);
    }
    return [247, 245, 242, 255];
  });
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, png);
  console.log("wrote", path.relative(process.cwd(), file));
}

const androidRes = path.join(process.cwd(), "android", "app", "src", "main", "res");
if (existsSync(androidRes)) {
  const launchers = [
    ["mipmap-mdpi", 48, 108],
    ["mipmap-hdpi", 72, 162],
    ["mipmap-xhdpi", 96, 216],
    ["mipmap-xxhdpi", 144, 324],
    ["mipmap-xxxhdpi", 192, 432],
  ];
  for (const [folder, launcher, foreground] of launchers) {
    const folderPath = path.join(androidRes, folder);
    mkdirSync(folderPath, { recursive: true });
    const square = makePng(launcher, launcher, paintIcon(false));
    writeFileSync(path.join(folderPath, "ic_launcher.png"), square);
    writeFileSync(path.join(folderPath, "ic_launcher_round.png"), square);
    writeFileSync(
      path.join(folderPath, "ic_launcher_foreground.png"),
      makePng(foreground, foreground, paintIcon(true)),
    );
    console.log("wrote", folder, "launcher icons");
  }

  writeSplash(path.join(androidRes, "drawable", "splash.png"), 480, 320);
  const port = [
    ["drawable-port-mdpi", 320, 480],
    ["drawable-port-hdpi", 480, 800],
    ["drawable-port-xhdpi", 720, 1280],
    ["drawable-port-xxhdpi", 960, 1600],
    ["drawable-port-xxxhdpi", 1280, 1920],
  ];
  const land = [
    ["drawable-land-mdpi", 480, 320],
    ["drawable-land-hdpi", 800, 480],
    ["drawable-land-xhdpi", 1280, 720],
    ["drawable-land-xxhdpi", 1600, 960],
    ["drawable-land-xxxhdpi", 1920, 1280],
  ];
  for (const [folder, w, h] of [...port, ...land]) {
    writeSplash(path.join(androidRes, folder, "splash.png"), w, h);
  }
}
