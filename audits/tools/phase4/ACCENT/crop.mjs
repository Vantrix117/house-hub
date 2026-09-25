#!/usr/bin/env node
// Phase 4 ACCENT — crop (and optionally stack) 1x PNG screenshots into one evidence PNG.
//   node audits/tools/phase4/ACCENT/crop.mjs <out.png> <in.png>:<x>,<y>,<w>,<h> [<in2.png>:<x>,<y>,<w>,<h> …]
// Crops are stacked vertically with a 6 px gap (left-aligned, white-free: the gap is mid-grey).
import fs from 'node:fs';
import zlib from 'node:zlib';
import { decodePng } from './png.mjs';
const [out, ...specs] = process.argv.slice(2);
const parts = specs.map(s => { const i = s.lastIndexOf(':'); const [x, y, w, h] = s.slice(i + 1).split(',').map(Number); return { img: decodePng(fs.readFileSync(s.slice(0, i))), x, y, w, h }; });
const W = Math.max(...parts.map(p => p.w)), GAP = 6, H = parts.reduce((a, p) => a + p.h, 0) + GAP * (parts.length - 1);
const px = Buffer.alloc(W * H * 4, 128); let oy = 0;
for (const p of parts) {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) { const si = ((p.y + y) * p.img.w + (p.x + x)) * 4, di = ((oy + y) * W + x) * 4; for (let k = 0; k < 4; k++) px[di + k] = p.img.px[si + k]; }
  oy += p.h + GAP;
}
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
const crc = b => { let c, t = crc.t || (crc.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); c = 0xffffffff; for (const v of b) c = t[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(out, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('wrote', out, W + 'x' + H, fs.statSync(out).size, 'bytes');
