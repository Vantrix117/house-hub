// Skeptic #1 for SYNC finding "switch-race-cross-profile-cache" — independent re-run, not reusing e6's code.
//   node "audits/tools/phase2/SYNC/verify-switch-race-cross-profile-cache-1.mjs"
// Claim: a person-scope pull in flight during Me → Switch is not cancelled by hub.reset() (apps/hub.js:370); when its response
// lands after the next person signed in, pullScope re-reads the cache under the NEW pid() (apps/hub.js:190-195, 291) and saves the
// OLD person's rows + `since` under the new person's key (apps/hub.js:297-301).
// Runs (each on a fresh local instance, real clock):
//   control  — same steps, no delay: the next person's cache must be clean (rules out a rig artefact).
//   timer    — Eli's GET /api/data/timer?scope=person response is held 4 s; Ezra (kid, opens on tap) signs in meanwhile.
//              Also: an Ezra-own timer row written before the race — does it ever reach Ezra's cache after `since` jumped?
//   prayer   — Eli's GET /api/data/prayer?scope=person response is held 4 s; Grandma Jo (PIN-less guest) signs in meanwhile.
//              Does her Prayer app then show Eli's private prayers, and does it survive a reload?
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
async function until(fn, ms = 10000) { const end = Date.now() + ms; while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch {} await sleep(100); } return null; }
async function visibility(page, hidden) {
  for (const f of page.frames()) await f.evaluate(h => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden).catch(() => {});
}
const cacheOf = (page, key) => page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, key);

