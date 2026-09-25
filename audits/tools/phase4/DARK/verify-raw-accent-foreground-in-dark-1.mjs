// Phase 4 DARK, skeptic #1 for "raw-accent-foreground-in-dark". Independent re-measure on the local instance (WebKit).
// For each theme x profile it reads (a) the computed colour and the resolved background and (b) the RENDERED pixels
// (a css-scale screenshot decoded in the page with a canvas) for:
//   - Prayer Kitchen view category label  #kitchen .k-cat           (apps/prayer.html:359)
//   - park map Nearby list walk time      .lv-item .d small         (template.html:440) - REAL rows: "me" is placed with the
//     app's own setMe() next to a ride so renderNear() builds the list, and the sheet is opened to half
//   - Timer dial arc                      .dial .ring .fg           (apps/timer.html:22,29), idle dial at --p:1 (full ring)
// Text: ratio of the computed colour vs the modal background pixel, and of the "inkiest" rendered pixel vs that background.
// Arc: the stroke's centre-line pixel vs the dial pixel just inside and just outside the ring.
//   node audits/tools/phase4/DARK/verify-raw-accent-foreground-in-dark-1.mjs [theme:profile ...]
import fs from 'node:fs'; import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const Lm = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const CR = (a, b) => { if (!a || !b) return null; const x = Lm(a), y = Lm(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const P = s => { s = String(s).trim(); if (s.startsWith('#')) { if (s.length === 4) s = '#' + [1, 2, 3].map(i => s[i] + s[i]).join(''); return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); } const m = s.match(/[\d.]+/g); return m && m.slice(0, 3).map(Number); };
const EV = path.join(ROOT, 'audits/evidence/p4/DARK');
const args = process.argv.slice(2);
const runs = (args.length ? args : ['midnight:eli', 'midnight:dad', 'midnight:christian', 'forest:eli', 'forest:dad', 'hearth:eli']).map(s => s.split(':'));

async function pixels(page, buf) {
  return page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, d: Array.from(x.getImageData(0, 0, img.width, img.height).data) };
  }, buf.toString('base64'));
}
const px = (im, x, y) => { x = Math.max(0, Math.min(im.w - 1, Math.round(x))); y = Math.max(0, Math.min(im.h - 1, Math.round(y))); const i = (y * im.w + x) * 4; return [im.d[i], im.d[i + 1], im.d[i + 2]]; };
function textRender(im) {
  const cnt = new Map(); for (let i = 0; i < im.d.length; i += 4) { const k = im.d[i] + ',' + im.d[i + 1] + ',' + im.d[i + 2]; cnt.set(k, (cnt.get(k) || 0) + 1); }
  const bg = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
  let ink = bg, best = 1; for (let i = 0; i < im.d.length; i += 4) { const p = [im.d[i], im.d[i + 1], im.d[i + 2]]; const r = CR(p, bg); if (r > best) { best = r; ink = p; } }
  return { bgPx: bg, inkPx: ink, inkRatio: best };
}
async function textProbe(d, frame, sel, save) {
  const els = await frame.$$(sel); const res = [];
  const vh = d.page.viewportSize().height;
  for (const [i, h] of els.entries()) {
    const info = await h.evaluate(e => { let n = e, bg; while (n && (bg = getComputedStyle(n).backgroundColor) && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) n = n.parentElement; const cs = getComputedStyle(e); return { text: e.textContent.trim(), color: cs.color, fs: cs.fontSize, fw: cs.fontWeight, bgDecl: bg || null, bgFrom: n ? (n.id || String(n.className) || n.tagName) : null }; });
    const bb = await h.boundingBox();
    if (!bb || bb.width < 2 || bb.y < 2 || bb.y + bb.height > vh - 2) { res.push({ ...info, visible: false }); continue; }
    const clip = { x: Math.max(0, bb.x - 3), y: bb.y - 2, width: bb.width + 6, height: bb.height + 4 };
    const buf = await d.page.screenshot({ clip, scale: 'css', animations: 'disabled', caret: 'hide' });
    if (save && !res.some(r => r.visible)) fs.writeFileSync(path.join(EV, save), buf);
    const r = textRender(await pixels(d.page, buf));
    res.push({ ...info, visible: true, computedVsBgPx: CR(P(info.color), r.bgPx), computedVsBgDecl: info.bgDecl ? CR(P(info.color), P(info.bgDecl)) : null, ...r });
  }
  return res;
}
const out = { note: 'Skeptic #1 re-measure; see script header. Text targets 4.5:1 (13.5 px bold and 11.5 px are not large text); arc 3:1.', runs: [] };
const L = await local({ variant: 'park', engine: 'webkit' });
try {
  for (const [theme, profile] of runs) {
    await L.reset('park');
    await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
    const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile, localStorage: { 'hub.theme': JSON.stringify(theme) } });
    const rec = { theme, profile };
    try {
      await d.goto('#home'); await sleep(2500);
      rec.shell = await d.page.evaluate(() => { const r = document.documentElement, cs = getComputedStyle(r); return { dataTheme: r.dataset.theme || null, scheme: r.dataset.scheme, accentInline: r.style.getPropertyValue('--accent'), accent: cs.getPropertyValue('--accent').trim(), surface: cs.getPropertyValue('--surface').trim(), bg: cs.getPropertyValue('--bg').trim(), people: (window.hub && hub.people ? hub.people() : []).map(p => ({ id: p.id, name: p.name, kind: p.kind, color: p.color })) }; });
      // Timer
      let f = await d.openApp('timer', { wait: '.dial' }); await sleep(1500);
      const tinfo = await f.evaluate(() => { const c = document.querySelector('.dial .ring .fg'), dial = document.getElementById('dial'), cs = getComputedStyle(document.documentElement); return { stroke: getComputedStyle(c).stroke, opacity: getComputedStyle(c).opacity, empty: dial.classList.contains('empty'), dialBg: getComputedStyle(dial).backgroundColor, surface: cs.getPropertyValue('--surface').trim(), scheme: document.documentElement.dataset.scheme, theme: document.documentElement.dataset.theme || null }; });
      const ring = await f.$('.dial .ring'); const rb = await ring.boundingBox();
      const buf = await d.page.screenshot({ clip: { x: rb.x, y: rb.y, width: rb.width, height: rb.height }, scale: 'css', animations: 'disabled', caret: 'hide' });
      if (profile === 'eli' || profile === 'dad') fs.writeFileSync(path.join(EV, `verify-raw-accent-foreground-in-dark-1-timer-${theme}-${profile}.png`), buf);
      const im = await pixels(d.page, buf); const s = im.w / 52, cx = im.w / 2, cy = im.h / 2;
      const ang = [0, 90, 180, 270].map(a => a * Math.PI / 180);
      const arcPx = ang.map(a => px(im, cx + Math.cos(a) * 22 * s, cy + Math.sin(a) * 22 * s));
      const inPx = ang.map(a => px(im, cx + Math.cos(a) * 17 * s, cy + Math.sin(a) * 17 * s));
      const outPx = ang.map(a => px(im, cx + Math.cos(a) * 25.4 * s, cy + Math.sin(a) * 25.4 * s));
      rec.timerArc = { ...tinfo, ringPx: Math.round(rb.width), arcPx, inPx, outPx, renderedIn: arcPx.map((p, i) => CR(p, inPx[i])), renderedOut: arcPx.map((p, i) => CR(p, outPx[i])), computedVsSurface: CR(P(tinfo.stroke), P(tinfo.surface)), computedVsIn: inPx.map(p => CR(P(tinfo.stroke), p)) };
      // Prayer Kitchen
      f = await d.openApp('prayer', { wait: '#moreBtn' }); await sleep(1500);
      await f.click('#moreBtn').catch(() => {}); await sleep(600); await f.click('[data-more="kitchen"]').catch(() => {}); await sleep(900);
      rec.kitchen = await textProbe(d, f, '#kitchen .k-cat', profile === 'eli' && theme !== 'hearth' ? `verify-raw-accent-foreground-in-dark-1-kcat-${theme}-eli.png` : null);
      // Park map, real Nearby rows
      f = await d.openApp('dollywood-live', { wait: '#near-list' }); await sleep(3000);
      rec.parkSetup = await f.evaluate(() => { try { const o = OFF.find(o => o.pos); setMe(o.pos[0] + 40, o.pos[1] + 40, 8, null, 'manual'); const sh = document.getElementById('lv-sheet'); sh.dataset.state = 'half'; renderNear(); return { ok: true, near: o.name, me: me && [Math.round(me.x), Math.round(me.y)], rows: document.querySelectorAll('#near-list .lv-item .d small').length, scheme: document.documentElement.dataset.scheme }; } catch (e) { return { ok: false, err: String(e) }; } });
      await sleep(1200);
      rec.parkWalk = await textProbe(d, f, '#near-list .lv-item .d small', profile !== 'christian' && theme !== 'hearth' ? `verify-raw-accent-foreground-in-dark-1-walk-${theme}-${profile}.png` : null);
      rec.parkSheet = await f.evaluate(() => { const sh = document.getElementById('lv-sheet'); return { bgImage: getComputedStyle(sh).backgroundImage.slice(0, 300), state: sh.dataset.state }; });
    } finally { await d.close(); }
    const vis = a => (a || []).filter(x => x.visible);
    const k = vis(rec.kitchen), w = vis(rec.parkWalk);
    rec.summary = {
      kitchen: { n: (rec.kitchen || []).length, visible: k.length, computed: [...new Set(k.map(x => x.computedVsBgPx))], rendered: [...new Set(k.map(x => +x.inkRatio.toFixed(2)))], fs: k[0] && k[0].fs, color: k[0] && k[0].color, bg: k[0] && k[0].bgDecl },
      walk: { n: (rec.parkWalk || []).length, visible: w.length, computed: [...new Set(w.map(x => x.computedVsBgPx))], rendered: w.map(x => +x.inkRatio.toFixed(2)), fs: w[0] && w[0].fs, color: w[0] && w[0].color, setup: rec.parkSetup },
      timer: { computedVsSurface: rec.timerArc.computedVsSurface, renderedIn: rec.timerArc.renderedIn, renderedOut: rec.timerArc.renderedOut, stroke: rec.timerArc.stroke, empty: rec.timerArc.empty },
    };
    out.runs.push(rec);
    console.log(theme, profile, rec.shell.dataTheme, rec.shell.scheme, rec.shell.accent, JSON.stringify(rec.summary));
  }
} finally { await L.close(); }
const tag = args.length ? '-' + args.join('_').replace(/:/g, '-') : '';
fs.writeFileSync(path.join(EV, `verify-raw-accent-foreground-in-dark-1${tag}.json`), JSON.stringify(out, null, 1));
console.log('wrote', `verify-raw-accent-foreground-in-dark-1${tag}.json`);
