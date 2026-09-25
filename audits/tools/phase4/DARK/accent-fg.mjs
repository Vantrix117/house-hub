// Phase 4 DARK: the profile colour used raw as a foreground (text or stroke) in dark palettes.
// hub.js sets --accent inline from the profile colour (apps/hub.js:80) and no theme adjusts it; rules that paint
// text or strokes with var(--accent)/var(--tint) therefore keep a light-palette hue on a near-black surface.
// Checked live as three profiles in Midnight (light OS) and Hearth (control):
//   - shell Home ring arc  (.ds .ring .fg { stroke: var(--tint) }, apps/design.css:528)
//   - Timer dial arc        (.dial .ring .fg { stroke: var(--tint) }, --tint: var(--accent), apps/timer.html:22,28)
//   - Prayer Kitchen view category label (#kitchen .k-cat { color: var(--accent) }, apps/prayer.html:359)
//   - park map list walk time (.lv-item .d small { color: var(--accent) }, template.html:440 -> apps/dollywood-live.html),
//     probed with a synthetic element carrying the same classes (the rule is class-only)
// Ratios are computed colour against the resolved background the element sits on (--surface for cards/sheets,
// --bg for the kitchen page), both solid in these places; the rig's rendered figures are cited alongside.
//   node audits/tools/phase4/DARK/accent-fg.mjs  -> audits/evidence/p4/DARK/accent-fg.json
import fs from 'node:fs'; import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const Lm = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const CR = (a, b) => { const x = Lm(a), y = Lm(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const P = s => { s = String(s).trim(); if (s.startsWith('#')) return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const m = s.match(/[\d.]+/g); return m && m.slice(0, 3).map(Number); };
const out = [];
const L = await local({ variant: 'park', engine: 'webkit' });
try {
  for (const [theme, profile] of [['midnight','eli'],['midnight','dad'],['midnight','christian'],['forest','eli'],['forest','dad'],['hearth','eli'],['hearth','dad']]) {
    await L.reset('park');
    if (theme !== 'hearth') await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
    const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile, localStorage: theme === 'hearth' ? null : { 'hub.theme': JSON.stringify(theme) } });
    const rec = { theme, profile };
    try {
      await d.goto('#home'); await sleep(2500);
      rec.homeRing = await d.page.evaluate(() => { const c = document.querySelector('.ring .fg'); if (!c) return null; const rs = getComputedStyle(document.documentElement); return { stroke: getComputedStyle(c).stroke, surface: rs.getPropertyValue('--surface').trim(), accent: rs.getPropertyValue('--accent').trim() }; });
      let f = await d.openApp('timer', { wait: '.dial' }); await sleep(1200);
      rec.timerArc = await f.evaluate(() => { const c = document.querySelector('.dial .ring .fg'); const rs = getComputedStyle(document.documentElement); return c && { stroke: getComputedStyle(c).stroke, surface: rs.getPropertyValue('--surface').trim() }; });
      f = await d.openApp('prayer', { wait: '#moreBtn' }); await sleep(1500);
      await f.click('#moreBtn').catch(() => {}); await sleep(500); await f.click('[data-more="kitchen"]').catch(() => {}); await sleep(700);
      rec.kitchenCat = await f.evaluate(() => { const e = document.querySelector('#kitchen .k-cat'); if (!e) return null; let n = e, bg = 'rgba(0, 0, 0, 0)'; while (n && (bg = getComputedStyle(n).backgroundColor) && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) n = n.parentElement; return { color: getComputedStyle(e).color, bg, bgFrom: n && (n.id || n.tagName), text: e.textContent, fs: getComputedStyle(e).fontSize }; });
      f = await d.openApp('dollywood-live', { wait: 'body' }); await sleep(2500);
      rec.parkWalk = await f.evaluate(() => { const b = document.createElement('button'); b.className = 'lv-item'; b.innerHTML = '<span class="d">3<small>1 min walk</small></span>'; b.style.cssText = 'position:fixed;left:-9999px'; document.body.append(b); const s = b.querySelector('small'); const r = { color: getComputedStyle(s).color, fs: getComputedStyle(s).fontSize, surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(), scheme: document.documentElement.dataset.scheme }; b.remove(); return r; });
    } finally { await d.close(); }
    const ratio = (fg, bg) => fg && bg ? CR(P(fg), P(bg)) : null;
    rec.ratios = { homeRing: rec.homeRing && ratio(rec.homeRing.stroke, rec.homeRing.surface), timerArc: rec.timerArc && ratio(rec.timerArc.stroke, rec.timerArc.surface), kitchenCat: rec.kitchenCat && ratio(rec.kitchenCat.color, rec.kitchenCat.bg), parkWalk: rec.parkWalk && ratio(rec.parkWalk.color, rec.parkWalk.surface) };
    out.push(rec);
    console.log(theme.padEnd(9), profile.padEnd(10), JSON.stringify(rec.ratios), 'kitchen', rec.kitchenCat && rec.kitchenCat.color, 'on', rec.kitchenCat && rec.kitchenCat.bg, rec.kitchenCat && rec.kitchenCat.fs);
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/DARK/accent-fg.json'), JSON.stringify({ note: 'See header of audits/tools/phase4/DARK/accent-fg.mjs. Targets: graphics 3:1, text 4.5:1 (k-cat 13.5 px bold and walk time 11.5 px are not large text).', out }, null, 1));
