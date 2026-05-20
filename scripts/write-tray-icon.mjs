/* global Buffer, console */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '..', 'src', 'icon.png');
const w = 64;
const h = 64;
const rgba = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const cx = x - w / 2;
    const cy = y - h / 2;
    const d = Math.sqrt(cx * cx + cy * cy);
    if (d < 28) {
      rgba[i] = 99;
      rgba[i + 1] = 102;
      rgba[i + 2] = 241;
      rgba[i + 3] = 255;
    } else {
      rgba[i] = 248;
      rgba[i + 1] = 250;
      rgba[i + 2] = 252;
      rgba[i + 3] = 255;
    }
  }
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0);
ihdr.writeUInt32BE(h, 4);
ihdr[8] = 8;
ihdr[9] = 2;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const rows = [];
for (let y = 0; y < h; y++) {
  const row = Buffer.alloc(1 + w * 3);
  row[0] = 0;
  for (let x = 0; x < w; x++) {
    const j = (y * w + x) * 4;
    row[1 + x * 3] = rgba[j];
    row[2 + x * 3] = rgba[j + 1];
    row[3 + x * 3] = rgba[j + 2];
  }
  rows.push(row);
}
const raw = Buffer.concat(rows);
const idat = zlib.deflateSync(raw, { level: 9 });
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('Wrote', out, png.length);
