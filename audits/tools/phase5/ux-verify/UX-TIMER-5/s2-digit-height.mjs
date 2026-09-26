// Skeptic s2, UX-TIMER-5: measure the rendered digit height and dial size straight from the Phase 1 full-size
// screenshots (no browser). Minimal PNG decoder (8-bit, colour types 2/6, non-interlaced) on node:zlib.
// Digit pixels = pixels inside a box around the dial centre whose luminance is well below the dial face.
// Usage: node audits/tools/phase5/ux-verify/UX-TIMER-5/s2-digit-height.mjs
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
function decode(file) {
  const b = fs.readFileSync(file); let o = 8, w, h, bd, ct; const idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; if (d[12]) throw new Error('interlaced'); }
    if (type === 'IDAT') idat.push(d); o += 12 + len; }
  if (bd !== 8 || (ct !== 2 && ct !== 6)) throw new Error('unsupported ' + bd + '/' + ct);
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? px[y * stride + x - bpp] : 0, up = y ? px[(y - 1) * stride + x] : 0, c = (x >= bpp && y) ? px[(y - 1) * stride + x - bpp] : 0;
      let v = src[x]; if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1; else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : pb <= pc ? up : c; }
      px[y * stride + x] = v & 255; } }
  return { w, h, bpp, px, lum: (x, y) => { const i = y * stride + x * bpp; return .2126 * px[i] + .7152 * px[i + 1] + .0722 * px[i + 2]; } };
}
// [file, dial centre y in CSS px, read off the screenshot] — the box below stays inside the ring's inner edge (r ≈ 145)
const shots = [['audits/screens/timer/idle-typical-ipad-portrait-light.png', 570], ['audits/screens/timer/idle-typical-ipad-landscape-light.png', 390],
  ['audits/screens/timer/running-typical-ipad-portrait-light.png', 570], ['audits/evidence/p3/timer/visual-idle-hearth-ipad.png', 546],
  ['audits/evidence/p3/timer/visual-done-hearth-ipad.png', 546]];
const out = [];
for (const [s, cy] of shots) {
  if (!fs.existsSync(s)) { out.push({ s, missing: true }); continue; }
  const im = decode(s), scale = im.w > 1300 && im.w < 1700 || im.w > 2000 ? 2 : 1;   // captures are 1x or 2x of the CSS viewport
  const cssW = im.w / scale, cssH = im.h / scale;
  // dial centre: find the middle row of the widest run of the face colour is overkill; use the digits themselves:
  // scan the middle 40% of width, 25-65% of height, for dark pixels (lum < 110) — the digits are the darkest thing there.
  const cx = im.w / 2, x0 = Math.round(cx - 110 * scale), x1 = Math.round(cx + 110 * scale), y0 = Math.round((cy - 60) * scale), y1 = Math.round((cy + 60) * scale);
  const face = im.lum(Math.round(cx), Math.round((cy - 90) * scale)), thr = face - 60;
  let top = 1e9, bot = -1, left = 1e9, right = -1;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (im.lum(x, y) < thr) { top = Math.min(top, y); bot = Math.max(bot, y); left = Math.min(left, x); right = Math.max(right, x); }
  const hCss = (bot - top + 1) / scale;
  out.push({ s, faceLum: Math.round(face), thr: Math.round(thr), png: [im.w, im.h], scale, css: [cssW, cssH], digitBox: { top: top / scale, bottom: bot / scale, heightCss: hCss, widthCss: (right - left + 1) / scale },
    mm_on_ipadAir11_264ppi: +(hCss / 132 * 25.4).toFixed(1), metres_by_d_over_200: +(hCss / 132 * 25.4 * 200 / 1000).toFixed(2),
    metres_by_20_40_acuity_10arcmin: +((hCss / 132 * 25.4) / Math.tan(10 / 60 * Math.PI / 180) / 1000).toFixed(1) });
}
// the dial's own sizing rule at the rig's iPad viewports, inside the hub iframe (48 px viewer bar) and standalone
const dial = (vw, vh) => Math.min(.82 * vw, .52 * vh, 400);
out.push({ dialRule: { portraitIframe: dial(820, 1180 - 48), portraitNoCap: Math.min(.82 * 820, .52 * 1132), landscapeIframe: dial(1180, 820 - 48), landscapeNoCap: Math.min(.82 * 1180, .52 * 772), landscapeStandalone: dial(1180, 820) } });
const dir = 'audits/evidence/p5/ux-verify/UX-TIMER-5/s2'; fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'digit-height.json'), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
