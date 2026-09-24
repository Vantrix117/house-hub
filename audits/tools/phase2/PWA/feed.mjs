// Phase 2 / PWA — the family activity feed ("Around the house") at runtime, on the local rig.
//   node "audits/tools/phase2/PWA/feed.mjs"
// The browser runs on the real clock (fixedTime:false) so hub.js's 30 s pull runs as it does on a device; the Worker keeps
// the rig's demo clock so every new line sorts above the seeded ones (lines are matched by text, never by position).
//   F1 freshness: a line posted from Mom's phone never reaches the open iPad Home on the 30 s pull; only Refresh shows it.
//   F2 your own line: adding a reminder on Home does not add "Added a reminder: …" to the feed you are looking at.
//   F3 double post: two Larder "used up" taps while the first POST /api/activity is still in flight (400 ms, a phone
//      network) post the first line twice.
//   F4 offline queue: Eli adds a reminder offline; back online the line is not sent (35 s); Me → Switch → Grandma Jo adds
//      a reminder → Eli's queued line is posted under Grandma Jo's name, stamped with the later time.
//   F5 4xx: a line queued offline is dropped for good when its POST returns 401 (session revoked meanwhile).
//   F6 Show more / grouping counts on the iPad Home.
// Evidence: audits/evidence/p2/PWA/feed-*.png (1× css) and feed-run.json.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const log = {};
const say = (k, v) => { log[k] = v; console.log('\n== ' + k + '\n' + (typeof v === 'string' ? v : JSON.stringify(v, null, 1))); };
const shotEl = async (page, sel, name) => { const f = path.join(OUT, name); await page.locator(sel).first().screenshot({ path: f, scale: 'css', animations: 'disabled' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };

const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const ph = await L.newDevice({ name: "Mom's phone (rig)", profiles: ['mom', 'eli'] });
  const serverFeed = async (n = 100) => (await L.apiAs('eli', `/api/activity?limit=${n}`, { deviceToken: ph.device.token, profileToken: ph.sessions.mom })).body.activity.map(a => ({ who: a.profile_id, text: a.text, at: new Date(a.created_at).toISOString() }));
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const P = ipad.page;
  const feedTexts = () => P.$$eval('#feed .ftxt', els => els.map(e => e.textContent));

  // ── F6 first paint counts ────────────────────────────────────────────────────
  await ipad.goto('#home');
  await P.waitForSelector('#feed .ftxt', { timeout: 15000 });
  await sleep(1500);
  const counts = await P.evaluate(() => ({ lines: document.querySelectorAll('#feed .fline').length, groups: document.querySelectorAll('#feed > li:not(.feed-more)').length, showMore: !!document.querySelector('#feed-more'), cached: (JSON.parse(localStorage.getItem('hub.feed') || '[]')).length }));
  say('F6 iPad Home feed on open', counts);

  // ── F1 freshness ──────────────────────────────────────────────────────────────
  const t0 = Date.now();
  const lastPull0 = (await ipad.hub()).sync.lastPull;
  const posted = await L.apiAs('mom', '/api/activity', { method: 'POST', body: { app_id: 'leftovers', text: 'Logged audit soup (Small) in the fridge' }, deviceToken: ph.device.token, profileToken: ph.sessions.mom });
  say('F1 Mom posts a line from her phone', { status: posted.status, id: posted.body.id });
  await sleep(40000);
  const lastPull1 = (await ipad.hub()).sync.lastPull;
  const seen40 = (await feedTexts()).includes('Logged audit soup (Small) in the fridge');
  say('F1 iPad after 40 s (the 30 s pull ran?)', { pulledSinceOpen: lastPull1 > lastPull0, secondsWaited: Math.round((Date.now() - t0) / 1000), momLineOnIpad: seen40, onServer: (await serverFeed()).some(a => a.text === 'Logged audit soup (Small) in the fridge') });
  const beforeShot = await shotEl(P, '#feed', 'feed-f1-after-40s-ipad-portrait-light.png');
  await P.click('#feed-refresh');
  await sleep(2000);
  const seenRefresh = (await feedTexts()).includes('Logged audit soup (Small) in the fridge');
  const afterShot = await shotEl(P, '#feed', 'feed-f1-after-refresh-ipad-portrait-light.png');
  say('F1 after tapping Refresh', { momLineOnIpad: seenRefresh, shots: [beforeShot, afterShot] });

  // ── F2 your own line ────────────────────────────────────────────────────────
  await P.fill('#remtext', 'Audit: buy stamps');
  await P.press('#remtext', 'Enter');
  await sleep(2500);
  say('F2 Eli adds a reminder on Home', { reminderShown: (await P.$$eval('#remlist .rem-text', e => e.map(x => x.textContent))).includes('Audit: buy stamps'), feedHasOwnLine: (await feedTexts()).includes('Added a reminder: Audit: buy stamps'), serverHasLine: (await serverFeed()).some(a => a.text === 'Added a reminder: Audit: buy stamps') });

  // ── F3 double post with a 400 ms network ─────────────────────────────────────
  const f = await ipad.openApp('leftovers', { wait: '.item button.done' });
  await sleep(1500);
  await ipad.ctx.route(u => u.href.startsWith(L.api + '/api/activity'), async r => { if (r.request().method() === 'POST') await sleep(400); r.continue(); });
  const names = await f.$$eval('.item', els => els.slice(0, 2).map(e => e.querySelector('.nm').textContent));
  // two real button taps 150 ms apart (dispatched in the page: Playwright's own click waits for the list to settle)
  await f.evaluate(() => { document.querySelector('.item button.done').click(); setTimeout(() => document.querySelector('.item button.done').click(), 150); });
  await sleep(3000);
  await ipad.ctx.unroute(u => u.href.startsWith(L.api + '/api/activity'));
  const sf = await serverFeed();
  say('F3 two "used up" taps 150 ms apart, 400 ms network', { tapped: names, finishedLines: Object.fromEntries(names.map(n => ['Finished the ' + n, sf.filter(a => a.text === 'Finished the ' + n).length])) });

  // ── F4 offline queue: not sent on reconnect, then posted under the next person ───────
  await ipad.goto('#home'); await P.waitForSelector('#remtext');
  await ipad.setOffline(true);
  await P.fill('#remtext', 'Audit offline: call the plumber');
  await P.press('#remtext', 'Enter');
  await sleep(800);
  const queued = await P.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]'));
  say('F4 Eli adds a reminder while offline', { activityQueue: queued.map(q => ({ text: q.text, at: new Date(q.at).toISOString() })) });
  await ipad.setOffline(false);
  await sleep(35000);
  const afterOnline = await serverFeed();
  const reminderRow = await L.apiAs('eli', '/api/data/reminders?scope=family', { deviceToken: ph.device.token, profileToken: ph.sessions.eli });
  say('F4 35 s after coming back online', {
    reminderItemFlushed: (reminderRow.body.items || []).some(i => i.value && i.value.text === 'Audit offline: call the plumber'),
    activityLineOnServer: afterOnline.some(a => a.text === 'Added a reminder: Audit offline: call the plumber'),
    stillQueued: (await P.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]'))).map(q => q.text),
  });
  // Me → Switch → Grandma Jo (a guest without a PIN signs in on tap) → she adds a reminder
  await ipad.goto('#me'); await P.waitForSelector('#switch'); await P.click('#switch');
  await P.waitForSelector('.pcard[data-id="guest-grandmajo"]'); await sleep(500);
  await P.click('.pcard[data-id="guest-grandmajo"]');
  await P.waitForSelector('.tab[data-tab="home"]', { state: 'visible', timeout: 15000 }); await P.click('.tab[data-tab="home"]'); await P.waitForSelector('#remtext', { state: 'visible', timeout: 15000 });
  await P.fill('#remtext', 'Audit: guest line');
  await P.press('#remtext', 'Enter');
  await sleep(2500);
  const sf4 = (await L.apiAs('eli', '/api/activity?limit=100', { deviceToken: ph.device.token, profileToken: ph.sessions.mom })).body.activity.filter(a => /^Added a reminder: Audit/.test(a.text));
  say('F4 after Grandma Jo adds a reminder on the same iPad', sf4.map(a => ({ who: a.profile_id, name: a.name, text: a.text, created: new Date(a.created_at).toISOString() })));
  await P.click('#feed-refresh'); await sleep(2000);
  log.f4shot = await shotEl(P, '#feed', 'feed-f4-misattributed-ipad-portrait-light.png');
  console.log('shot', log.f4shot);

  // ── F5 a queued line is dropped on a 401 ─────────────────────────────────────
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  await phone.goto('#home'); await phone.page.waitForSelector('#remtext');
  await phone.setOffline(true);
  await phone.page.evaluate(() => { hub.activity('Audit 401 line 1'); hub.activity('Audit 401 line 2'); });
  await sleep(500);
  const q5 = await phone.page.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]').map(q => q.text));
  const revoke = await L.apiAs('eli', '/api/logout', { method: 'POST', body: {}, deviceToken: ph.device.token, profileToken: ph.sessions.eli });
  await phone.setOffline(false);
  await phone.page.evaluate(() => hub.activity('Audit 401 line 3')).catch(e => String(e));
  await sleep(2500);
  const q5b = await phone.page.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]').map(q => q.text));
  const sf5 = await serverFeed();
  say('F5 queued offline, session revoked, back online', { queuedBefore: q5, logoutStatus: revoke.status, queueAfter: q5b, onServer: sf5.filter(a => /Audit 401/.test(a.text)).map(a => a.text), gateShown: await phone.page.evaluate(() => !document.querySelector('#gate').hidden) });
} finally {
  fs.writeFileSync(path.join(OUT, 'feed-run.json'), JSON.stringify(log, null, 1));
  console.log('\nwrote audits/evidence/p2/PWA/feed-run.json');
  await L.close();
}
