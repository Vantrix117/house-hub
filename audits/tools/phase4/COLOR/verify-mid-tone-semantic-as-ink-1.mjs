// Phase 4 COLOR skeptic #1: re-measure "mid-tone semantic as ink".
// Part A (static): parse apps/design.css token blocks for Hearth (:root), Parchment, Frost, Midnight, Forest; contrast of the mid
//   tone (--gold/--olive/--terra/--teal) on --bg, --surface and its own -soft, and of -ink on -soft / --bg.
// Part B (runtime, local instance, WebKit, ipad-portrait, System theme, light OS): in F260, Prayer and the Larder, every visible
//   text element whose computed colour equals a resolved mid tone; hide all text, screenshot 1x CSS, sample the pixels in the
//   first line box, report p10/median. Usage: node audits/tools/phase4/COLOR/verify-mid-tone-semantic-as-ink-1.mjs
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const EV = path.resolve('audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const h2r = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

// ---- Part A
const css = fs.readFileSync('apps/design.css', 'utf8');
const block = start => { const i = css.indexOf(start); if (i < 0) throw new Error('no block ' + start); return css.slice(i, css.indexOf('\n}', i)); };
const blocks = { hearth: block(':root {'), parchment: block(':root[data-theme="parchment"]'), frost: block(':root[data-theme="frost"]'), midnight: block(':root[data-theme="midnight"]'), forest: block(':root[data-theme="forest"] {') };
const tok = (b, n) => { const m = b.match(new RegExp('--' + n + ':\\s*(#[0-9A-Fa-f]{6})')); return m && m[1]; };
const A = {};
for (const [th, b] of Object.entries(blocks)) {
  A[th] = {}; const bg = tok(b, 'bg'), sf = tok(b, 'surface');
  for (const f of ['gold', 'olive', 'terra', 'teal']) {
    const base = tok(b, f), soft = tok(b, f + '-soft'), ink = tok(b, f + '-ink');
    A[th][f] = { base, onBg: +ratio(h2r(base), h2r(bg)).toFixed(2), onSurface: +ratio(h2r(base), h2r(sf)).toFixed(2), onSoft: +ratio(h2r(base), h2r(soft)).toFixed(2), inkOnSoft: +ratio(h2r(ink), h2r(soft)).toFixed(2), inkOnBg: +ratio(h2r(ink), h2r(bg)).toFixed(2) };
  }
  console.log(th, JSON.stringify(A[th]));
}

// ---- Part B
function png(buf) {
  let o = 8, w, h, ct, idat = [];
  while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)], line = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1));
    for (let x = 0; x < st; x++) {
      const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * st + x] = v & 255;
    }
  }
  return { at: (x, y) => { const i = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * bpp; return [px[i], px[i + 1], px[i + 2]]; } };
}
async function scan(d, f, app) {
  const off = await d.page.evaluate(() => { const b = document.querySelector('iframe').getBoundingClientRect(); return [b.x, b.y]; });
  const els = await f.evaluate(() => {
    const res = [], cols = {};
    for (const n of ['gold', 'olive', 'terra', 'teal']) { const p = document.createElement('i'); p.style.color = `var(--${n})`; document.body.append(p); cols[getComputedStyle(p).color] = n; p.remove(); }
    let k = 0;
    for (const e of document.querySelectorAll('body *')) {
      if (!e.getClientRects().length) continue; const c = getComputedStyle(e).color; if (!cols[c]) continue;
      if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      let op = 1; for (let n = e; n; n = n.parentElement) op *= +getComputedStyle(n).opacity; if (op < .99) continue;
      const r = document.createRange(); r.selectNodeContents(e); const b = r.getClientRects()[0];
      if (!b || b.bottom < 0 || b.top > innerHeight || b.width < 4) continue;
      res.push({ k: ++k, tok: cols[c], text: e.innerText.trim().slice(0, 30), el: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ').join('.') : ''), parent: e.parentElement.tagName.toLowerCase() + (typeof e.parentElement.className === 'string' && e.parentElement.className ? '.' + e.parentElement.className.split(' ')[0] : ''), fs: getComputedStyle(e).fontSize, fw: getComputedStyle(e).fontWeight, color: c, rect: [b.x, b.y + b.height * .2, b.width, b.height * .6] });
    }
    return res;
  });
  await f.evaluate(() => { const s = document.createElement('style'); s.id = '__h'; s.textContent = '*{color:transparent!important;-webkit-text-fill-color:transparent!important}'; document.head.append(s); });
  await sleep(150);
  const img = png(await d.page.screenshot({ scale: 'css', animations: 'disabled' }));
  await f.evaluate(() => document.getElementById('__h')?.remove());
  const out = [];
  for (const e of els) {
    const m = e.color.replace(/^color\(srgb/, '').match(/[\d.]+/g).map(Number); const fg = /srgb/.test(e.color) ? m.slice(0, 3).map(v => v * 255) : m.slice(0, 3);
    const rs = []; const [x, y, w, h] = e.rect;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) rs.push(ratio(fg, img.at(Math.round(xx + off[0]), Math.round(yy + off[1]))));
    rs.sort((a, b) => a - b); const { rect, ...rest } = e;
    out.push({ app, ...rest, p10: +rs[Math.floor(rs.length * .1)].toFixed(2), median: +rs[rs.length >> 1].toFixed(2) });
  }
  return out;
}
const L = await local({ variant: 'typical', clock: 'demo' });
const B = [];
try {
  for (const [app, wait] of [['f260', 3500], ['prayer', 3000], ['leftovers', 2500]]) {
    await L.reset('typical');
    const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'eli' });
    await d.goto('#home'); const f = await d.openApp(app); await sleep(wait);
    const r = await scan(d, f, app); B.push(...r); r.forEach(x => console.log(JSON.stringify(x)));
    if (app === 'f260') await d.page.screenshot({ path: path.join(EV, 'verify-mid-tone-semantic-as-ink-1-f260.png'), scale: 'css' });
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'verify-mid-tone-semantic-as-ink-1.json'), JSON.stringify({ note: 'skeptic #1 re-measure; A = token pairs parsed from apps/design.css; B = runtime text rendered in a mid tone, System theme light OS, ipad-portrait, WebKit, pixel-sampled p10/median over the first line box', A, B }, null, 1));
console.log('saved');
