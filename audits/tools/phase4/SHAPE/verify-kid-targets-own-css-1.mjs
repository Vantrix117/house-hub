// Skeptic 1 for "kid-targets-own-css": sweep every visible, hit-testable interactive element a kid (Ezra) can reach,
// per area and device, and report its box. Independent of verify.mjs / analyze.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/SHAPE');
const out = { runs: [] };
const sweep = () => {
  const q = 'button, a[href], input, select, textarea, [role=button], [role=tab], [role=switch], summary, label[for], [onclick], [tabindex]:not([tabindex="-1"])';
  const seen = new Set(), rows = [];
  const tap = getComputedStyle(document.documentElement).getPropertyValue('--tap').trim();
  for (const el of document.querySelectorAll(q)) {
    const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || s.pointerEvents === 'none') continue;
    let hid = false; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || (e.hidden) || e.getAttribute('aria-hidden') === 'true' || e.inert || parseFloat(cs.opacity) === 0) { hid = true; break; } } if (hid) continue;
    const b = el.getBoundingClientRect(); if (b.width < 1 || b.height < 1 || b.bottom < 0 || b.right < 0 || b.top > innerHeight || b.left > innerWidth) continue;
    // hit-test the centre: skip things covered by something else (closed sheets, etc.)
    const cx = Math.min(innerWidth - 1, Math.max(0, b.left + b.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, b.top + b.height / 2));
    const hit = document.elementFromPoint(cx, cy); if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) continue;
    if (el.tagName === 'INPUT' && el.type === 'hidden') continue;
    const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '');
    const w = Math.round(b.width), h = Math.round(b.height);
    rows.push({ sel, w, h, txt: (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 30), mh: s.minHeight });
  }
  return { kind: document.documentElement.getAttribute('data-kind'), ds: document.body.classList.contains('ds'), tap, n: rows.length,
    under64: rows.filter(r => Math.min(r.w, r.h) < 64), under44: rows.filter(r => Math.min(r.w, r.h) < 44), all: rows };
};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const only = process.env.ONLY; const cases0 = [
    ['shell', 'ipad-landscape', '#home'], ['shell', 'ipad-portrait', '#home'], ['shell', 'desktop', '#home'], ['shell', 'iphone-pwa', '#home'],
    ['leftovers', 'ipad-portrait'], ['leftovers', 'iphone-pwa'],
    ['dollywood-live', 'ipad-portrait'], ['dollywood-live', 'iphone-pwa'],
    ['kidverse', 'ipad-portrait'], ['timer', 'ipad-portrait'], ['verses', 'ipad-portrait'], ['tally', 'ipad-portrait'], ['prayer', 'ipad-portrait'],
  ]; const cases = only ? cases0.filter(c => c[0] === only) : cases0;
  for (const [area, device, hash] of cases) {
    const d = await L.device({ device, mode: 'light', profile: 'ezra' });
    let fr;
    try {
      if (hash) { await d.goto(hash); await sleep(2500); fr = d.page.mainFrame(); }
      else { fr = await d.openApp(area); await sleep(area.startsWith('dollywood') ? 7000 : 3000); }
      const r = await fr.evaluate(sweep);
      const slim = { area, device, kind: r.kind, ds: r.ds, tap: r.tap, n: r.n, under64: r.under64.length, under44: r.under44.length,
        under64List: r.under64.map(x => `${x.sel} ${x.w}x${x.h} "${x.txt}"`), minSide: Math.min(...r.all.map(x => Math.min(x.w, x.h))) };
      out.runs.push(slim); console.log(JSON.stringify(slim));
      if (area === 'dollywood-live') for (const pane of ['#loc-near', '#lv-family']) {
        await fr.click(pane).catch(() => {}); await sleep(1500);
        const p = await fr.evaluate(sweep);
        const ps = { area, device, pane, under64: p.under64.length, under44: p.under44.length, under44List: p.under44.map(x => `${x.sel} ${x.w}x${x.h} "${x.txt}"`), under64List: p.under64.map(x => `${x.sel} ${x.w}x${x.h} "${x.txt}"`) };
        out.runs.push(ps); console.log(JSON.stringify(ps));
        // (map screenshots are >1 MB at 1x; the JSON carries the measurements)
      }
      if ((area === 'shell' && device === 'ipad-landscape') || (area === 'leftovers' && device === 'ipad-portrait'))
        await d.page.screenshot({ path: path.join(EV, `verify-kid-targets-own-css-1-${area}-${device}.png`), scale: 'css', animations: 'disabled' });
    } catch (e) { out.runs.push({ area, device, error: e.message }); console.log(area, device, 'ERR', e.message); }
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'verify-kid-targets-own-css-1.json'), JSON.stringify(out, null, 1));
console.log('wrote');
