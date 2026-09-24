// Skeptic #2 for finding "offline-activity-misattributed" (Phase 2, PWA topic).
// Independent re-run on a fresh local instance with the REAL clock (so server timestamps are meaningful).
//   A  Eli adds a Home reminder offline on the Kitchen iPad → back online → reload the shell (fresh hub.ready) → wait
//      past the 30 s pull → is the feed line on the server? → Me → Switch → Grandma Jo (PIN-less guest) adds a reminder
//      → who is Eli's line posted under, and when?
//   B  Same, but the next person on the iPad is a kid (Kiara) who taps "I prayed" in the Prayer app.
// Run: node "audits/tools/phase2/PWA/verify-offline-activity-misattributed-2.mjs"
// Evidence: audits/evidence/p2/PWA/verify-offline-activity-misattributed-2.json (+ one feed PNG).
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const log = {};
const say = (k, v) => { log[k] = v; console.log('\n== ' + k + '\n' + JSON.stringify(v, null, 1)); };
const iso = t => new Date(t).toISOString();

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Skeptic phone', profiles: ['mom'] });
  const feed = async () => (await L.apiAs('mom', '/api/activity?limit=100', { deviceToken: ph.device.token, profileToken: ph.sessions.mom })).body.activity;
  const reminders = async () => (await L.apiAs('mom', '/api/data/reminders?scope=family', { deviceToken: ph.device.token, profileToken: ph.sessions.mom })).body.items || [];
  const lsQueue = P => P.evaluate(() => JSON.parse(localStorage.getItem('hub.activityQueue') || '[]'));

  async function queueOffline(d, text) {
    const P = d.page;
    await d.goto('#home'); await P.waitForSelector('#remtext', { state: 'visible', timeout: 15000 }); await sleep(1500);
    await d.setOffline(true);
    await P.fill('#remtext', text); await P.press('#remtext', 'Enter'); await sleep(800);
    const q = await lsQueue(P);
    const who = (await d.hub()).profile;
    await d.setOffline(false);
    const onlineAt = Date.now();
    await sleep(4000);
    await d.goto('#home'); await P.waitForSelector('#remtext', { state: 'visible', timeout: 15000 });   // fresh page + hub.ready()
    await P.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
    while (Date.now() - onlineAt < 40000) await sleep(1000);
    const line = 'Added a reminder: ' + text;
    const fs1 = await feed();
    return {
      signedInAs: who, queuedOffline: q.map(x => ({ text: x.text, at: iso(x.at) })),
      secondsOnlineIncludingReload: Math.round((Date.now() - onlineAt) / 1000),
      reminderItemOnServer: (await reminders()).some(i => i.value && i.value.text === text),
      feedLineOnServer: fs1.some(a => a.text === line),
      stillQueued: (await lsQueue(P)).map(x => x.text),
      pulledSince: (await d.hub()).sync,
      queuedAt: q.length ? q[q.length - 1].at : null, line,
    };
  }
  async function switchTo(d, id) {
    const P = d.page;
    await d.goto('#me'); await P.waitForSelector('#switch', { timeout: 15000 }); await P.click('#switch');
    await P.waitForSelector(`.pcard[data-id="${id}"]`, { timeout: 15000 }); await sleep(600);
    await P.click(`.pcard[data-id="${id}"]`);
    await P.waitForFunction(pid => window.hub && hub.profile && hub.profile.id === pid, id, { timeout: 15000 });
    await sleep(1000);
    return (await d.hub()).profile;
  }

  // ── A: guest next ──────────────────────────────────────────────────────────
  const ipadA = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const A = await queueOffline(ipadA, 'Skeptic2 offline A: call the plumber');
  say('A1 Eli queued a line offline, then 40 s online incl. a page reload', { ...A, queuedAt: undefined });
  say('A2 switched to', await switchTo(ipadA, 'guest-grandmajo'));
  const tJo = Date.now();
  await ipadA.page.click('.tab[data-tab="home"]').catch(() => {});
  await ipadA.page.waitForSelector('#remtext', { state: 'visible', timeout: 15000 });
  await ipadA.page.fill('#remtext', 'Skeptic2: Grandma Jo line'); await ipadA.page.press('#remtext', 'Enter');
  await sleep(2500);
  const fA = (await feed()).filter(a => /Skeptic2/.test(a.text));
  say('A3 server feed after Grandma Jo adds a reminder', fA.map(a => ({ who: a.profile_id, name: a.name, text: a.text, created: iso(a.created_at) })));
  const rowA = fA.find(a => a.text === A.line);
  say('A4 verdict', rowA ? { postedAs: rowA.profile_id, shouldBe: A.signedInAs, queuedAt: iso(A.queuedAt), serverCreatedAt: iso(rowA.created_at), lagSeconds: Math.round((rowA.created_at - A.queuedAt) / 1000), joActedAt: iso(tJo), queueNow: await lsQueue(ipadA.page) } : 'line not posted');
  await ipadA.page.click('#feed-refresh').catch(() => {}); await sleep(2000);
  const shot = path.join(OUT, 'verify-offline-activity-misattributed-2-feed-ipad-portrait-light.png');
  await ipadA.page.locator('#feed').first().screenshot({ path: shot, scale: 'css', animations: 'disabled' }).catch(e => console.log('shot failed', e.message));
  log.shot = path.relative(ROOT, shot).replace(/\\/g, '/');

  // ── B: kid next ────────────────────────────────────────────────────────────
  // A's Switch signed the rig device's shared Eli session out (POST /api/logout), so B runs on its own paired device.
  const devB = await L.newDevice({ name: 'Skeptic iPad B', profiles: ['eli'] });
  const ipadB = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false, as: devB });
  const B = await queueOffline(ipadB, 'Skeptic2 offline B: pick up the prescription');
  say('B1 Eli queued a line offline, then 40 s online incl. a page reload', { ...B, queuedAt: undefined });
  say('B2 switched to', await switchTo(ipadB, 'kiara'));
  const f = await ipadB.openApp('prayer', { wait: '[data-kpray]' });
  await sleep(1500);
  const tapped = await f.evaluate(() => { const b = [...document.querySelectorAll('[data-kpray]')].find(b => b.getAttribute('aria-pressed') !== 'true'); if (!b) return null; const l = b.getAttribute('aria-label'); b.click(); return l; });
  await sleep(3000);
  // (clock:'real' seeds some of today's story lines later than the real now, so filter by text/author, not by position)
  const fB = (await feed()).filter(a => a.text === B.line || (a.profile_id === 'kiara' && a.id > 0 && /^Prayed for/.test(a.text) && Math.abs(a.created_at - Date.now()) < 120000));
  say('B3 Kiara taps a Prayed card: ' + tapped, fB.map(a => ({ who: a.profile_id, name: a.name, text: a.text, created: iso(a.created_at) })));
  const rowB = fB.find(a => a.text === B.line);
  say('B4 verdict', rowB ? { postedAs: rowB.profile_id, shouldBe: B.signedInAs, queuedAt: iso(B.queuedAt), serverCreatedAt: iso(rowB.created_at), lagSeconds: Math.round((rowB.created_at - B.queuedAt) / 1000) } : 'line not posted');
  log.pageErrors = [...ipadA.logs, ...ipadB.logs].filter(l => /pageerror/.test(l));
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-offline-activity-misattributed-2.json'), JSON.stringify(log, null, 1));
  console.log('\nwrote audits/evidence/p2/PWA/verify-offline-activity-misattributed-2.json');
  await L.close();
}
