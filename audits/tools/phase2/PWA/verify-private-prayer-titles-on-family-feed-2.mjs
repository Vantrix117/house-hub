// Phase 2 / PWA — skeptic #2 for "private-prayer-titles-on-family-feed".
//   node "audits/tools/phase2/PWA/verify-private-prayer-titles-on-family-feed-2.mjs"
// Independent re-run on a fresh local instance (typical household, demo clock). Steps:
//   A. Eli opens Prayer on the Kitchen iPad, confirms the list switch is on "Mine" (personal), taps the first
//      request not yet prayed today. Reads GET /api/activity as: the device token only, Ezra (kid), the TV (kiosk),
//      Mom (adult). Checks the request row is in Eli's person scope only and that Mom cannot read it through /api/data.
//   B. Eli opens another private request's sheet → Mark answered → types a note → Mark answered. Same feed check.
//   C. The TV board (kiosk profile, 1920×1080) and Mom's Home (iPad) render the feed; do they show the private title?
// Writes audits/evidence/p2/PWA/verify-private-feed-2-run.json and two PNGs.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'demo' });
const feed = async who => (await L.apiAs(who, '/api/activity?limit=100')).body.activity.map(a => ({ who: a.profile_id, text: a.text }));
const count = (rows, s) => rows.filter(r => r.text === s).length;
try {
  const before = await feed(null);

  // ── A. pray for a private request ──
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '.mark' }); await sleep(1500);
  out.A = await f.evaluate(() => ({
    activeList: D.activeList,
    mineSwitchPressed: document.querySelector('#listSwitch [data-list="personal"]').getAttribute('aria-pressed'),
    familySwitchPressed: document.querySelector('#listSwitch [data-list="shared"]').getAttribute('aria-pressed'),
  }));
  const tapped = await f.evaluate(() => {
    const b = [...document.querySelectorAll('.mark[data-pray]')].find(x => x.getAttribute('aria-pressed') === 'false');
    if (!b) return null;
    const title = b.closest('li').querySelector('.title').firstChild.textContent;
    b.click();
    return { id: b.dataset.pray, title };
  });
  out.A.tapped = tapped;
  await sleep(2500);
  const line = 'Prayed for ' + tapped.title;
  const eliPerson = (await L.apiAs('eli', '/api/data/prayer?scope=person')).body.items;
  const fam = (await L.apiAs('eli', '/api/data/prayer?scope=family')).body.items;
  const momPerson = (await L.apiAs('mom', '/api/data/prayer?scope=person')).body.items;
  out.A.row = {
    inElisPersonScope: eliPerson.some(i => i.key === 'prayer:' + tapped.id && i.value && i.value.title === tapped.title),
    anyFamilyRowWithTitle: fam.some(i => i.value && i.value.title === tapped.title),
    momCanReadViaDataApi: momPerson.some(i => i.value && i.value.title === tapped.title),
  };
  const afterA = { device: await feed(null), ezra: await feed('ezra'), tv: await feed('tv'), mom: await feed('mom') };
  out.A.feedLineBefore = count(before, line);
  out.A.feedLineAfter = Object.fromEntries(Object.entries(afterA).map(([k, v]) => [k, v.filter(r => r.text === line)]));

  // ── B. answer another private request ──
  const target = await f.evaluate(id => {
    const b = [...document.querySelectorAll('#s-today .body[data-open]')].find(x => x.dataset.open !== id);
    return b ? { id: b.dataset.open, title: b.querySelector('.title').firstChild.textContent } : null;
  }, tapped.id);
  out.B = { target, activeList: await f.evaluate(() => D.activeList) };
  await f.click(`#s-today .body[data-open="${target.id}"]`); await sleep(600);
  await f.click(`[data-answer="${target.id}"]`); await sleep(300);
  await f.fill('#askIn', 'Test note');
  await f.click('#askSave'); await sleep(2500);
  const ansLine = 'Answered: ' + target.title;
  const afterB = { device: await feed(null), tv: await feed('tv'), ezra: await feed('ezra') };
  out.B.feedLineBefore = count(before, ansLine);
  out.B.feedLineAfter = Object.fromEntries(Object.entries(afterB).map(([k, v]) => [k, v.filter(r => r.text === ansLine)]));
  const eliPerson2 = (await L.apiAs('eli', '/api/data/prayer?scope=person')).body.items;
  out.B.rowStatus = (eliPerson2.find(i => i.key === 'prayer:' + target.id) || {}).value?.status;

  // ── C. what the TV board and Mom's Home show ──
  const tv = await L.device({ device: 'tv', profile: 'tv' });
  await tv.goto('#home'); await sleep(4000);
  out.C = { tvFeed: await tv.page.evaluate(() => [...document.querySelectorAll('.tv-feed li')].map(li => li.innerText.replace(/\s+/g, ' ').trim())) };
  out.C.tvShowsPrayed = out.C.tvFeed.some(t => t.includes(line));
  out.C.tvShowsAnswered = out.C.tvFeed.some(t => t.includes(ansLine));
  await tv.shot(path.join(OUT, 'verify-private-feed-2-tv-light.png'));
  const mom = await L.device({ device: 'ipad-portrait', profile: 'mom' });
  await mom.goto('#home'); await sleep(4000);
  const momFeed = await mom.page.evaluate(() => (document.querySelector('#feed') || {}).innerText || '');
  out.C.momHomeShowsPrayed = momFeed.includes(line);
  out.C.momHomeShowsAnswered = momFeed.includes(ansLine);
  await mom.page.evaluate(() => { const e = document.querySelector('#feed'); if (e) e.scrollIntoView({ block: 'start' }); });
  await sleep(400);
  await mom.shot(path.join(OUT, 'verify-private-feed-2-mom-home-ipad-portrait-light.png'));
  out.logs = [...d.logs, ...tv.logs, ...mom.logs].filter(l => /error/i.test(l)).slice(0, 10);
  console.log(JSON.stringify(out, null, 1));
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-private-feed-2-run.json'), JSON.stringify(out, null, 1));
  await L.close();
}
