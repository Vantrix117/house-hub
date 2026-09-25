// Phase 4 COLOR skeptic #1: re-measure the Me hero's Switch (.ds .hero .btn-primary) label contrast.
// Method (independent of spot.mjs): per case set the theme (PUT hub/theme as the profile + localStorage), open #me,
// read the computed label colour + button background + resolved --accent, then make ONLY #switch's text transparent,
// screenshot at 1x CSS, take every pixel of the central 60 % x 40 % box of the button as the background, and report the
// min / p10 / median ratio of the (opaque, alpha 1) label colour against those pixels. Also token maths per family colour.
// Usage: node audits/tools/phase4/COLOR/verify-hero-primary-button-inverts-dark-1.mjs
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const EV = path.resolve('audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const lum = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const parseHex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function decode(buf) {
  let o = 8, w, h, ct; const id = [];
  while (o < buf.length) { const n = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + n); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') id.push(d); o += 12 + n; }
  const bpp = ct === 6 ? 4 : 3, st = w * bpp, raw = zlib.inflateSync(Buffer.concat(id)), px = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)];
    for (let x = 0; x < st; x++) {
      const A = x >= bpp ? px[y * st + x - bpp] : 0, B = y ? px[(y - 1) * st + x] : 0, C = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0;
      let v = raw[y * (st + 1) + 1 + x];
      if (f === 1) v += A; else if (f === 2) v += B; else if (f === 3) v += (A + B) >> 1;
      else if (f === 4) { const p = A + B - C, pa = Math.abs(p - A), pb = Math.abs(p - B), pc = Math.abs(p - C); v += pa <= pb && pa <= pc ? A : pb <= pc ? B : C; }
      px[y * st + x] = v & 255;
    }
  }
  return { w, h, at: (x, y) => { const i = y * st + x * bpp; return [px[i], px[i + 1], px[i + 2]]; } };
}
const toRgb = s => { const srgb = /^color\(srgb/.test(s); const m = s.replace(/^color\(srgb/, '').match(/[\d.]+/g).map(Number); return { rgb: m.slice(0, 3).map(v => srgb ? v * 255 : v), a: m.length > 3 ? m[3] : 1 }; };
const mixWhite = (c, p) => c.map(v => v * p + 255 * (1 - p));
const mixBlack = (c, p) => c.map(v => v * p);

const CASES = [
  ['eli', 'midnight', 'light', 'ipad-portrait'], ['kiara', 'midnight', 'light', 'ipad-portrait'], ['ezra', 'system', 'dark', 'ipad-portrait'],
  ['dad', 'forest', 'light', 'ipad-portrait'], ['guest-grandmajo', 'system', 'dark', 'ipad-portrait'], ['christian', 'midnight', 'light', 'iphone-pwa'],
  ['niece', 'forest', 'light', 'iphone-pwa'], ['kiara', 'system', 'light', 'ipad-portrait'], ['eli', 'system', 'light', 'ipad-portrait'], ['eli', 'frost', 'light', 'ipad-portrait'],
  ['tv', 'system', 'dark', 'tv'],
];
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { method: 'text of #switch hidden, button pixels sampled at 1x CSS (WebKit), opaque label colour vs every sampled pixel', cases: [] };
try {
  for (const [p, th, mode, dev] of CASES) {
    await L.reset('typical');
    if (th !== 'system') { const r = await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: th } }); if (r.status >= 300) throw new Error(p + ' PUT ' + r.status); }
    const d = await L.device({ device: dev, mode, profile: p, localStorage: th !== 'system' ? { 'hub.theme': JSON.stringify(th) } : {} });
    await d.goto('#me'); await sleep(2500);
    const info = await d.page.evaluate(() => {
      const e = document.querySelector('#switch'); const view = document.querySelector('#view-me');
      const visible = !!e && e.getClientRects().length > 0 && !!view && view.getClientRects().length > 0;
      const tb = document.querySelector('.tabbar'); const tabbarVisible = !!tb && tb.getClientRects().length > 0 && getComputedStyle(tb).display !== 'none';
      const rs = getComputedStyle(document.documentElement);
      const res = { visible, tabbarVisible, theme: document.documentElement.dataset.theme || '(none)', scheme: document.documentElement.dataset.scheme, kind: document.documentElement.dataset.kind, accent: rs.getPropertyValue('--accent').trim() };
      if (!e) return res;
      e.scrollIntoView({ block: 'center' });
      const cs = getComputedStyle(e);
      return { ...res, color: cs.color, bg: cs.backgroundColor, fs: cs.fontSize, fw: cs.fontWeight, opacity: cs.opacity, hero: e.closest('.hero')?.className, dsAncestor: !!e.closest('.ds') };
    });
    const rec = { profile: p, theme: th, osMode: mode, device: dev, ...info };
    if (info.color && info.visible) {
      await sleep(300);
      const rect = await d.page.evaluate(() => { const b = document.querySelector('#switch').getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; });
      const [x, y, w, h] = rect; const clip = { x: Math.max(0, x - 520), y: Math.max(0, y - 90), width: Math.min(820, w + 560), height: h + 180 };
      if (p === 'kiara' && th === 'midnight') await d.page.screenshot({ path: path.join(EV, 'verify-hero-primary-button-inverts-dark-1-kiara-midnight.png'), scale: 'css', clip });
      await d.page.addStyleTag({ content: '#switch{color:transparent!important;-webkit-text-fill-color:transparent!important}' }); await sleep(150);
      const img = decode(await d.page.screenshot({ scale: 'css', animations: 'disabled' }));
      const fg = toRgb(info.color).rgb; const rs = [], bgs = [];
      for (let yy = Math.round(y + h * .3); yy < y + h * .7; yy++) for (let xx = Math.round(x + w * .2); xx < x + w * .8; xx++) { const bg = img.at(xx, yy); bgs.push(bg); rs.push(ratio(fg, bg)); }
      rs.sort((a, b) => a - b); bgs.sort((a, b) => lum(a) - lum(b));
      Object.assign(rec, { fg: hex(fg), bgMedian: hex(bgs[bgs.length >> 1]), min: +rs[0].toFixed(2), p10: +rs[Math.floor(rs.length * .1)].toFixed(2), median: +rs[rs.length >> 1].toFixed(2), max: +rs[rs.length - 1].toFixed(2), n: rs.length });
    }
    out.cases.push(rec); console.log(JSON.stringify(rec));
    await d.close();
  }
  // token maths: dark ink = accent 58 % + white; light ink = accent 72 % + black (Hearth/Frost), 66 % (Parchment);
  // fill = rgba(255,255,255,.92) over the hero (worst plausible under-colour: the dark accent-deep far stop itself)
  const cols = { eli: '#4F5D8C', christian: '#BC5A38', ezra: '#137F77', kiara: '#B4861B', mom: '#8A6A4B', dad: '#3D5A3D', niece: '#5B8143', tv: '#4C4C58', 'guest-theo': '#1F6FB2', 'guest-auntwil': '#5B8143' };
  out.tokenMaths = {};
  for (const [k, hx] of Object.entries(cols)) {
    const a = parseHex(hx), dInk = mixWhite(a, .58), lInk = mixBlack(a, .72), pInk = mixBlack(a, .66), fill = u => u.map(v => 255 * .92 + v * .08);
    out.tokenMaths[k] = { darkInk: hex(dInk), dark: +ratio(dInk, fill(dInk)).toFixed(2), darkOnPureWhite: +ratio(dInk, [255, 255, 255]).toFixed(2), lightInk: hex(lInk), light: +ratio(lInk, fill(a)).toFixed(2), parchment: +ratio(pInk, fill(a)).toFixed(2) };
  }
  console.log(JSON.stringify(out.tokenMaths));
} finally { fs.writeFileSync(path.join(EV, 'verify-hero-primary-button-inverts-dark-1.json'), JSON.stringify(out, null, 1)); await L.close(); }
