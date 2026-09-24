// PROF skeptic #2 for "switch-leaves-private-caches": after an ONLINE Me → Switch on the shared iPad, does the previous
// adult's private person-scope data stay in localStorage, can the next person (a kid) SEE any of it in the UI, is the
// old session dead, and what does the retained cache buy when the adult signs back in (the intent/trade-off lens)?
// Local rig only (typical seed, real clock, WebKit).
//
//   node "audits/tools/phase2/PROF/verify-switch-leaves-private-caches-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const log = (k, v) => console.log(k.padEnd(62), typeof v === 'string' ? v : JSON.stringify(v));
const result = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const eliToken = L.S.info.sessions.eli;
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false }); const { page } = d;
  await d.goto('#home'); await page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 });

  // 1. Eli opens Prayer (his private list lands in the iPad's cache), then returns Home
  await page.click('.tab[data-tab="apps"]'); await page.click('#grid .tile[data-id="prayer"]');
  await page.waitForFunction(() => { try { const c = JSON.parse(localStorage.getItem('hub.cache.prayer.person.eli')); return c && c.since > 0; } catch { return false; } }, null, { timeout: 20000 });
  await sleep(1500); await page.click('#pill-home'); await sleep(300);
  const privateTitles = await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('hub.cache.prayer.person.eli'));
    return Object.entries(c.items).filter(([k, i]) => k.startsWith('prayer:') && i.v && i.v.title).map(([, i]) => i.v.title);
  });
  log('1. Eli private prayer rows cached after opening Prayer', privateTitles.length);

  // 2. Me → Switch → Ezra (online)
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#switch');
  await page.click('#switch'); await page.waitForSelector('#profiles .pcard[data-id="ezra"]');
  const sessionAfterSwitch = await page.evaluate(() => localStorage.getItem('hub.session'));
  log('2a. hub.session in localStorage at the picker', sessionAfterSwitch);
  const oldTok = await L.apiAs(null, '/api/data/prayer?scope=person', { profileToken: eliToken });
  log('2b. Eli\'s old profile token after Switch → GET /api/data/prayer', `${oldTok.status} ${JSON.stringify(oldTok.body).slice(0, 80)}`);
  await page.click('#profiles .pcard[data-id="ezra"]'); await page.waitForFunction(() => hub.profile && hub.profile.id === 'ezra'); await sleep(1500);
  const left = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => /\.person\.eli$/.test(k));
    const pr = JSON.parse(localStorage.getItem('hub.cache.prayer.person.eli') || '{"items":{}}');
    const rows = Object.entries(pr.items).filter(([k, i]) => k.startsWith('prayer:') && i.v && i.v.title).map(([, i]) => i.v.title);
    return { keys, rows: rows.length, example: rows.find(t => /minivan/i.test(t)) || rows[0] };
  });
  log('2c. signed in as Ezra; Eli person-scope keys still present', left.keys);
  log('2d. Eli private prayer rows still in localStorage', `${left.rows} (e.g. "${left.example}")`);
  result.afterSwitch = { sessionAfterSwitch, oldTokenStatus: oldTok.status, ...left };

  // 3. Does any UI Ezra can reach show Eli's private rows? Shell Home + Prayer as Ezra.
  const homeText = await page.evaluate(() => document.body.innerText);
  const f = await d.openApp('prayer'); await sleep(4000);
  const prayerText = await f.evaluate(() => document.body.innerText);
  const prayerScopes = await f.evaluate(() => ({ profile: hub.profile.id, personRows: hub.list('prayer:', { scope: 'person' }).length, familyRows: hub.list('prayer:', { scope: 'family' }).length }));
  const familyTitles = await f.evaluate(() => hub.list('prayer:', { scope: 'family' }).map(r => r.value && r.value.title).filter(Boolean));
  const visible = privateTitles.filter(t => homeText.includes(t) || prayerText.includes(t));
  const alsoFamily = visible.filter(t => familyTitles.includes(t));      // Eli shared these to the family list: meant to be seen
  const leaked = visible.filter(t => !familyTitles.includes(t));
  log('3a. Ezra\'s Prayer: hub.list person/family rows', prayerScopes);
  log('3b. Eli private titles on Ezra\'s screens that are ALSO family rows', alsoFamily);
  log('3c. Eli private-only titles visible in Ezra\'s Home or Prayer', `${leaked.length}${leaked.length ? ' ' + JSON.stringify(leaked.slice(0, 3)) : ''}`);
  await d.shot(path.join(OUT, 'verify2-switch-caches-ezra-prayer-ipad.png'));
  result.ezraUi = { prayerScopes, visibleButSharedToFamily: alsoFamily, leakedPrivateOnlyTitles: leaked };

  // 4. Intent lens: Eli signs back in with /api/data delayed 9 s — does Prayer paint his list from the retained cache
  //    (instant) instead of the no-cache path (hub.ready waits up to 6 s, then draws an empty list)?
  await page.evaluate(async () => { await hub.signOut(); });
  const delay = async route => { if (/\/api\/data\b/.test(route.request().url())) await sleep(9000); await route.continue().catch(() => {}); };
  await d.ctx.route(u => u.href.includes('/api/data'), delay);
  const tok2 = (await L.newDevice({ name: 'unused', profiles: ['eli'] })); // fresh Eli session token for the same person
  const me = await (await fetch(L.api + '/api/me', { headers: { 'X-Device-Token': tok2.device.token, 'X-Profile-Token': tok2.sessions.eli } })).json();
  await page.evaluate(({ dev, s }) => { localStorage.setItem('hub.device', JSON.stringify(dev)); localStorage.setItem('hub.session', JSON.stringify(s)); }, { dev: tok2.device, s: { token: tok2.sessions.eli, profile: me.profile } });
  const t0 = Date.now();
  await page.evaluate(() => { history.replaceState(null, '', location.pathname + '#prayer'); location.reload(); }).catch(() => {});
  let f2 = null;
  for (let i = 0; i < 100 && !f2; i++) { await sleep(100); f2 = d.frame('prayer'); }
  if (!f2) throw new Error('prayer frame did not load after re-sign-in');
  await f2.waitForFunction(() => window.hub && hub.profile && hub.profile.id === 'eli', null, { timeout: 10000 });
  let firstPaintMs = null;
  for (let i = 0; i < 40; i++) { const txt = await f2.evaluate(() => document.body.innerText).catch(() => ''); if (privateTitles.some(t => txt.includes(t))) { firstPaintMs = Date.now() - t0; break; } await sleep(100); }
  const pulledYet = await f2.evaluate(() => hub.sync.lastPull);
  log('4a. Eli back in, /api/data delayed 9 s: private list painted after (ms)', firstPaintMs == null ? 'not within 4 s' : `${firstPaintMs} (first pull done yet: ${pulledYet > 0})`);
  result.reSignIn = { firstPaintMs, pulledBeforePaint: pulledYet > 0 };
  await d.ctx.unroute(u => u.href.includes('/api/data'));

  fs.writeFileSync(path.join(OUT, 'verify-switch-leaves-private-caches-2.json'), JSON.stringify(result, null, 2));
  log('evidence', 'audits/evidence/p2/PROF/verify-switch-leaves-private-caches-2.json');
  await d.close();
} finally { await L.close(); }
