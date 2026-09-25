// Phase 4 COLOR, skeptic #1 for "muted-on-wells-and-derived-surfaces". Independent of palette.mjs / components.mjs.
// Part A: parse apps/design.css token blocks; WCAG ratio of --muted on bg / surface / surface-2 per light theme, and on
//         F260's New Testament mixes (apps/f260.html:24-27: color-mix(in srgb, X 93%, teal)).
// Part B: local instance (webkit, demo clock): per case set the theme (PUT hub/theme as the profile + localStorage),
//         read the element's computed colour, hide every glyph in that document, screenshot the element at 1x CSS and
//         compare the text colour with the pixels under it (p10 / median ratio).
// Usage: node audits/tools/phase4/COLOR/verify-muted-on-wells-and-derived-surfaces-1.mjs
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const OUT = path.join(EV, 'verify-muted-on-wells-and-derived-surfaces-1');
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) => a.map((v, i) => Math.round(v * p + b[i] * (1 - p)));
const r2 = n => +n.toFixed(2);

// ── Part A: tokens ──
const css = fs.readFileSync('apps/design.css', 'utf8');
function block(re) { const i = css.search(re); const s = css.indexOf('{', i); let d = 0, j = s; for (; j < css.length; j++) { if (css[j] === '{') d++; else if (css[j] === '}' && --d === 0) break; } return css.slice(s + 1, j); }
const vars = b => Object.fromEntries([...b.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]));
const hearth = vars(block(/^:root \{/m));
const T = { hearth, parchment: { ...hearth, ...vars(block(/:root\[data-theme="parchment"\]/)) }, frost: { ...hearth, ...vars(block(/:root\[data-theme="frost"\]/)) } };
const A = {};
for (const [t, v] of Object.entries(T)) {
  const m = hx(v.muted), teal = hx(v.teal);
  A[t] = { muted: v.muted, onBg: r2(ratio(m, hx(v.bg))), onSurface: r2(ratio(m, hx(v.surface))), onSurface2: r2(ratio(m, hx(v['surface-2']))),
    ntPaper: r2(ratio(m, mix(hx(v.bg), teal, .93))), ntRaised: r2(ratio(m, mix(hx(v.surface), teal, .94))), ntSunk: r2(ratio(m, mix(hx(v['surface-2']), teal, .93))) };
  console.log('A', t, JSON.stringify(A[t]));
}
const ntLine = fs.readFileSync('apps/f260.html', 'utf8').split('\n').findIndex(l => /body\.nt\{/.test(l)) + 1;
const ntToggle = fs.readFileSync('apps/f260.html', 'utf8').split('\n').findIndex(l => /classList\.toggle\('nt'/.test(l)) + 1;
console.log('A f260 body.nt rule at line', ntLine, '; toggle at line', ntToggle);

// ── PNG decode (8-bit RGB/RGBA) ──
function png(buf) {
  let o = 8, w, h, ct; const idat = [];
  while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), st = w * bpp, px = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)];
    for (let x = 0; x < st; x++) { const v0 = raw[y * (st + 1) + 1 + x], a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = v0;
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * st + x] = v & 255; } }
  const out = []; for (let i = 0; i < px.length; i += bpp) out.push([px[i], px[i + 1], px[i + 2]]); return { w, h, px: out };
}
const pct = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

