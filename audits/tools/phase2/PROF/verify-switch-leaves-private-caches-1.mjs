// PROF skeptic #1 for "switch-leaves-private-caches": after Me → Switch on the shared iPad, does the previous person's
// private person-scope data stay readable in localStorage? Independent of switch-leftovers.mjs: Eli never opens Prayer
// (only Home, which syncs prayer/person itself, index.html:458), the switch is done through the UI, the page is then
// reloaded as Ezra, and the server is asked whether Ezra can read Eli's private list through the API (it should not).
// Local rig only (typical seed, real clock, WebKit).
//
//   node "audits/tools/phase2/PROF/verify-switch-leaves-private-caches-1.mjs"
import { local, sleep } from '../../lib/local.mjs';

const log = (k, v) => console.log(k.padEnd(60), typeof v === 'string' ? v : JSON.stringify(v));
const L = await local({ variant: 'typical', clock: 'real' });
try {
  // What the server says Eli's private prayer list holds, and whether Ezra can reach it through the API
  const eliServer = await L.apiAs('eli', '/api/data/prayer?scope=person');
  const eliRows = (eliServer.body.items || eliServer.body.rows || []).filter(r => r.value && r.value.title);
  log('server: Eli GET prayer person rows with a title', eliRows.length);
  const ezraServer = await L.apiAs('ezra', '/api/data/prayer?scope=person');
  const ezraRows = (ezraServer.body.items || ezraServer.body.rows || []).filter(r => r.value && r.value.title);
  log('server: Ezra GET prayer person (his own scope) rows', `${ezraServer.status} ${ezraRows.length}`);
  const ezraTries = await L.apiAs('ezra', '/api/data/prayer?scope=person&profile_id=eli&profile=eli');
  const ezraTriesRows = (ezraTries.body.items || ezraTries.body.rows || []).filter(r => r.value && r.value.title);
  log('server: Ezra asking for Eli\'s person rows via query params', `${ezraTries.status} ${ezraTriesRows.length} rows`);

  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false }); const { page } = d;
  await d.goto('#home');
  await page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'eli' && hub.sync.lastPull > 0, null, { timeout: 20000 });
  await sleep(1500);
  const before = await page.evaluate(() => Object.keys(localStorage).filter(k => /\.person\.eli$/.test(k)).sort());
  log('as Eli on Home only (Prayer never opened): Eli person keys', before);

  // Me → Switch → Ezra (kid, opens on tap), online
  const logoutSeen = [];
  page.on('request', r => { if (r.url().includes('/api/logout')) logoutSeen.push(r.method()); });
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#switch');
  await page.click('#switch'); await page.waitForSelector('#profiles .pcard[data-id="ezra"]');
  await page.click('#profiles .pcard[data-id="ezra"]');
  await page.waitForFunction(() => hub.profile && hub.profile.id === 'ezra', null, { timeout: 15000 });
  await sleep(2000);

  const probe = () => page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => /\.person\.eli$/.test(k)).sort();
    const pr = JSON.parse(localStorage.getItem('hub.cache.prayer.person.eli') || '{"items":{}}');
    const rows = Object.entries(pr.items).map(([k, i]) => [k, i.v]).filter(([, v]) => v && v.title);
    const f = JSON.parse(localStorage.getItem('hub.cache.f260.person.eli') || '{"items":{}}');
    return { who: hub.profile && hub.profile.id, keys, prayerRows: rows.length, sample: rows.slice(0, 2).map(([k, v]) => `${k}: ${v.title}`), f260Keys: Object.keys(f.items).slice(0, 12), sessionKey: localStorage.getItem('hub.session') ? JSON.parse(localStorage.getItem('hub.session')).profile.id : null };
  });
  const after = await probe();
  log('after Switch → Ezra: /api/logout requests seen', logoutSeen);
  log('after Switch → Ezra: signed-in profile', after.who + ' (hub.session is ' + after.sessionKey + ')');
  log('after Switch → Ezra: Eli person keys still in localStorage', after.keys);
  log('after Switch → Ezra: Eli private prayer rows readable', after.prayerRows);
  log('after Switch → Ezra: sample rows', after.sample);
  log('after Switch → Ezra: keys in Eli\'s f260 cache (first 12)', after.f260Keys);

  // Does anything clear it on a reload as Ezra?
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'ezra' && hub.sync.lastPull > 0, null, { timeout: 20000 });
  await sleep(1500);
  const afterReload = await probe();
  log('after reload as Ezra: Eli person keys', afterReload.keys);
  log('after reload as Ezra: Eli private prayer rows readable', afterReload.prayerRows);

  // Is any of it visible in Ezra's UI (not only via dev tools)? Search the shell + Prayer frame text for one title.
  const title = after.sample[0] ? after.sample[0].split(': ').slice(1).join(': ') : '';
  const shellHas = title ? await page.evaluate(t => document.body.innerText.includes(t), title) : null;
  let frameHas = null;
  try {
    const f = await d.openApp('prayer'); await sleep(3500);
    frameHas = title ? await f.evaluate(t => document.body.innerText.includes(t), title) : null;
  } catch (e) { frameHas = 'prayer not openable: ' + e.message; }
  log(`Ezra's UI shows "${title}"? shell / Prayer app`, `${shellHas} / ${frameHas}`);
  await d.close();
} finally { await L.close(); }
