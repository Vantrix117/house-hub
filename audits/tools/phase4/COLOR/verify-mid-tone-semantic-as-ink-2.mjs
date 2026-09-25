// Phase 4 COLOR, skeptic #2 for "mid-tone-semantic-as-ink". Independent of palette.mjs / spot.mjs / components.mjs.
// Part A: parse apps/design.css token blocks and compute WCAG ratios of each hue base and its -ink on bg / surface / -soft.
// Part B: on the local instance, open F260, Prayer, Larder, Kid Verse and read computed colour of chosen elements,
//         hide all text, screenshot at 1x CSS and sample the background under the element (p10 / median ratio).
// Usage: node audits/tools/phase4/COLOR/verify-mid-tone-semantic-as-ink-2.mjs
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

// ── Part A ──
const css = fs.readFileSync('apps/design.css', 'utf8');
function block(startRe) { const i = css.search(startRe); const s = css.indexOf('{', i); let d = 0, j = s; for (; j < css.length; j++) { if (css[j] === '{') d++; else if (css[j] === '}' && --d === 0) break; } return css.slice(s + 1, j); }
const vars = b => Object.fromEntries([...b.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]));
const hearth = vars(block(/^:root \{/m));
const themes = { hearth, parchment: { ...hearth, ...vars(block(/:root\[data-theme="parchment"\]/)) }, frost: { ...hearth, ...vars(block(/:root\[data-theme="frost"\]/)) },
  midnight: { ...hearth, ...vars(block(/:root\[data-theme="midnight"\]/)) }, forest: { ...hearth, ...vars(block(/:root\[data-theme="forest"\]/)) } };
const A = {};
for (const [t, v] of Object.entries(themes)) {
  A[t] = {};
  for (const f of ['gold', 'olive', 'terra', 'teal']) {
    const r = (a, b) => +ratio(hx(v[a]), hx(v[b])).toFixed(2);
    A[t][f] = { base: v[f], baseOnBg: r(f, 'bg'), baseOnSurface: r(f, 'surface'), baseOnSoft: r(f, f + '-soft'), inkOnBg: r(f + '-ink', 'bg'), inkOnSoft: r(f + '-ink', f + '-soft') };
  }
}
const aliases = [...css.matchAll(/--(ok|warn|danger|info):\s*var\(--([a-z]+)\)/g)].map(m => `${m[1]}->${m[2]}`);
console.log('A aliases', aliases.join(' '));
for (const t in A) console.log('A', t, JSON.stringify(A[t]));

// ── Part B ──
function png(buf) { let o = 8, w, h, ct, idat = []; while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], ln = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1));
    for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = ln[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * st + x] = v & 255; } }
  return { at: (x, y) => { x = Math.min(w - 1, Math.max(0, x)); y = Math.min(h - 1, Math.max(0, y)); const i = (y * w + x) * bpp; return [px[i], px[i + 1], px[i + 2]]; } }; }
