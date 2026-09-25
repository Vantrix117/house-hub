// Phase 4 COLOR, skeptic 2: re-measure "raw profile colour used as ink with no dark lift".
// Independent of spot.mjs / DARK/accent-fg.mjs. For each case: set the theme (server row PUT as the profile + localStorage
// 'hub.theme'), open the real screen (no synthetic elements), read the element's computed colour / stroke, find the
// solid background by walking ancestors, AND sample the rendered pixels behind it (text/svg hidden), then report ratios.
// Also computes the existing --accent-deep token for the same profile/theme (the lifted ink design.css already has).
//   node audits/tools/phase4/COLOR/verify-raw-accent-ink-no-dark-lift-2.mjs
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const EV = path.join(ROOT, 'audits/evidence/p4/COLOR'); fs.mkdirSync(EV, { recursive: true });
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const lum = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
const CR = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(2); };
const P = s => { s = String(s).trim(); if (s.startsWith('#')) return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const srgb = /^color\(srgb/.test(s); const m = s.replace(/^color\(srgb/, '').match(/[\d.]+/g).map(Number); return { c: m.slice(0, 3).map(v => srgb ? v * 255 : v), a: m.length > 3 ? m[3] : 1 }; };
const rgb = s => { const p = P(s); return Array.isArray(p) ? p : p.c; };
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
function png(buf) { let o = 8, w, h, ct, idat = []; while (o < buf.length) { const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], line = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } px[y * st + x] = v & 255; } }
  return { at: (x, y) => { const i = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * bpp; return [px[i], px[i + 1], px[i + 2]]; } }; }