// ── Part B: runtime ──
const PRAYER_ALL = async f => { await f.click('nav [data-go="all"]', { timeout: 5000 }).catch(e => console.log('nav all failed', e.message)); await sleep(900); };
const CASES = [
  { id: 'shell-hearth-theme-blurb', theme: 'hearth', profile: 'eli', device: 'desktop', where: 'shell', hash: '#me', sel: '.theme-blurb' },
  { id: 'shell-parchment-theme-blurb', theme: 'parchment', profile: 'eli', device: 'desktop', where: 'shell', hash: '#me', sel: '.theme-blurb' },
  { id: 'shell-frost-theme-blurb', theme: 'frost', profile: 'eli', device: 'desktop', where: 'shell', hash: '#me', sel: '.theme-blurb' },
  { id: 'f260-hearth', theme: 'hearth', profile: 'eli', device: 'desktop', where: 'f260', sel: '#pct, #hlbl, textarea.rf-f' },
  { id: 'kidverse-hearth-also-ipad', theme: 'hearth', profile: 'ezra', device: 'ipad-portrait', where: 'kidverse', sel: '#also' },
  { id: 'kidverse-hearth-also-desktop', theme: 'hearth', profile: 'ezra', device: 'desktop', where: 'kidverse', sel: '#also' },
  // Phase 1's kid-reading capture shows #also near the top of the viewport (scrolled past the scene), under the fixed wash
  { id: 'kidverse-hearth-also-desktop-scrolled', theme: 'hearth', profile: 'ezra', device: 'desktop', where: 'kidverse', sel: '#also',
    pre: async f => { await f.evaluate(() => { const e = document.getElementById('also'); const s = document.scrollingElement; s.scrollTop += e.getBoundingClientRect().top - 110; }); await sleep(600); } },
  { id: 'prayer-hearth-count', theme: 'hearth', profile: 'eli', device: 'ipad-portrait', where: 'prayer', sel: 'span.end > span.n, #listSwitch button', pre: PRAYER_ALL },
  { id: 'prayer-parchment-count', theme: 'parchment', profile: 'eli', device: 'ipad-portrait', where: 'prayer', sel: 'span.end > span.n, #listSwitch button', pre: PRAYER_ALL },
];
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const B = [];
try {
  for (const c of CASES) {
    const put = await L.apiAs(c.profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: c.theme } });
    const d = await L.device({ device: c.device, mode: 'light', profile: c.profile, localStorage: { 'hub.theme': c.theme } });
    let fr;
    if (c.where === 'shell') { await d.goto(c.hash); fr = d.page; } else { fr = await d.openApp(c.where); }
    await sleep(2500);
    if (c.pre) await c.pre(fr);
    const state = await fr.evaluate(() => ({ theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme, nt: document.body.classList.contains('nt'),
      bodyBg: getComputedStyle(document.body).backgroundColor, muted: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() }));
    const els = await fr.$$(c.sel);
    const infos = [];
    for (const [i, el] of els.slice(0, 12).entries()) {
      const info = await el.evaluate(e => { const cs = getComputedStyle(e); let p = e, bg = 'rgba(0, 0, 0, 0)', bgEl = '';
        while (p) { const b = getComputedStyle(p).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) { bg = b; bgEl = p.tagName.toLowerCase() + (p.id ? '#' + p.id : '') + (p.className && typeof p.className === 'string' ? '.' + p.className.trim().split(/\s+/).join('.') : ''); break; } p = p.parentElement; }
        const r = e.getBoundingClientRect(); return { text: (e.value || e.placeholder || e.textContent || '').trim().slice(0, 60), color: cs.color, fs: cs.fontSize, fw: cs.fontWeight, declaredBg: bg, bgEl, w: r.width, h: r.height, visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' }; });
      infos.push({ i, el, info });
    }
    // hide every glyph in this document so the screenshot shows only what is behind the text
    await fr.evaluate(() => { const s = document.createElement('style'); s.id = 'vfy-hide'; s.textContent = '*,*::before,*::after,*::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}'; document.head.appendChild(s); });
    await sleep(300);
    const rows = [];
    for (const { i, el, info } of infos) {
      if (!info.visible) { rows.push({ ...info, skipped: 'not visible' }); continue; }
      let buf; try { await el.scrollIntoViewIfNeeded({ timeout: 3000 }); buf = await el.screenshot({ animations: 'disabled', scale: 'css', timeout: 5000 }); } catch (e) { rows.push({ ...info, skipped: String(e.message).slice(0, 80) }); continue; }
      const { px } = png(buf); const tc = rgb(info.color);
      const rs = px.map(p => ratio(tc, p)); const bgMed = [0, 1, 2].map(k => pct(px.map(p => p[k]), .5));
      const row = { ...info, colorHex: toHex(tc), declaredBgHex: toHex(rgb(info.declaredBg)), declaredRatio: r2(ratio(tc, rgb(info.declaredBg))), pixelBgMedian: toHex(bgMed), p10: r2(pct(rs, .1)), med: r2(pct(rs, .5)), n: px.length };
      // cross-check through a viewport screenshot (fixed-attachment washes paint relative to the viewport)
      try { const bb = await el.boundingBox(); const vs = png(await d.page.screenshot({ animations: 'disabled', scale: 'css' }));
        const sub = []; for (let y = Math.max(0, Math.floor(bb.y)); y < Math.min(vs.h, Math.ceil(bb.y + bb.height)); y++) for (let x = Math.max(0, Math.floor(bb.x)); x < Math.min(vs.w, Math.ceil(bb.x + bb.width)); x++) sub.push(vs.px[y * vs.w + x]);
        const vr = sub.map(p => ratio(tc, p)); row.viewport = { box: [bb.x, bb.y, bb.width, bb.height].map(Math.round), bgMedian: toHex([0, 1, 2].map(k => pct(sub.map(p => p[k]), .5))), p10: r2(pct(vr, .1)), med: r2(pct(vr, .5)) };
        if (i === 0 && /kidverse/.test(c.id)) fs.writeFileSync(`${OUT}-${c.id}-viewport.png`, await d.page.screenshot({ animations: 'disabled', scale: 'css', type: 'png' }));
      } catch (e) { row.viewport = { error: String(e.message).slice(0, 80) }; }
      rows.push(row);
      if (i === 0) fs.writeFileSync(`${OUT}-${c.id}.png`, buf);
    }
    const r = { id: c.id, themePut: put.status, ...state, rows };
    B.push(r);
    console.log('B', c.id, JSON.stringify({ theme: state.theme, nt: state.nt, muted: state.muted, bodyBg: state.bodyBg }));
    for (const x of rows) console.log('   ', x.skipped ? `skip (${x.skipped})` : `${x.colorHex} on ${x.declaredBgHex} (${x.bgEl}) decl ${x.declaredRatio} | pixels ${x.pixelBgMedian} p10 ${x.p10} med ${x.med} | viewport ${JSON.stringify(x.viewport)}`, '|', x.fs, x.fw, JSON.stringify(x.text));
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(OUT + '.json', JSON.stringify({ at: new Date().toISOString(), A, ntRuleLine: ntLine, ntToggleLine: ntToggle, B: B.map(b => ({ ...b, rows: b.rows.map(({ el, ...x }) => x) })) }, null, 1));
console.log('wrote', OUT + '.json');
