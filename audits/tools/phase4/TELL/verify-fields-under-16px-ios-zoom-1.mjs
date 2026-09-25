// TELL / verify-fields-under-16px-ios-zoom-1 (skeptic #1): re-measure every text-entry field's computed font-size on the
// iPhone (WebKit, iphone-pwa 430x932, touch, light, System theme) in every area, AND whether each field is actually
// reachable (rendered after opening the pane/tab that holds it), since iOS only zooms a field that can take focus.
//   node audits/tools/phase4/TELL/verify-fields-under-16px-ios-zoom-1.mjs
//   → audits/evidence/p4/TELL/verify-fields-under-16px-ios-zoom-1.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { AREAS, openArea, profileFor, deviceFor } from './areas.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p4/TELL/verify-fields-under-16px-ios-zoom-1.json');

const PROBE = () => [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]), select, textarea')]
  .map(e => ({ sel: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.type && e.tagName === 'INPUT' ? '[' + e.type + ']' : ''), fs: parseFloat(getComputedStyle(e).fontSize), rendered: e.getClientRects().length > 0 && (e.checkVisibility ? e.checkVisibility({ visibilityProperty: true }) : true), inlineFs: e.style.fontSize || null }));
const merge = (acc, list) => { for (const f of list) { const o = acc[f.sel] || (acc[f.sel] = { sel: f.sel, fs: f.fs, everRendered: false }); o.fs = f.fs; if (f.rendered) o.everRendered = true; } return acc; };
const clickIn = async (doc, sel) => { try { await doc.click(sel, { timeout: 3000 }); await sleep(500); return true; } catch (e) { return 'ERR ' + e.message.split('\n')[0].slice(0, 80); } };

const want = process.argv.slice(2).length ? process.argv.slice(2) : AREAS;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { areas: {} };
const out = { note: 'See header of audits/tools/phase4/TELL/verify-fields-under-16px-ios-zoom-1.mjs', engine: 'webkit', device: 'iphone-pwa', areas: prev.areas || {} };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const area of want) {
    const R = { steps: [] }; const acc = {};
    try {
      const d = await L.device({ device: deviceFor(area, 'iphone-pwa'), mode: 'light', profile: profileFor(area) });
      const { doc } = await openArea(d, area, { settle: 2000 });
      merge(acc, await doc.evaluate(PROBE));
      if (area === 'dollywood-live') {
        R.steps.push(['search tab', await clickIn(doc, '#lv-search')]); merge(acc, await doc.evaluate(PROBE));
        R.steps.push(['style tab', await clickIn(doc, '#lv-layers-tab')]); merge(acc, await doc.evaluate(PROBE));
        R.hiddenAncestors = await doc.evaluate(() => ['bmap', 'sc-plot', 'sc-in'].map(id => { const e = document.getElementById(id); if (!e) return [id, 'missing']; let a = e; const chain = []; while (a && a !== document.documentElement) { const s = getComputedStyle(a); if (s.display === 'none') chain.push(a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + (a.className && typeof a.className === 'string' ? '.' + a.className.split(' ')[0] : '')); a = a.parentElement; } return [id, chain]; }));
      }
      if (area === 'dollywood') {
        for (const t of ['list', 'layers', 'scale']) { R.steps.push(['tab ' + t, await clickIn(doc, `.tabs button[data-tab="${t}"]`)]); merge(acc, await doc.evaluate(PROBE)); }
        R.steps.push(['more (phone toolbar)', await clickIn(doc, '#more-btn')]); merge(acc, await doc.evaluate(PROBE));
        R.steps.push(['view menu', await clickIn(doc, '#view-btn')]); merge(acc, await doc.evaluate(PROBE));
      }
      if (area === 'f260') {
        R.steps.push(['restore', await doc.evaluate(() => { const b = document.getElementById('restoreBtn'); if (!b) return 'no #restoreBtn'; b.click(); return true; })]); await sleep(600); merge(acc, await doc.evaluate(PROBE));
      }
      if (area === 'shell') {
        await d.goto('#chat'); await sleep(1500); merge(acc, await d.page.evaluate(PROBE));
        await d.goto('#me'); await sleep(1500); R.steps.push(['guest-add', await clickIn(d.page, '#guest-add')]); merge(acc, await d.page.evaluate(PROBE));
      }
      R.fields = Object.values(acc);
      R.under16 = R.fields.filter(f => f.fs < 16).map(f => `${f.sel} ${f.fs}${f.everRendered ? '' : ' (never rendered)'}`);
      R.under16Reachable = R.fields.filter(f => f.fs < 16 && f.everRendered).map(f => `${f.sel} ${f.fs}`);
      R.viewport = await d.page.evaluate(() => document.querySelector('meta[name=viewport]')?.content);
      await d.close();
    } catch (e) { R.error = String(e.message || e).split('\n')[0]; }
    out.areas[area] = R;
    console.log(area, JSON.stringify({ under16: R.under16, reachable: R.under16Reachable, err: R.error, steps: R.steps, hid: R.hiddenAncestors }));
  }
} finally { await L.close(); }
out.totalUnder16 = Object.values(out.areas).reduce((n, r) => n + (r.under16 ? r.under16.length : 0), 0);
out.totalUnder16Reachable = Object.values(out.areas).reduce((n, r) => n + (r.under16Reachable ? r.under16Reachable.length : 0), 0);
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('total', out.totalUnder16, 'reachable', out.totalUnder16Reachable);
