// Skeptic #1 for "critic-search-height-filter-hides-no-requirement-3": does the park map's Search "rider height: up to N"
// select drop every listing with no height requirement (apps/dollywood-live.html:1007 listItems)?
// Fresh local instance: typical seed, demo clock, WebKit, Eli on iPhone PWA. Uses the real UI: tap Search, pick the
// option with a real selectOption (fires change -> renderList), count rendered #tab-list .oi rows.
// Also: which rows a kid who-chip at the same height would mark rideable (fits(), :1541), and what "no requirement" shows.
// Run: node "audits/tools/phase3/dollywood-live/verify-critic-search-height-filter-hides-no-requirement-3-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, EV, openMap } from './_lib.mjs';
const P = 'verify-critic-search-height-filter-hides-no-requirement-3-1';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await d.goto('#home'); await sleep(1200);
  const f = await openMap(d, { settle: 1500 });
  await f.click('#lv-search'); await sleep(700);
  out.hfVisible = await f.isVisible('#hf');
  out.hfOptions = await f.$$eval('#hf option', os => os.map(o => o.value + '=' + o.textContent));
  const count = (n) => f.evaluate((n) => {
    const shown = [...document.querySelectorAll('#tab-list .oi')].map(e => OFFNUM[+e.dataset.n]).filter(Boolean);
    const set = new Set(shown);
    const counter = ([...document.querySelectorAll('#tab-list span')].find(s => /^\d+ of \d+$/.test(s.textContent.trim())) || {}).textContent || null;
    const r = { shown: shown.length, counter, withReq: shown.filter(o => o.height_in).length, noReq: shown.filter(o => !o.height_in).length };
    if (n) {
      const kid = { height_in: n };
      const fitsAll = OFF.filter(o => fits(o, kid));
      r.fitsWouldKeep = fitsAll.length;
      r.fitsNoReq = fitsAll.filter(o => !o.height_in).length;
      r.hiddenButRideable = fitsAll.filter(o => !set.has(o)).length;
      r.hiddenNoReqAttractions = OFF.filter(o => o.cat === 'attraction' && !o.height_in && !set.has(o)).map(o => o.name);
    }
    return r;
  }, n);
  out.any = await count(null);
  out.totalNoReqAll = await f.evaluate(() => OFF.filter(o => !o.height_in).length);
  out.totalNoReqAttractions = await f.evaluate(() => OFF.filter(o => o.cat === 'attraction' && !o.height_in).length);
  out.cats = await f.evaluate(() => OFF.reduce((a, o) => (a[o.cat] = (a[o.cat] || 0) + 1, a), {}));
  for (const v of ['none', '36', '42', '48']) {
    await f.selectOption('#hf', v); await sleep(500);
    out['hf_' + v] = await count(v === 'none' ? null : +v);
    out['hf_' + v].selectValueAfter = await f.$eval('#hf', s => s.value);
    if (v === '36') await d.page.screenshot({ path: path.join(EV, P + '-36-iphone.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
    if (v === '42') out.hf_42.rowsSample = await f.$$eval('#tab-list .oi', es => es.slice(0, 20).map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  }
  const names = ['Village Carousel', 'Dollywood Express', "Lil' Pilots", 'Imagination Playhouse', 'Flying Elephants', 'Treetop Tower'];
  out.namedInData = await f.evaluate((names) => names.map(n => { const o = OFF.find(o => o.name.includes(n)); return o ? { name: o.name, cat: o.cat, height_in: o.height_in || null } : { name: n, found: false }; }), names);
  await f.selectOption('#hf', 'any'); await sleep(300);
  await f.fill('#q', 'zipline'); await sleep(700);
  out.noMatch = await f.evaluate(() => document.getElementById('tab-list').textContent.replace(/\s+/g, ' ').trim().slice(0, 200));
} catch (e) { out.error = String(e && e.stack || e); }
finally {
  fs.writeFileSync(path.join(EV, P + '.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2)); await L.close();
}
