// Phase 6, batch 0c — queued writes survive a Switch and every other hand-over (P2-PROF-02, P2-SYNC-07/P2-PROF-01,
// P3-TALLY-05, P2-SEC-03, P2-PROF-15, P2-PWA-06/-13/-14, P2-SYNC-06, P2-SYNC-04, UX-PROF-a6). One shared iPad, WebKit,
// real clock, taps through the shipped UI where a finger would do it; hub.set only for the rows an app would write.
//
//   A  Eli offline: a Tally tap, a family reminder, a person row, a feed line. Tally closed, Me → Switch (still offline)
//      → back online → the display (TV) signs in. Every row and the line reach the server under Eli, with his own
//      session; the TV never sends or empties them; Eli's old token is then refused; his private caches are gone.
//   B  201 reminders queued offline reach the server in two requests; a row the server refuses is dropped alone, with
//      a message.
//   C  after Switch the next person's shell keeps polling; theme follows the person; Home is the landing tab.
//   D  two hub.activity() calls at once post each line once.
//
//   node "audits/tools/phase6/0c/switch-flush.mjs"      exit 0 = every expectation held
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p6/0c'); fs.mkdirSync(OUT, { recursive: true });
const NAME = 'switch-flush';
const R = { checks: [] };
const check = (name, ok, got) => { R.checks.push({ name, ok: !!ok, got }); console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(78), JSON.stringify(got)); };
const shot = async (d, tag) => { const f = path.join(OUT, `${NAME}-${tag}.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const shellReady = (page, pid) => page.waitForFunction(p => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === p, pid, { timeout: 20000 });
const keys = (page, re) => page.evaluate(src => Object.keys(localStorage).filter(k => new RegExp(src).test(k)).sort(), re);

try {
  const nd = await L.newDevice({ name: 'Switch-check iPad', profiles: ['eli', 'ezra', 'tv'] });
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, as: nd }); const { page } = d;
  const requests = [];
  page.on('request', r => { if (r.url().includes('/api/')) requests.push({ t: Date.now(), m: r.method(), u: r.url().replace(L.api, ''), tok: r.headers()['x-profile-token'] || '' }); });
  await d.goto(''); await shellReady(page, 'eli');
  await page.waitForFunction(() => hub.isLoaded('reminders', 'family') && hub.isLoaded('f260', 'person'), null, { timeout: 20000 });
  const eliTok = await page.evaluate(() => hub.session.token);

  // ── A ──
  const tally = await d.openApp('tally');
  await tally.waitForFunction(() => window.hub && hub.isLoaded(), null, { timeout: 20000 });
  const before = await tally.evaluate(() => hub.get('count', { default: 0 }));
  await d.setOffline(true);
  await tally.waitForFunction(() => !document.getElementById('plus').disabled, null, { timeout: 10000 }); await tally.click('#plus');
  await sleep(300);
  const tallyAfter = await tally.evaluate(() => hub.get('count', { default: 0 }));
  await page.click('#pill-home'); await sleep(400);                                  // Tally closes (offline)
  await page.evaluate(() => {
    hub.set('item:sw0c', { id: 'sw0c', text: 'Switch-check reminder', by: 'eli', createdAt: Date.now() }, { app: 'reminders', scope: 'family' });
    hub.set('sw0c.note', { note: 'person row made offline' }, { app: 'f260', scope: 'person' });
    hub.activity('Switch-check line (offline)');
  });
  await sleep(300);
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#switch');
  await page.evaluate(() => hub.setTheme('forest')); await sleep(200);
  await page.click('#switch'); await page.waitForSelector('#profiles .pcard[data-id="tv"]', { timeout: 20000 });
  const pickerTheme = await page.evaluate(() => document.documentElement.dataset.theme || 'hearth');
  check('A picker after Switch: the device look, not Eli\'s Forest', pickerTheme !== 'forest', pickerTheme);
  const eliCaches = await keys(page, '^hub\\.cache\\.[^.]+\\.person\\.eli$');
  check('A Switch: Eli\'s person-scope caches are off the device', eliCaches.length === 0, eliCaches);
  const eliQueues = await keys(page, '^hub\\.queue\\..*\\.eli$');
  check('A Switch offline: Eli\'s queues stay, under his id', eliQueues.length >= 2, eliQueues);
  const t0 = Date.now();
  await d.setOffline(false);
  await page.click('#profiles .pcard[data-id="tv"]'); await shellReady(page, 'tv');
  await sleep(4000);
  const srvRem = await L.apiAs('eli', '/api/data/reminders?scope=family&key=item:sw0c');
  check('A the family reminder reached the server (not dropped by the TV)', srvRem.body.item && srvRem.body.item.value && srvRem.body.item.value.text === 'Switch-check reminder', srvRem.body.item);
  const srvNote = await L.apiAs(null, '/api/data/f260?scope=person&key=sw0c.note', { deviceToken: L.S.info.device.token, profileToken: L.S.info.sessions.eli });
  check('A Eli\'s person row reached the server', srvNote.body.item && srvNote.body.item.value && srvNote.body.item.value.note === 'person row made offline', srvNote.body.item);
  const srvTally = await L.apiAs('eli', '/api/data/tally?scope=person&key=count');
  check('A the Tally tap made before Tally closed reached the server', srvTally.body.item && srvTally.body.item.value === tallyAfter && tallyAfter === before + 1, { before, tallyAfter, server: srvTally.body.item && srvTally.body.item.value });
  const theme = await L.apiAs('eli', '/api/data/hub?scope=person&key=theme');
  check('A Eli\'s theme choice (made just before Switch) reached the server', theme.body.item && theme.body.item.value === 'forest', theme.body.item && theme.body.item.value);
  const batches = requests.filter(r => r.t >= t0 && /\/batch/.test(r.u));
  check('A every batch after the Switch went with Eli\'s token, none with the TV\'s', batches.length > 0 && batches.every(r => r.tok === eliTok), batches.map(r => r.u.split('?')[0] + (r.tok === eliTok ? ' eli' : ' OTHER')));
  const feed = await L.apiAs('eli', '/api/activity?limit=20');
  const line = (feed.body.activity || []).find(a => a.text === 'Switch-check line (offline)');
  check('A the offline feed line posted once, under Eli', line && line.profile_id === 'eli' && (feed.body.activity || []).filter(a => a.text === 'Switch-check line (offline)').length === 1, line && { by: line.profile_id });
  const old = await L.apiAs(null, '/api/me', { deviceToken: nd.device.token, profileToken: eliTok });
  check('A Eli\'s old session is ended on the server', old.status === 401, old.status);
  const left = await keys(page, '\\.eli$');
  check('A nothing of Eli\'s left queued on the device', !left.some(k => /^hub\.(queue|aqueue)\./.test(k)), left);
  const tvTheme = await page.evaluate(() => document.documentElement.dataset.theme || 'hearth');
  check('A the TV does not wear Eli\'s theme', tvTheme !== 'forest', tvTheme);
  R.shotA = await shot(d, 'A-tv-after-switch');

  // ── C: the TV keeps polling after an in-page switch ──
  const gets0 = requests.filter(r => r.m === 'GET' && /\/api\/data\//.test(r.u)).length;
  await sleep(35000);
  const gets1 = requests.filter(r => r.m === 'GET' && /\/api\/data\//.test(r.u)).length;
  check('C the TV still polls after the switch (GETs in 35 s)', gets1 - gets0 >= 3, gets1 - gets0);
  await page.click('#kiosk-switch'); await page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 20000 });
  await page.click('#profiles .pcard[data-id="ezra"]'); await shellReady(page, 'ezra');
  // from Me, Switch, and the next person (Ezra again: a kid signs in on tap) starts on Home, not on the Me tab
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#switch'); await page.click('#switch');
  await page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 20000 });
  await page.click('#profiles .pcard[data-id="ezra"]'); await shellReady(page, 'ezra');
  await sleep(500);
  const landing = await page.evaluate(() => document.documentElement.dataset.tab);
  check('C Ezra lands on Home', landing === 'home', landing);
  R.shotC = await shot(d, 'C-ezra-home');
  await d.close();

  // ── B: more than 200 rows, and a refused row ──
  const b = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false }); const bp = b.page;
  const bReq = [];
  bp.on('response', r => { if (/\/batch/.test(r.url())) bReq.push(r.status()); });
  await b.goto(''); await shellReady(bp, 'mom');
  await bp.waitForFunction(() => hub.isLoaded('reminders', 'family'), null, { timeout: 20000 });
  await b.setOffline(true);
  await bp.evaluate(() => { for (let i = 0; i < 201; i++) hub.set('item:b0c-' + i, { id: 'b0c-' + i, text: 'B0c reminder ' + i, by: 'christian', createdAt: Date.now() }, { app: 'reminders', scope: 'family' }); });
  await b.setOffline(false);
  await bp.waitForFunction(() => hub.sync.pending === 0, null, { timeout: 30000 });
  const srv = await L.apiAs('mom', '/api/data/reminders?scope=family');
  const n = (srv.body.items || []).filter(it => /^item:b0c-/.test(it.key) && it.value).length;
  check('B 201 offline rows: all on the server', n === 201, n);
  check('B 201 offline rows: sent in requests of at most 200 (two, both 200 OK)', bReq.length >= 2 && bReq.every(s => s === 200), bReq);
  // a row the server refuses (a key it rejects, as an older client could have queued) next to a good one: only the bad
  // one is dropped, and the person is told
  bReq.length = 0;
  await b.setOffline(true);
  await bp.evaluate(() => { hub.set('item:b0c-good', { id: 'b0c-good', text: 'fine' }, { app: 'reminders', scope: 'family' }); const k = 'hub.queue.reminders.family.mom'; const q = JSON.parse(localStorage.getItem(k) || '{}'); q['bad key!'] = { value: { text: 'refused' }, updated_at: Date.now() }; localStorage.setItem(k, JSON.stringify(q)); });
  await b.setOffline(false);
  await bp.waitForFunction(() => hub.sync.pending === 0, null, { timeout: 30000 });
  const toast = await bp.evaluate(() => { const t = document.getElementById('hub-toast'); return t && t.textContent; });
  const good = await L.apiAs('mom', '/api/data/reminders?scope=family&key=item:b0c-good');
  const queueLeft = await bp.evaluate(() => localStorage.getItem('hub.queue.reminders.family.mom'));
  check('B a refused row: the good row next to it is saved', good.body.item && good.body.item.value && good.body.item.value.text === 'fine', good.body.item && good.body.item.value);
  check('B a refused row: it alone is dropped, with a message', !queueLeft && /could not be saved/.test(toast || ''), { queueLeft, toast });
  await b.close();

  // ── D: overlapping activity calls ──
  const k = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false }); const kp = k.page;
  await k.goto(''); await shellReady(kp, 'ezra');
  await kp.evaluate(async () => { await Promise.all([hub.activity('D0c line one'), hub.activity('D0c line two'), hub.activity('D0c line three')]); });
  await sleep(1500);
  const f2 = await L.apiAs('eli', '/api/activity?limit=30');
  const counts = ['D0c line one', 'D0c line two', 'D0c line three'].map(t => (f2.body.activity || []).filter(a => a.text === t).length);
  check('D three overlapping activity calls post three lines, once each', counts.every(c => c === 1), counts);
  await k.close();
} catch (e) { R.error = String(e && e.stack || e); console.error(e); check('script ran to the end', false, R.error.split('\n')[0]); }
finally {
  fs.writeFileSync(path.join(OUT, `${NAME}.json`), JSON.stringify(R, null, 2));
  await L.close();
  const failed = R.checks.filter(c => !c.ok).length;
  console.log(`\n${R.checks.length - failed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}
