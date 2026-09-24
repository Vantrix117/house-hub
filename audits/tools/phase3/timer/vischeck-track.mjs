// Visual-score checker: how visible is the dial's unfilled ring track (the "time elapsed" part) in the Phase 1 captures?
// Decodes the PNGs in plain Node (8-bit RGB/RGBA, non-interlaced), scans a horizontal line through the dial centre on the
// left side (where the track is unfilled at 6:20 of 15:00), and reports the WCAG contrast of the track against the dial
// surface beside it. Reads only audits/screens; writes audits/evidence/p3/timer/vischeck-track.json.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT } from '../../lib/local.mjs';

function decode(file) {
  const b = fs.readFileSync(file); let o = 8, w, h, ct, idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12]) throw new Error('unsupported'); }
    if (type === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : (() => { throw new Error('colour type ' + ct); })();
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? px[y * stride + x - bpp] : 0, up = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = src[x]; if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      px[y * stride + x] = v & 255; } }
  return { w, h, at: (x, y) => { const i = y * stride + x * bpp; return [px[i], px[i + 1], px[i + 2]]; } };
}
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => { const x = L(a), y = L(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };

// [capture, dial centre x, y, dial outer radius px] — centres read off the captures
const CASES = [
  ['running-typical-desktop-dark.png', 720, 430, 200],
  ['running-typical-ipad-landscape-dark.png', 590, 390, 200],
  ['paused-typical-iphone-safari-dark.png', 215, 322, 176],
  ['running-typical-ipad-portrait-light.png', 410, 570, 200],
  ['running-typical-desktop-light.png', 720, 430, 200],
];
const out = [];
for (const [name, cx, cy, R] of CASES) {
  const f = path.join(ROOT, 'audits', 'screens', 'timer', name);
  if (!fs.existsSync(f)) { out.push({ name, missing: true }); continue; }
  const im = decode(f);
  // scan from just inside the dial edge towards the centre along the left radius
  const line = []; for (let x = cx - R + 6; x < cx - R * 0.35; x++) line.push({ x, rgb: im.at(x, cy), L: L(im.at(x, cy)) });
  // the track is the run whose luminance differs most from the first (glass surface) sample
  const surf = line[4].rgb; let best = line[0];
  for (const p of line) if (Math.abs(p.L - L(surf)) > Math.abs(best.L - L(surf))) best = p;
  const inner = line[line.length - 1].rgb;
  out.push({ name, surfaceOutside: surf, track: best.rgb, trackX: best.x, surfaceInside: inner,
    trackVsOutside: cr(best.rgb, surf), trackVsInside: cr(best.rgb, inner) });
}
const file = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer', 'vischeck-track.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1));
for (const r of out) console.log(r.name, r.missing ? 'MISSING' : `track ${r.track} vs surface ${r.surfaceOutside} = ${r.trackVsOutside}:1, vs inner ${r.surfaceInside} = ${r.trackVsInside}:1 (x ${r.trackX})`);
console.log('wrote', path.relative(ROOT, file));
