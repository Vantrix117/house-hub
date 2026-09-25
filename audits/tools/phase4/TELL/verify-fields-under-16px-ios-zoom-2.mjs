// Skeptic 2 for TELL "fields-under-16px-ios-zoom". WebKit, iPhone PWA (430x932) and iPad portrait, light, typical seed,
// demo clock. For every area: every text-entry field (input minus checkbox/radio/range/file/button/submit/hidden,
// select, textarea) in the app document, rendered or not, with its computed font-size and whether it is rendered.
// Dollywood pair: also opens the Listings/Search pane so lazily built fields (#hf) exist. Kid mode: Larder as Ezra.
// Also focuses each rendered field and reads visualViewport.scale (the rig cannot emulate iOS focus zoom; recorded
// only to show that). Output: audits/evidence/p4/TELL/verify-fields-under-16px-ios-zoom-2.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p4/TELL/verify-fields-under-16px-ios-zoom-2.json');
const APPS = ['f260', 'leftovers', 'prayer', 'tally', 'timer', 'dollywood', 'dollywood-live', 'kidverse', 'verses'];
const PROBE = () => [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]), select, textarea')]
  .map(e => ({ sel: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.type && e.tagName === 'INPUT' ? '[' + e.type + ']' : ''), fs: parseFloat(getComputedStyle(e).fontSize), rendered: !!(e.offsetParent || e.getClientRects().length), inline: e.getAttribute('style') || '' }));
const out = { note: 'computed font-size of every field; iOS Safari zooms on focus of a field under 16 px', runs: {} };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const device of ['iphone-pwa', 'ipad-portrait']) {
    for (const area of ['shell', ...APPS, 'leftovers@ezra']) {
      const [app, who] = area.split('@'); const profile = who || (app === 'kidverse' ? 'ezra' : 'eli');
      const key = device + ':' + area; const R = {};
      try {
        const d = await L.device({ device, mode: 'light', profile });
        let doc;
        if (app === 'shell') {
          await d.goto('#home'); await sleep(1500); doc = d.page.mainFrame();
          R.home = await doc.evaluate(PROBE);
          await d.goto('#chat'); await sleep(1200); R.chat = await doc.evaluate(PROBE);
        } else {
          doc = await d.openApp(app);
          await doc.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 }).catch(() => {});
          await sleep(app.startsWith('dollywood') ? 4000 : 1500);
          R.initial = await doc.evaluate(PROBE);
          if (app.startsWith('dollywood')) {
            // open the listings/search surfaces so generated fields exist
            const clicked = await doc.evaluate(() => { const hit = []; for (const b of document.querySelectorAll('button,[role=tab]')) { const t = (b.textContent || '').trim(); if (/^(Listings|Search|Find)$/i.test(t) || b.id === 'lv-search') { b.click(); hit.push(t || b.id); } } return hit; }).catch(e => 'err ' + e.message);
            await sleep(1200); R.clicked = clicked; R.afterTabs = await doc.evaluate(PROBE);
          }
          // focus each rendered field; record visualViewport scale (rig limitation: never zooms)
          R.focusScale = await doc.evaluate(() => { const r = []; for (const e of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]), select, textarea')) { if (!e.getClientRects().length) continue; e.focus(); r.push([e.id, window.visualViewport ? visualViewport.scale : null, top.visualViewport ? top.visualViewport.scale : null]); e.blur(); } return r; }).catch(e => 'err ' + e.message);
        }
        await d.close();
      } catch (e) { R.error = String(e.message || e).split('\n')[0]; }
      const all = [...(R.home || []), ...(R.chat || []), ...(R.initial || []), ...(R.afterTabs || [])];
      const seen = new Map(); for (const f of all) seen.set(f.sel, f);
      R.under16 = [...seen.values()].filter(f => f.fs < 16).map(f => `${f.sel} ${f.fs}${f.rendered ? '' : ' (not rendered)'}`);
      R.total = seen.size;
      out.runs[key] = R;
      console.log(key, R.total, JSON.stringify(R.under16), R.error || '');
      fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    }
  }
} finally { await L.close(); }
