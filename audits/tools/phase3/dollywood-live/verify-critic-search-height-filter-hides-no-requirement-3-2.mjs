// Skeptic #2 for critic-search-height-filter-hides-no-requirement-3: does the Search pane's "rider height: up to N"" select
// drop every listing with no height requirement, while the who-chips in the same pane treat no requirement as rideable?
// Fresh local instance, typical seed, demo clock, WebKit, Eli on iPhone PWA.
// Run: node "audits/tools/phase3/dollywood-live/verify-critic-search-height-filter-hides-no-requirement-3-2.mjs"
import { local, sleep, save, shot, openMap } from './_lib.mjs';
const P = 'verify-critic-search-height-filter-hides-no-requirement-3-2';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await d.goto('#home'); await sleep(1200);
  const f = await openMap(d, { settle: 1500 });
  await f.evaluate(() => document.getElementById('lv-search').click());
  await sleep(700);
  const probe = () => f.evaluate(() => {
    const rows = [...document.querySelectorAll('#tab-list .oi')];
    const shown = rows.map(e => OFFNUM[+e.dataset.n]).filter(Boolean);
    const names = ['Village Carousel', 'Treetop Tower', 'Imagination Playhouse', 'Amazing Flying Elephants'];
    return {
      hf: document.getElementById('hf').value,
      label: document.querySelector('#tab-list label') && document.querySelector('#tab-list label').textContent.replace(/\s+/g, ' ').slice(0, 40),
      counter: ([...document.querySelectorAll('#tab-list span')].find(s => /^\d+ of \d+$/.test(s.textContent.trim())) || {}).textContent || null,
      shown: shown.length, noRequirementShown: shown.filter(o => !o.height_in).length,
      maxReqShown: Math.max(0, ...shown.map(o => o.height_in || 0)),
      noReqAttractionsInData: OFF.filter(o => o.cat === 'attraction' && !o.height_in).length,
      namedShown: Object.fromEntries(names.map(n => [n, shown.some(o => o.name.includes(n))])),
      namedInData: Object.fromEntries(names.map(n => { const o = OFF.find(o => o.name.includes(n)); return [n, o ? (o.height_in || 0) : 'absent']; })),
      whoChipsInPane: [...document.querySelectorAll('#tab-list .lv-who-chips button')].map(b => b.textContent.trim()),
      norideRows: rows.filter(r => r.classList.contains('noride')).length,
      norideNoReq: rows.filter(r => r.classList.contains('noride') && !OFFNUM[+r.dataset.n].height_in).length,
    };
  });
  out.any = await probe();
  await f.selectOption('#hf', '42'); await sleep(500); out.upTo42 = await probe();
  await f.selectOption('#hf', '36'); await sleep(500); out.upTo36 = await probe();
  await shot(d, P + '-upto36-iphone.png');
  await f.selectOption('#hf', 'none'); await sleep(500); out.none = await probe();
  await f.selectOption('#hf', 'any'); await sleep(400);
  // Who-chip for Kiara (the youngest) in the same pane: does it keep no-requirement rides rideable?
  const kiara = await f.evaluate(() => { const b = [...document.querySelectorAll('#tab-list .lv-who-chips button')].find(b => /Kiara/.test(b.textContent)); if (b) { b.click(); return true } return false });
  await sleep(600);
  out.kiaraChipClicked = kiara;
  out.kiaraChip_any = await probe();
  out.kiaraHeight = await f.evaluate(() => { try { return hub.get('kid:kiara', { scope: 'family' }) } catch (e) { return String(e) } });
  // reset who so localStorage is not left pointing at a kid
  await f.evaluate(() => { const b = document.querySelector('#tab-list .lv-who-chips button[data-who=""]'); if (b) b.click(); });
} catch (e) { out.error = String(e && e.stack || e); }
finally { save(P + '.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
