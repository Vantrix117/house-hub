// Phase 2 / PWA — skeptic #1: does praying for / answering a request on the PRIVATE ("Mine") prayer list put its title
// on the family activity feed, and does that line reach other adults' Home and the kiosk TV board?
//   node "audits/tools/phase2/PWA/verify-private-prayer-titles-on-family-feed-1.mjs"
// Independent of feed-private.mjs: a fresh, uniquely-titled request is put in Eli's PERSON scope (cloned from his seeded p003
// row so the app renders it like any other), so any feed line carrying that title can only come from this run's taps.
// Steps: (1) feed before (must not hold the title); (2) Eli opens Prayer on the iPad, checks the list is "Mine", taps the
// check on the new request; (3) feed read with the device token only, and as the kiosk / Mae / Ezra; (4) Eli opens the
// request, "Mark answered", saves a note; (5) Mae's Home feed and the TV board (fresh contexts) are read for the title.
// Writes audits/evidence/p2/PWA/verify-private-prayer-1.json and two 1x PNGs.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const ID = 'pz901', TITLE = 'Audit-secret 7Q biopsy result';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { id: ID, title: TITLE };
const feedHas = rows => (rows || []).filter(a => (a.text || '').includes(TITLE)).map(a => ({ who: a.profile_id, app: a.app_id, text: a.text }));
try {
  // (0) plant the private request in Eli's person scope
  const p003 = (await L.apiAs('eli', '/api/data/prayer?scope=person')).body.items.find(i => i.key === 'prayer:p003');
  const v = { ...p003.value, id: ID, title: TITLE, for: '', phone: '', detail: '', updates: [], cadence: 'daily', days: [], status: 'active',
    lastPrayedAt: null, answeredAt: null, answerNote: null, prayedBy: {}, sharedFrom: null, updatedAt: new Date().toISOString() };
  out.plant = (await L.apiAs('eli', `/api/data/prayer/prayer:${ID}?scope=person`, { method: 'PUT', body: { value: v, updated_at: Date.now() } })).status;
  // (1) before
  out.before = feedHas((await L.apiAs(null, '/api/activity?limit=100')).body.activity);

  // (2) Eli taps the check on the private list
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  const f = await ipad.openApp('prayer', { wait: `.mark[data-pray="${ID}"]` }); await sleep(1000);
  out.appState = await f.evaluate(id => ({
    activeList: D.activeList,
    mineButtonPressed: document.querySelector('[data-list="personal"]')?.getAttribute('aria-pressed'),
    inPersonal: D.lists.personal.prayers.some(p => p.id === id), inShared: D.lists.shared.prayers.some(p => p.id === id),
    markPressedBefore: document.querySelector(`.mark[data-pray="${id}"]`)?.getAttribute('aria-pressed'),
  }), ID);
  await f.click(`.mark[data-pray="${ID}"]`);
  await sleep(2500);
  out.markPressedAfter = await f.getAttribute(`.mark[data-pray="${ID}"]`, 'aria-pressed');
  const person = (await L.apiAs('eli', '/api/data/prayer?scope=person')).body.items.map(i => i.key);
  const family = (await L.apiAs('eli', '/api/data/prayer?scope=family')).body.items.map(i => i.key);
  out.rowScope = { inElisPersonScope: person.includes('prayer:' + ID), inFamilyScope: family.includes('prayer:' + ID) };
  out.afterPray = {
    deviceTokenOnly: { status: null, lines: null },
    asKiosk: feedHas((await L.apiAs('tv', '/api/activity?limit=100')).body.activity),
    asMae: feedHas((await L.apiAs('christian', '/api/activity?limit=100')).body.activity),
    asEzra: feedHas((await L.apiAs('ezra', '/api/activity?limit=100')).body.activity),
  };
  const dev = await L.apiAs(null, '/api/activity?limit=100');
  out.afterPray.deviceTokenOnly = { status: dev.status, lines: feedHas(dev.body.activity) };
  // Mae's other data cannot read Eli's person row (sanity: the row really is private at the data layer)
  const maePerson = await L.apiAs('christian', '/api/data/prayer?scope=person');
  out.maeCanReadRow = (maePerson.body.items || []).some(i => i.key === 'prayer:' + ID);

  // (4) Mark answered through the UI
  await f.click(`.body[data-open="${ID}"]`); await sleep(600);
  await f.click(`[data-answer="${ID}"]`); await sleep(300);
  await f.fill('#askIn', 'Benign.'); await f.click('#askSave'); await sleep(2500);
  out.afterAnswer = feedHas((await L.apiAs(null, '/api/activity?limit=100')).body.activity);

  // (5) Mae's Home (her own paired phone) and the TV board, opened fresh after the taps
  const ph = await L.newDevice({ name: 'Mae phone', profiles: ['christian'] });
  const mae = await L.device({ device: 'iphone-pwa', profile: 'christian', as: ph });
  await mae.goto('#home'); await mae.page.waitForSelector('#feed .fline', { timeout: 15000 }); await sleep(800);
  out.maeHomeFeedShows = await mae.page.evaluate(t => [...document.querySelectorAll('#feed .ftxt')].map(e => e.textContent).filter(x => x.includes(t)), TITLE);
  const tv = await L.device({ device: 'tv', profile: 'tv' });
  await tv.goto(''); await tv.page.waitForSelector('#tv-feed li', { timeout: 15000 }); await sleep(1500);
  out.tvBoardShows = await tv.page.evaluate(t => [...document.querySelectorAll('#tv-feed li')].map(e => e.innerText.replace(/\s+/g, ' ')).filter(x => x.includes(t)), TITLE);
  await tv.page.screenshot({ path: path.join(OUT, 'verify-private-prayer-1-tv-board.png'), animations: 'disabled', scale: 'css' });
  await mae.page.evaluate(() => document.querySelector('#feed')?.scrollIntoView({ block: 'start' }));
  await mae.page.screenshot({ path: path.join(OUT, 'verify-private-prayer-1-mae-home.png'), animations: 'disabled', scale: 'css' });
  out.logs = { ipad: ipad.logs.filter(l => /error/i.test(l)).slice(0, 5) };
  console.log(JSON.stringify(out, null, 1));
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-private-prayer-1.json'), JSON.stringify(out, null, 1));
  await L.close();
}