const parseCol = s => { const srgb = /^color\(srgb/.test(s); const m = s.replace(/^color\(srgb/, '').match(/[\d.]+/g).map(Number); return { rgb: m.slice(0, 3).map(v => srgb ? v * 255 : v), a: m.length > 3 ? m[3] : 1 }; };

async function probe(d, frame, sel, prop = 'color') {
  const info = await frame.evaluate(({ sel, prop }) => {
    const e = [...document.querySelectorAll(sel)].find(x => x.getClientRects().length); if (!e) return null;
    e.scrollIntoView({ block: 'center' });
    const cs = getComputedStyle(e); let op = 1; for (let n = e; n; n = n.parentElement) op *= +getComputedStyle(n).opacity;
    return { text: (e.innerText || '').trim().slice(0, 30), col: prop === 'ring' ? (cs.boxShadow.match(/(rgb[^)]*\)|color\([^)]*\))/) || [cs.color])[0] : cs[prop], fs: cs.fontSize, fw: cs.fontWeight, op, theme: document.documentElement.dataset.theme || 'system', scheme: document.documentElement.dataset.scheme };
  }, { sel, prop });
  if (!info) return { sel, error: 'not found' };
  await sleep(300);
  const rect = await frame.evaluate(({ sel, prop }) => { const e = [...document.querySelectorAll(sel)].find(x => x.getClientRects().length); const b = e.getBoundingClientRect();
    if (prop === 'ring') return [b.x - 6, b.y - 6, b.width + 12, b.height + 12, 1];
    const r = document.createRange(); r.selectNodeContents(e); const c = r.getClientRects()[0] || b; return [c.x, c.y + c.height * .2, c.width, c.height * .6, 0]; }, { sel, prop });
  const off = frame === d.page.mainFrame() ? [0, 0] : await (await frame.frameElement()).boundingBox().then(b => [b.x, b.y]);
  await frame.evaluate(({ sel, ring }) => { const s = document.createElement('style'); s.id = '__v2hide'; s.textContent = '*{color:transparent!important;-webkit-text-fill-color:transparent!important}' + (ring ? sel + '{box-shadow:none!important;visibility:hidden!important}' : ''); document.head.append(s); }, { sel, ring: prop === 'ring' });
  await sleep(150);
  const img = png(await d.page.screenshot({ scale: 'css', animations: 'disabled' }));
  await frame.evaluate(() => document.getElementById('__v2hide')?.remove());
  const { rgb, a } = parseCol(info.col); const al = a * info.op; const rs = [];
  const [x, y, w, h] = rect;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const bg = img.at(Math.round(xx + off[0]), Math.round(yy + off[1])); rs.push(ratio(rgb.map((v, i) => v * al + bg[i] * (1 - al)), bg)); }
  rs.sort((p, q) => p - q);
  return { sel, ...info, alpha: +al.toFixed(2), p10: +rs[Math.floor(rs.length * .1)].toFixed(2), median: +rs[rs.length >> 1].toFixed(2), n: rs.length };
}
async function themed(L, profile, theme, mode, device = 'ipad-portrait') {
  await L.reset('typical');
  if (theme !== 'system') await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
  return L.device({ device, mode, profile, localStorage: theme !== 'system' ? { 'hub.theme': JSON.stringify(theme) } : {} });
}
const CASES = {
  f260: ['#chCount', '.hero-ref small', '.hero-ref b', '.hero .k', '.hero-pace', '#passErr', ['.heat span.today', 'ring']],
  prayer: ['.ans .when', '.ledger b', '.recall b', '.cold', '.err'],
  leftovers: ['.err'],
  kidverse: [['.days span.on .icon', 'color'], '.ref .kicker'],
};
const B = [];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const [theme, mode] of [['system', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'light']]) {
    for (const [app, sels] of Object.entries(CASES)) {
      const prof = app === 'kidverse' ? 'ezra' : 'eli';
      const d = await themed(L, prof, theme, mode);
      try {
        const f = await d.openApp(app); await sleep(2500);
        for (const s of sels) { const [sel, prop] = Array.isArray(s) ? s : [s, 'color']; const r = await probe(d, f, sel, prop).catch(e => ({ sel, error: String(e).slice(0, 120) })); r.app = app; r.req = theme + '/' + mode; B.push(r); console.log('B', app, theme, JSON.stringify(r)); }
        if (theme === 'system' && app === 'f260') await d.page.screenshot({ path: path.join(EV, 'verify-mid-tone-semantic-as-ink-2-f260-hearth.png'), scale: 'css' });
        if (theme === 'system' && app === 'prayer') await d.page.screenshot({ path: path.join(EV, 'verify-mid-tone-semantic-as-ink-2-prayer-hearth.png'), scale: 'css' });
      } finally { await d.close(); }
    }
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'verify-mid-tone-semantic-as-ink-2.json'), JSON.stringify({ aliases, tokenMath: A, rendered: B }, null, 1));
