// Phase 4 COLOR skeptic #2: re-measure the Me hero's Switch button (.ds .hero .btn-primary, apps/design.css:423) in
// light and dark for adults, kids, the guest and the kiosk, independently of spot.mjs.
// Method: set the theme as the rig does (PUT app_data(person,'hub','theme') as the profile + localStorage 'hub.theme'),
// open #me, read the button's computed color / background-color / opacity chain and the resolved --accent/--accent-deep,
// then screenshot at 1x CSS with all text transparent and sample the painted background inside the button's inner box
// (excluding a 6 px border band). Report (a) the ratio of computed ink vs computed fill composited over the page bg
// and (b) the pixel p10/median of ink vs sampled fill. Also token maths for the ten SWATCHES (index.html:449).
// Usage: node audits/tools/phase4/COLOR/verify-hero-primary-button-inverts-dark-2.mjs
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const EV = path.resolve('audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
function decodePng(buf) { let o = 8, w, h, ct, idat = []; while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], line = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } px[y * st + x] = v & 255; } }
  return { at: (x, y) => { const i = (y * w + x) * bpp; return [px[i], px[i + 1], px[i + 2]]; } }; }
const parse = s => { const srgb = /^color\(srgb/.test(s); const m = s.replace(/^color\(srgb/, '').match(/[\d.]+/g).map(Number); const c = m.slice(0, 3).map(v => srgb ? v * 255 : v); return { c, a: m.length > 3 ? m[3] : 1 }; };
const hexOf = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const hexIn = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p));

const CASES = [
  ['eli', 'midnight', 'light'], ['eli', 'system', 'dark'], ['eli', 'forest', 'light'], ['eli', 'system', 'light'],
  ['kiara', 'midnight', 'light'], ['kiara', 'system', 'light'], ['ezra', 'system', 'dark'], ['ezra', 'system', 'light'],
  ['dad', 'forest', 'light'], ['christian', 'system', 'dark'], ['niece', 'system', 'dark'],
  ['guest-grandmajo', 'system', 'dark'], ['tv', 'system', 'dark'],
];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { cases: [], tokenMath: {} };
try {
  for (const [p, th, mode] of CASES) {
    await L.reset('typical');
    if (th !== 'system') { const r = await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: th } }); if (r.status >= 300) { out.cases.push({ p, th, mode, error: 'theme PUT ' + r.status }); continue; } }
    const d = await L.device({ device: 'ipad-portrait', mode, profile: p, localStorage: th !== 'system' ? { 'hub.theme': JSON.stringify(th) } : {} });
    try {
      await d.goto('#me');
      const ok = await d.page.waitForSelector('#switch', { timeout: 15000 }).then(() => true, () => false);
      if (!ok) { out.cases.push({ p, th, mode, error: '#switch not rendered' }); continue; }
      await sleep(1800);
      const info = await d.page.evaluate(() => {
        const e = document.getElementById('switch'); e.scrollIntoView({ block: 'center' });
        const cs = getComputedStyle(e), root = getComputedStyle(document.documentElement);
        let op = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) op *= +getComputedStyle(n).opacity;
        const probe = document.createElement('i'); e.parentElement.append(probe);
        probe.style.color = 'var(--accent-deep)'; const deep = getComputedStyle(probe).color; probe.style.color = 'var(--accent)'; const acc = getComputedStyle(probe).color; probe.remove();
        const b = e.getBoundingClientRect();
        return { color: cs.color, bg: cs.backgroundColor, fs: cs.fontSize, fw: cs.fontWeight, opacity: op, accent: acc, accentDeep: deep,
          theme: document.documentElement.dataset.theme || 'system', scheme: document.documentElement.dataset.scheme, kind: document.documentElement.dataset.kind,
          inHero: !!e.closest('.ds .hero'), rect: [b.x, b.y, b.width, b.height], label: e.textContent.trim() };
      });
      await d.page.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important}' });
      await sleep(150);
      const img = decodePng(await d.page.screenshot({ scale: 'css', animations: 'disabled' }));
      const ink = parse(info.color), [x, y, w, h] = info.rect, rs = [], bgs = [];
      for (let yy = Math.ceil(y + 8); yy < y + h - 8; yy++) for (let xx = Math.ceil(x + 8); xx < x + w - 8; xx++) { const bg = img.at(xx, yy); const t = ink.c.map((v, i) => v * ink.a * info.opacity + bg[i] * (1 - ink.a * info.opacity)); rs.push(ratio(t, bg)); bgs.push(bg); }
      rs.sort((a, b) => a - b); bgs.sort((a, b) => lum(a) - lum(b));
      const row = { profile: p, theme: th, os: mode, scheme: info.scheme, kind: info.kind, inHero: info.inHero, label: info.label, fs: info.fs, fw: info.fw,
        ink: hexOf(ink.c), fillCss: info.bg, accent: hexOf(parse(info.accent).c), accentDeep: hexOf(parse(info.accentDeep).c),
        fillSampledMedian: hexOf(bgs[bgs.length >> 1]), p10: +rs[Math.floor(rs.length * .1)].toFixed(2), median: +rs[rs.length >> 1].toFixed(2), max: +rs[rs.length - 1].toFixed(2), n: rs.length };
      out.cases.push(row); console.log(JSON.stringify(row));
      if (p === 'kiara' && th === 'midnight') { await d.page.evaluate(() => document.querySelectorAll('style').forEach(s => { if (s.textContent.startsWith('*{color:transparent')) s.remove(); })); await sleep(150);
        const r = info.rect; await d.page.screenshot({ path: path.join(EV, 'verify-hero-primary-button-inverts-dark-2-kiara-midnight.png'), scale: 'css', clip: { x: 0, y: Math.max(0, r[1] - 140), width: 820, height: 300 } }); }
      if (p === 'eli' && th === 'system' && mode === 'dark') { await d.page.evaluate(() => document.querySelectorAll('style').forEach(s => { if (s.textContent.startsWith('*{color:transparent')) s.remove(); })); await sleep(150);
        const r = info.rect; await d.page.screenshot({ path: path.join(EV, 'verify-hero-primary-button-inverts-dark-2-eli-systemdark.png'), scale: 'css', clip: { x: 0, y: Math.max(0, r[1] - 140), width: 820, height: 300 } }); }
    } finally { await d.close(); }
  }
} finally { await L.close(); }
// token maths: dark --accent-deep = color-mix(accent 58%, white) on rgba(255,255,255,.92) over a dark hero (fill ~ white)
const SW = ['#4F5D8C', '#BC5A38', '#137F77', '#B4861B', '#8A6A4B', '#3D5A3D', '#5B8143', '#4C4C58', '#8C4F7A', '#4C7B6A'];
for (const s of SW) { const a = hexIn(s), darkDeep = mix(a, [255, 255, 255], .58), lightDeep = mix(a, [0, 0, 0], .72); const fill = mix([255, 255, 255], a, .92);
  out.tokenMath[s] = { darkDeep: hexOf(darkDeep), darkOn92White: +ratio(darkDeep, fill).toFixed(2), lightDeep72black: hexOf(lightDeep), lightOn92White: +ratio(lightDeep, fill).toFixed(2) }; }
console.log(JSON.stringify(out.tokenMath));
fs.writeFileSync(path.join(EV, 'verify-hero-primary-button-inverts-dark-2.json'), JSON.stringify(out, null, 1));
