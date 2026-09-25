// Crop a PNG (8-bit RGB/RGBA, non-interlaced) so a cited screenshot stays under 1 MB.
// Usage: node audits/tools/phase4/COLOR/crop.mjs <in.png> <out.png> x y w h
import fs from 'node:fs'; import zlib from 'node:zlib';
const [inp, outp, X, Y, W, H] = process.argv.slice(2); const x0 = +X, y0 = +Y, w = +W, h = +H;
const buf = fs.readFileSync(inp); let o = 8, iw, ih, ct, idat = [];
while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { iw = d.readUInt32BE(0); ih = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); o += 12 + len; }
const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), st = iw * bpp, px = Buffer.alloc(ih * st);
for (let y = 0; y < ih; y++) { const f = raw[y * (st + 1)], line = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = line[x];
  if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } px[y * st + x] = v & 255; } }
const ow = Math.min(w, iw - x0), oh = Math.min(h, ih - y0), ost = ow * bpp, rows = Buffer.alloc(oh * (ost + 1));
for (let y = 0; y < oh; y++) { rows[y * (ost + 1)] = 0; px.copy(rows, y * (ost + 1) + 1, (y0 + y) * st + x0 * bpp, (y0 + y) * st + (x0 + ow) * bpp); }
const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const v of b) c = t[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(ow, 0); ihdr.writeUInt32BE(oh, 4); ihdr[8] = 8; ihdr[9] = ct; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
fs.writeFileSync(outp, Buffer.concat([buf.subarray(0, 8), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
console.log(outp, ow + 'x' + oh, fs.statSync(outp).size, 'bytes');
