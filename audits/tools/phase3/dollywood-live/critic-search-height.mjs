// Completeness critic: the park map's Search pane carries the build guide's "rider height" select (renderList, :1012) and
// its filter (listItems, :1007): "up to N"" keeps only listings WITH a height requirement <= N (o.height_in&&o.height_in<=+hf),
// so every ride and show a small child can ride because it has no minimum disappears. Build-guide lead 01-leads.md:322,
// same code in the park map. Also records a no-match search.
// Typical seed, demo clock, WebKit, Eli on iPhone PWA. Local instance only.
// Run: node "audits/tools/phase3/dollywood-live/critic-search-height.mjs"
import { local, sleep, save, shot, openMap } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await d.goto('#home'); await sleep(1200);
  const f = await openMap(d, { settle: 1500 });
  await f.evaluate(() => document.querySelector('.lv-tabs button[data-t="search"]').click());
  await sleep(600);
  const count = () => f.evaluate(() => {
    const shown = [...document.querySelectorAll('#tab-list .oi')].map(e => OFFNUM[+e.dataset.n]).filter(Boolean);
    return { shown: shown.length, withRequirement: shown.filter(o => o.height_in).length, noRequirement: shown.filter(o => !o.height_in).length,
      counter: ([...document.querySelectorAll('#tab-list span')].find(s => /\d+ of \d+/.test(s.textContent)) || {}).textContent || null,
      attractionsNoReqInData: OFF.filter(o => o.cat === 'attraction' && !o.height_in).length,
      examplesHidden: OFF.filter(o => o.cat === 'attraction' && !o.height_in && !shown.includes(o)).slice(0, 5).map(o => o.name) };
  });
  out.A_any = await count();
  await f.selectOption('#hf', '42'); await sleep(500);
  out.B_upTo42 = await count();
  await f.selectOption('#hf', '36'); await sleep(500);
  out.C_upTo36 = await count();
  await shot(d, 'critic-search-height-36-iphone.png');
  await f.selectOption('#hf', 'any'); await sleep(300);
  await f.fill('#q', 'zipline'); await f.dispatchEvent('#q', 'input'); await sleep(600);
  out.D_noMatch = await f.evaluate(() => document.getElementById('tab-list').textContent.replace(/\s+/g, ' ').trim().slice(0, 200));
} catch (e) { out.error = String(e && e.stack || e); }
finally { save('critic-search-height.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
