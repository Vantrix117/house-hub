// Skeptic #2 for SHAPE "kid-targets-own-css": enumerate every visible interactive element a kid (Ezra) can reach in
// Larder, park map, shell (4 devices) and the ds apps; record rendered size, whether .ds is on body, the resolved --tap,
// and compare with an adult (Mae) on the same screen so we see whether kid mode changes anything.
//   node audits/tools/phase4/SHAPE/verify-kid-targets-own-css-2.mjs → audits/evidence/p4/SHAPE/verify-kid-targets-own-css-2.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/SHAPE');
const out = { runs: [] };
const scan = () => {
  const vis = el => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.bottom > 0 && b.right > 0 && b.left < innerWidth; };
  const sel = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const els = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=switch], [role=tab], label.switch, .switch')].filter(vis);
  const seen = new Set(); const list = [];
  for (const el of els) {
    // for an input inside a label, measure the label (the real hit area)
    let t = el; if (el.tagName === 'INPUT' && el.closest('label') && (el.type === 'checkbox' || el.type === 'radio')) t = el.closest('label');
    if (seen.has(t)) continue; seen.add(t);
    const b = t.getBoundingClientRect();
    list.push({ sel: sel(t), text: (t.innerText || t.value || t.getAttribute('aria-label') || '').trim().slice(0, 24), w: Math.round(b.width), h: Math.round(b.height), minH: getComputedStyle(t).minHeight });
  }
  const tap = getComputedStyle(document.documentElement).getPropertyValue('--tap').trim();
  return { kind: document.documentElement.getAttribute('data-kind'), bodyDs: document.body.classList.contains('ds'), tap, n: list.length, under64: list.filter(x => Math.min(x.w, x.h) < 64).length, under44: list.filter(x => Math.min(x.w, x.h) < 44).length, list };
};
const L = await local({ variant: 'park', engine: 'webkit' });
try {
  const cases = [
    { area: 'leftovers', device: 'ipad-portrait' }, { area: 'leftovers', device: 'iphone-pwa' },
    { area: 'dollywood-live', device: 'ipad-portrait' }, { area: 'dollywood-live', device: 'iphone-pwa' },
    { area: 'shell', device: 'ipad-portrait', hash: '#home' }, { area: 'shell', device: 'ipad-landscape', hash: '#home' },
    { area: 'shell', device: 'desktop', hash: '#home' }, { area: 'shell', device: 'iphone-pwa', hash: '#home' },
    { area: 'kidverse', device: 'ipad-portrait' }, { area: 'tally', device: 'ipad-portrait' }, { area: 'timer', device: 'ipad-portrait' }, { area: 'verses', device: 'ipad-portrait' }, { area: 'prayer', device: 'ipad-portrait' },
  ];
  for (const c of cases) for (const profile of ['ezra', 'christian']) {
    const d = await L.device({ device: c.device, mode: 'light', profile });
    let fr; try {
      if (c.hash) { await d.goto(c.hash); await sleep(2500); fr = d.page.mainFrame(); } else { fr = await d.openApp(c.area); await sleep(c.area.startsWith('dollywood') ? 7000 : 2500); }
      const r = await fr.evaluate(scan);
      out.runs.push({ area: c.area, device: c.device, profile, ...r });
      console.log(c.area, c.device, profile, r.kind, 'ds', r.bodyDs, 'tap', r.tap, 'n', r.n, '<64', r.under64, '<44', r.under44);
      if (profile === 'ezra' && ['leftovers', 'dollywood-live'].includes(c.area) && c.device === 'ipad-portrait') await d.page.screenshot({ path: path.join(EV, `verify-kid-targets-own-css-2-${c.area}.png`), scale: 'css' });
      if (profile === 'ezra' && c.area === 'shell' && c.device === 'ipad-landscape') await d.page.screenshot({ path: path.join(EV, 'verify-kid-targets-own-css-2-shell-landscape.png'), scale: 'css', clip: { x: 0, y: 0, width: 260, height: 500 } });
    } catch (e) { out.runs.push({ area: c.area, device: c.device, profile, error: e.message }); console.log('ERR', c.area, c.device, profile, e.message); }
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'verify-kid-targets-own-css-2.json'), JSON.stringify(out, null, 1));
console.log('wrote');