async function run(mode) {
  const r = { mode };
  const L = await local({ variant: 'typical', clock: 'real' });
  try {
    const tok = L.S.info.sessions;                                   // the Kitchen iPad's session tokens by profile
    const who = t => Object.entries(tok).find(([, v]) => v === t)?.[0] || (t ? 'other(' + t.slice(0, 10) + ')' : 'none');
    const nextId = mode === 'prayer' ? 'guest-grandmajo' : 'ezra';
    const app = mode === 'prayer' ? 'prayer' : 'timer';

    // Ezra's own timer row, synced to the server BEFORE the race (so its synced_at < the slow response's `now`).
    // Eli's private prayers as the server holds them (read now: Me → Switch logs the iPad's Eli session out later).
    const eliRows = ((await L.apiAs('eli', '/api/data/prayer?scope=person')).body.items || []).filter(i => i.key.startsWith('prayer:') && i.value && i.value.title);
    r.ezraOwnPut = (await L.apiAs('ezra', '/api/data/timer/audit.ezra-own?scope=person', { method: 'PUT', body: { value: { note: 'Ezra own row' }, updated_at: Date.now() } })).status;

    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    const net = [];
    ipad.page.on('request', q => { const u = q.url(); if (u.includes('/api/')) net.push({ t: Date.now() - T0, m: q.method(), u: u.replace(/^https?:\/\/[^/]+/, ''), as: who(q.headers()['x-profile-token']) }); });
    await ipad.goto('#home');
    await until(() => ipad.page.evaluate(() => hub.sync.lastPull > 0), 15000);
    await ipad.page.click('.tab[data-tab="me"]'); await sleep(400);
    await visibility(ipad.page, true);                              // the iPad goes to sleep on the Me tab

    // Eli starts a 10-minute timer (another device) — Eli's person scope on the server.
    if (mode !== 'prayer') { const now = Date.now(); r.eliTimerPut = (await L.apiAs('eli', '/api/data/timer/timer.active?scope=person', { method: 'PUT', body: { value: { endAt: now + 600000, total: 600, startedAt: now }, updated_at: now } })).status; }
    await sleep(300);

    const held = { issuedAs: null, now: null, deliveredAt: null };
    const re = new RegExp(`/api/data/${app}\\?scope=person`);
    let first = true;
    await ipad.ctx.route(re, async route => {
      if (!(first && route.request().method() === 'GET')) return route.continue().catch(() => {});
      first = false;
      held.issuedAs = who(route.request().headers()['x-profile-token']);
      held.issuedAt = Date.now() - T0;
      const res = await route.fetch();                             // reaches the Worker now, with the token it was sent with
      const body = await res.text(); try { held.now = JSON.parse(body).now; held.keys = JSON.parse(body).items.map(i => i.key); } catch {}
      if (mode !== 'control') await sleep(4000);                   // a weak Wi-Fi moment on the way back
      await route.fulfill({ response: res, body }).catch(() => {});
      held.deliveredAt = Date.now() - T0;
    });

    await visibility(ipad.page, false);                             // wake → hub.pull()
    await until(() => held.issuedAs, 10000);
    log(`[${mode}] Eli's ${app} pull issued as ${held.issuedAs} at ${held.issuedAt} ms; server now=${held.now}; keys ${JSON.stringify(held.keys)}`);
    if (mode === 'control') await until(() => held.deliveredAt, 10000);   // control: let it land first, then switch

    await ipad.page.click('#switch');
    await ipad.page.waitForSelector(`.pcard[data-id="${nextId}"]`, { timeout: 10000 });
    await ipad.page.click(`.pcard[data-id="${nextId}"]`);
    await until(() => ipad.page.evaluate(id => hub.profile && hub.profile.id === id, nextId), 10000);
    r.signedInAt = Date.now() - T0;
    r.heldStillInFlightAtSignIn = held.deliveredAt == null;
    log(`[${mode}] ${nextId} signed in at ${r.signedInAt} ms; Eli's response still in flight: ${r.heldStillInFlightAtSignIn}`);
    await until(() => held.deliveredAt, 10000); await sleep(1500);
    r.held = held;

    const key = `hub.cache.${app}.person.${nextId}`;
    const c1 = await cacheOf(ipad.page, key);
    r.nextCacheAfterRace = c1 && { since: c1.since, keys: Object.keys(c1.items) };
    r.sinceEqualsElisResponseNow = !!c1 && c1.since === held.now;
    r.profileNow = await ipad.page.evaluate(() => hub.profile && hub.profile.id);
    log(`[${mode}] ${key} after the race: ${JSON.stringify(r.nextCacheAfterRace)}; since === Eli's response now: ${r.sinceEqualsElisResponseNow}`);

    if (mode !== 'prayer') {
      await ipad.page.click('.tab[data-tab="home"]'); await sleep(800);
      r.pill = await ipad.page.evaluate(() => ({ visible: !document.getElementById('timer-pill').hidden, time: document.getElementById('timer-pill-time').textContent, kind: document.documentElement.dataset.kind }));
      r.shot = rel(path.join(EVID, `verify-switch-race-cross-profile-cache-1-${mode}-ipad.png`));
      await ipad.page.screenshot({ path: path.join(ROOT, r.shot), scale: 'css', animations: 'disabled', caret: 'hide' });
      log(`[${mode}] timer pill on ${r.profileNow}'s Home: ${JSON.stringify(r.pill)}`);
      // a later pull as Ezra (what visibilitychange does): does it heal, and does Ezra's own older row ever arrive?
      await ipad.page.evaluate(() => hub.pull());
      const c2 = await cacheOf(ipad.page, key);
      r.nextCacheAfterLaterPull = c2 && { since: c2.since, items: Object.fromEntries(Object.entries(c2.items).map(([k, v]) => [k, v.v])) };
      r.ezraServerTimerRows = (await L.apiAs('ezra', '/api/data/timer?scope=person')).body.items.map(i => i.key);
      log(`[${mode}] after another pull as Ezra: cache ${JSON.stringify(r.nextCacheAfterLaterPull)}; Ezra's timer rows on the server ${JSON.stringify(r.ezraServerTimerRows)}`);
    } else {
      r.eliPrivatePrayerTitles = eliRows.map(i => i.value.title);
      r.guestServerPrayerRows = (await L.apiAs(null, '/api/data/prayer?scope=person', { profileToken: await ipad.page.evaluate(() => hub.session.token) })).body.items.map(i => i.key);
      r.eliPrayerKeysInGuestCache = (r.nextCacheAfterRace?.keys || []).filter(k => eliRows.some(e => e.key === k)).length;
      // reload the iPad straight into the Prayer app as Grandma Jo (fresh hub.js on both the shell and the app frame)
      const f = await ipad.openApp('prayer'); await sleep(3500);
      const text = await f.evaluate(() => document.body.innerText).catch(() => '');
      r.guestPrayerAppShowsEliTitles = r.eliPrivatePrayerTitles.filter(t => text.includes(t));
      r.profileAfterReload = await ipad.page.evaluate(() => hub.profile && hub.profile.id);
      r.shot = rel(path.join(EVID, `verify-switch-race-cross-profile-cache-1-prayer-guest-app.png`));
      await ipad.page.screenshot({ path: path.join(ROOT, r.shot), scale: 'css', animations: 'disabled', caret: 'hide' });
      log(`[${mode}] Eli has ${eliRows.length} private prayers; ${r.eliPrayerKeysInGuestCache} of them are in Grandma Jo's cache; Grandma Jo's own server rows ${JSON.stringify(r.guestServerPrayerRows)}; after a reload as ${r.profileAfterReload}, her Prayer app shows ${r.guestPrayerAppShowsEliTitles.length}/${eliRows.length} of Eli's titles, e.g. ${JSON.stringify(r.guestPrayerAppShowsEliTitles.slice(0, 2))}`);
    }
    r.requestsAfterSignIn = net.filter(n => n.t >= r.signedInAt - 50 && n.m === 'GET' && n.u.startsWith('/api/data/')).map(n => `${n.t} ${n.u.split('&since')[0]} as ${n.as}`);
    log(`[${mode}] data GETs from sign-in on: ${JSON.stringify(r.requestsAfterSignIn)}`);
    r.pageErrors = ipad.logs.filter(l => l.startsWith('pageerror'));
  } finally { await L.close(); }
  return r;
}

const out = { control: await run('control'), timer: await run('timer'), prayer: await run('prayer') };
const file = path.join(EVID, 'verify-switch-race-cross-profile-cache-1.json');
fs.writeFileSync(file, JSON.stringify(out, null, 2));
log('evidence', rel(file));