// computed fg + solid ancestor bg + rendered bg median behind the element's box (content hidden)
async function probe(d, doc, sel, prop) {
  const off = doc === d.page ? [0, 0] : await d.page.evaluate(() => { const b = document.querySelector('iframe#frame, iframe').getBoundingClientRect(); return [b.x, b.y]; });
  const info = await doc.evaluate(({ sel, prop }) => {
    const e = [...document.querySelectorAll(sel)].find(x => x.getClientRects().length); if (!e) return null;
    e.scrollIntoView({ block: 'center' });
    const cs = getComputedStyle(e); let n = e, bg = 'rgba(0, 0, 0, 0)', layers = [];
    while (n && n.nodeType === 1) { const b = getComputedStyle(n).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(b)) { layers.push({ at: n.id || n.className || n.tagName, bg: b }); if (!/rgba|\/ 0\.|color\(srgb [\d. ]+\/ /.test(b)) { bg = b; break; } } n = n.parentElement; }
    let op = 1; for (let m = e; m && m.nodeType === 1; m = m.parentElement) op *= +getComputedStyle(m).opacity;
    const rs = getComputedStyle(document.documentElement);
    return { fg: prop === 'stroke' ? cs.stroke : cs.color, fs: cs.fontSize, fw: cs.fontWeight, text: (e.textContent || '').trim().slice(0, 30), solidBg: bg, layers: layers.slice(0, 4), opacity: +op.toFixed(3),
      accent: rs.getPropertyValue('--accent').trim(), theme: document.documentElement.dataset.theme || 'system', scheme: document.documentElement.dataset.scheme };
  }, { sel, prop });
  if (!info) return { sel, error: 'not found' };
  await sleep(300);
  const rect = await doc.evaluate(sel => { const e = [...document.querySelectorAll(sel)].find(x => x.getClientRects().length); const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; }, sel);
  await doc.evaluate(() => { const s = document.createElement('style'); s.id = '__v2hide'; s.textContent = '*{color:transparent!important;-webkit-text-fill-color:transparent!important} svg{visibility:hidden!important}'; document.head.append(s); });
  await sleep(150);
  const img = png(await d.page.screenshot({ scale: 'css', animations: 'disabled' }));
  await doc.evaluate(() => document.getElementById('__v2hide')?.remove());
  const bgs = []; const [x, y, w, h] = rect;
  for (let yy = y + 1; yy < y + h - 1; yy += 1) for (let xx = x + 1; xx < x + w - 1; xx += 1) bgs.push(img.at(Math.round(xx + off[0]), Math.round(yy + off[1])));
  bgs.sort((p, q) => lum(p) - lum(q));
  const fgP = P(info.fg), fg = Array.isArray(fgP) ? fgP : fgP.c, a = (Array.isArray(fgP) ? 1 : fgP.a) * info.opacity;
  const blend = bg => fg.map((v, i) => v * a + bg[i] * (1 - a));
  const med = bgs[bgs.length >> 1], p10bg = bgs[Math.floor(bgs.length * .9)]; // lighter bg = worse for light ink; report both ends
  return { sel, ...info, fgHex: hex(fg), renderedBgMedian: hex(med), ratioRendered: CR(blend(med), med), ratioRenderedLightestDecile: CR(blend(p10bg), p10bg), ratioSolid: info.solidBg !== 'rgba(0, 0, 0, 0)' ? CR(fg, rgb(info.solidBg)) : null };
}
async function themed(L, variant, profile, theme, mode, device = 'ipad-portrait') {
  await L.reset(variant);
  if (theme !== 'system') { const r = await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }); if (r && r.status >= 300) throw new Error('theme PUT'); }
  return L.device({ device, mode, profile, localStorage: theme !== 'system' ? { 'hub.theme': JSON.stringify(theme) } : {} });
}
const out = { note: 'skeptic 2 re-measure; ratioRendered = computed ink over the rendered median background behind the element box (content hidden), 1x CSS WebKit; ratioSolid = ink vs first opaque ancestor background.', prayer: [], park: [], tokens: [] };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  // 0. Token maths: raw accent and the existing lifted --accent-deep vs --bg/--surface/--surface-2 in every palette
  {
    const d = await L.device({ device: 'desktop', mode: 'light', profile: 'eli' }); await d.goto('#home'); await sleep(1500);
    const cols = { eli: '#4F5D8C', christian: '#BC5A38', ezra: '#137F77', kiara: '#B4861B', mom: '#8A6A4B', dad: '#3D5A3D', niece: '#5B8143', tv: '#4C4C58' };
    out.tokens = await d.page.evaluate(cols => {
      const r = document.documentElement, res = [];
      for (const th of ['hearth', 'parchment', 'frost', 'midnight', 'forest']) {
        if (th === 'hearth') delete r.dataset.theme; else r.dataset.theme = th;
        for (const [id, c] of Object.entries(cols)) {
          r.style.setProperty('--accent', c);
          const pr = document.createElement('i'); document.body.append(pr);
          const get = v => { pr.style.color = `var(${v})`; return getComputedStyle(pr).color; };
          res.push({ th, id, raw: c, deep: get('--accent-deep'), bg: get('--bg'), surface: get('--surface'), surface2: get('--surface-2') }); pr.remove();
        }
      }
      return res;
    }, cols);
    for (const t of out.tokens) { t.rawOn = { bg: CR(rgb(t.raw), rgb(t.bg)), surface: CR(rgb(t.raw), rgb(t.surface)), surface2: CR(rgb(t.raw), rgb(t.surface2)) }; t.deepOn = { bg: CR(rgb(t.deep), rgb(t.bg)), surface: CR(rgb(t.deep), rgb(t.surface)), surface2: CR(rgb(t.deep), rgb(t.surface2)) }; }
    await d.close();
    for (const t of out.tokens) console.log('token', t.th.padEnd(9), t.id.padEnd(9), 'raw', JSON.stringify(t.rawOn), 'deep', JSON.stringify(t.deepOn));
  }
  // 1. Prayer kitchen category labels and the mic button
  for (const [p, th, mode] of [['eli', 'midnight', 'light'], ['eli', 'forest', 'light'], ['eli', 'system', 'dark'], ['eli', 'system', 'light'], ['dad', 'midnight', 'light'], ['kiara', 'parchment', 'light'], ['christian', 'midnight', 'light']]) {
    const d = await themed(L, 'typical', p, th, mode); const rec = { p, th, mode };
    try {
      await d.goto('#home'); const f = await d.openApp('prayer', { wait: '#moreBtn' }); await sleep(1800);
      if (p !== 'kiara') {
        await f.click('#moreBtn'); await sleep(500); await f.click('[data-more="kitchen"]'); await f.waitForSelector('#kitchen.on', { timeout: 6000 }); await sleep(700);
        rec.kcat = await probe(d, f, '#kitchen .k-cat', 'color');
        if (p === 'eli' && th === 'midnight') await d.page.screenshot({ path: path.join(EV, 'verify-raw-accent-ink-no-dark-lift-2-kitchen-midnight.png'), scale: 'css' });
        await f.evaluate(() => document.querySelector('#kitchen .close')?.click()); await sleep(500);
        await f.evaluate(() => document.getElementById('fab')?.click()); await sleep(900);
        await f.evaluate(() => { const m = document.getElementById('f-mic'); if (m) m.hidden = false; });  // shown only where speech is supported; the rig stubs it
        rec.micHiddenByApp = await f.evaluate(() => { const m = document.getElementById('f-mic'); return m ? m.getAttribute('data-was') : null; });
        rec.mic = await probe(d, f, '#f-mic', 'color');
      }
    } catch (e) { rec.err = String(e).slice(0, 200); } finally { await d.close(); }
    out.prayer.push(rec); console.log('prayer', p, th, mode, JSON.stringify({ kcat: rec.kcat && [rec.kcat.fgHex, rec.kcat.renderedBgMedian, rec.kcat.ratioRendered, rec.kcat.ratioSolid, rec.kcat.fs], mic: rec.mic && [rec.mic.fgHex, rec.mic.renderedBgMedian, rec.mic.ratioRendered, rec.mic.ratioSolid], err: rec.err }));
  }
  // 2. Park map: Nearby walk times + selected tab icon, after placing yourself inside the park
  for (const [p, th, mode] of [['eli', 'midnight', 'light'], ['dad', 'midnight', 'light'], ['eli', 'system', 'dark'], ['eli', 'system', 'light'], ['kiara', 'system', 'light'], ['kiara', 'parchment', 'light'], ['mom', 'forest', 'light']]) {
    const d = await themed(L, 'park', p, th, mode, 'iphone-pwa'); const rec = { p, th, mode };
    try {
      await d.goto('#home'); const f = await d.openApp('dollywood-live', { wait: 'body' }); await sleep(3500);
      rec.placed = await f.evaluate(() => { try { const o = OFF.filter(o => o.pos)[5]; setMe(o.pos[0] + 8, o.pos[1] + 8, 10, null, 'manual'); if (typeof showPane === 'function') showPane('near'); if (typeof setSheet === 'function') setSheet('half'); return true; } catch (e) { return String(e); } });
      await sleep(1200);
      rec.walk = await probe(d, f, '.lv-item .d small', 'color');
      rec.tabIcon = await probe(d, f, '.lv-tabs button[aria-pressed=true] svg', 'stroke');
      rec.tabBtn = await f.evaluate(() => { const b = document.querySelector('.lv-tabs button[aria-pressed=true]'); return b && { id: b.id, bg: getComputedStyle(b).backgroundColor, label: getComputedStyle(b).color }; });
      if (p === 'dad' && th === 'midnight') await d.page.screenshot({ path: path.join(EV, 'verify-raw-accent-ink-no-dark-lift-2-park-dad-midnight.png'), scale: 'css' });
    } catch (e) { rec.err = String(e).slice(0, 200); } finally { await d.close(); }
    out.park.push(rec); console.log('park', p, th, mode, JSON.stringify({ placed: rec.placed, walk: rec.walk && [rec.walk.text, rec.walk.fgHex, rec.walk.renderedBgMedian, rec.walk.ratioRendered, rec.walk.ratioRenderedLightestDecile, rec.walk.fs], tab: rec.tabIcon && [rec.tabIcon.fgHex, rec.tabIcon.renderedBgMedian, rec.tabIcon.ratioRendered], err: rec.err }));
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'verify-raw-accent-ink-no-dark-lift-2.json'), JSON.stringify(out, null, 1));
console.log('saved audits/evidence/p4/COLOR/verify-raw-accent-ink-no-dark-lift-2.json');
