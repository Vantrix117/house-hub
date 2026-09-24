// PROF skeptic #1 — "future-stamp-lock": a writer stamps updated_at in the future and others' writes lose.
// Independent re-run on a fresh local instance (real clock, so the Worker's Date.now() is the real now).
//
//   node "audits/tools/phase2/PROF/verify-future-stamp-lock-1.mjs"
//
// A. Raw API (what the finding reproduced): Ezra PUTs a family fridge row 1 h ahead; what is stored; does Mom's
//    normal-clock PUT / DELETE lose; how long does the lock last (a +20 s stamp, retried after it passes).
// B. Through hub.js (how the apps actually write): Mom's Larder on a phone.
//    B1 Mom's device has already pulled the future-stamped row → her edit.
//    B2 Mom's device has NOT pulled it yet (stale cache) → her first edit, then her second edit.
//    B3 A kid device whose clock runs 1 h fast, online → what updated_at its write carries.
//    B4 The same device reopened offline (hub.skew back to 0), writes, reconnects → what is stored; does Mom lose.
// Evidence: audits/evidence/p2/PROF/verify-future-stamp-lock-1.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real' });
const res = {};
const log = (...a) => console.log(...a);
const serverNow = async () => (await L.apiAs('eli', '/api/data/leftovers?scope=family&key=item:none')).body.now;
const row = async key => (await L.apiAs('eli', `/api/data/leftovers?scope=family&key=${encodeURIComponent(key)}`)).body.item;
const put = (who, key, value, updated_at) => L.apiAs(who, `/api/data/leftovers/${key}?scope=family`, { method: 'PUT', body: { value, updated_at } });

try {
  // ── A. raw API ──
  log('── A. raw API ──');
  let now = await serverNow();
  const a1 = await put('ezra', 'item:fsA', { id: 'fsA', name: 'Ezra future' }, now + 3600e3);
  const sA = await row('item:fsA');
  now = await serverNow();
  res.A1 = { status: a1.status, applied: a1.body.applied, storedAheadS: Math.round((sA.updated_at - now) / 1000) };
  log('A1 ezra PUT +1h →', a1.status, 'applied=' + a1.body.applied, '; stored updated_at − server now =', res.A1.storedAheadS, 's');
  await sleep(1000);
  const a2 = await put('mom', 'item:fsA', { id: 'fsA', name: 'Mom fixed it' }, Date.now());
  res.A2 = { status: a2.status, applied: a2.body.applied, rowNow: (await row('item:fsA')).value };
  log('A2 mom PUT (normal clock, 1 s later) →', a2.status, 'applied=' + a2.body.applied, '; row now', JSON.stringify(res.A2.rowNow));
  const a3 = await L.apiAs('mom', '/api/data/leftovers/item:fsA?scope=family', { method: 'DELETE' });
  res.A3 = { status: a3.status, applied: a3.body.applied, rowNow: (await row('item:fsA')).value };
  log('A3 mom DELETE (server-stamped) →', a3.status, 'applied=' + a3.body.applied, '; row now', JSON.stringify(res.A3.rowNow));
  // lock is bounded: +20 s stamp, Mom loses now, wins after it passes
  now = await serverNow();
  await put('ezra', 'item:fsT', { id: 'fsT', name: 'Ezra +20s' }, now + 20e3);
  const t1 = await put('mom', 'item:fsT', { id: 'fsT', name: 'Mom early' }, Date.now());
  log('A4 ezra PUT +20 s; mom PUT now → applied=' + t1.body.applied);
  await sleep(21500);
  const t2 = await put('mom', 'item:fsT', { id: 'fsT', name: 'Mom after 21.5 s' }, Date.now());
  res.A4 = { momEarlyApplied: t1.body.applied, momAfterApplied: t2.body.applied, rowNow: (await row('item:fsT')).value };
  log('A4 mom PUT after 21.5 s → applied=' + t2.body.applied, '; row now', JSON.stringify(res.A4.rowNow));

  // ── B. through hub.js on Mom's phone (Larder, family scope) ──
  log('\n── B. through hub.js (Mom\'s phone, Larder) ──');
  const ph = await L.newDevice({ name: 'Mom phone', profiles: ['mom'] });
  const mom = await L.device({ device: 'iphone-pwa', profile: 'mom', fixedTime: false, as: ph });
  // seed two normal rows Mom's phone will cache
  now = await serverNow();
  await put('eli', 'item:fsB1', { id: 'fsB1', name: 'B1 original' }, now);
  await put('eli', 'item:fsB2', { id: 'fsB2', name: 'B2 original' }, now);
  const f = await mom.openApp('leftovers');
  await f.evaluate(() => hub.ready());
  await f.evaluate(() => hub.pull());
  const cached = await f.evaluate(() => ({ b1: hub.get('item:fsB1'), b2: hub.get('item:fsB2'), skew: hub.skew }));
  log('Mom phone cache:', JSON.stringify(cached));

  // Ezra future-stamps both rows (+1 h → clamped +5 min)
  now = await serverNow();
  await put('ezra', 'item:fsB1', { id: 'fsB1', name: 'Ezra future B1' }, now + 3600e3);

  // B1: Mom's phone pulls first, then edits
  await f.evaluate(() => hub.pull());
  const b1seen = await f.evaluate(() => hub.get('item:fsB1'));
  const b1 = await f.evaluate(async () => {
    const out = {};
    const orig = hub.request;
    hub.request = async (...a) => { const r = await orig(...a); if (String(a[0]).includes('/batch')) out.results = r.results; return r; };
    hub.set('item:fsB1', { id: 'fsB1', name: 'Mom edit B1' });
    await hub.flush();
    hub.request = orig;
    return { results: out.results, local: hub.get('item:fsB1') };
  });
  res.B1 = { seenBeforeEdit: b1seen, flush: b1.results, localAfter: b1.local, server: (await row('item:fsB1')).value };
  log('B1 (pulled first) Mom sees', JSON.stringify(b1seen && b1seen.name), '→ edit applied=' + (b1.results && b1.results[0].applied), '; server row', JSON.stringify(res.B1.server));

  // B2: Ezra future-stamps B2 only now; Mom's phone edits from its stale cache (no pull since Ezra's write)
  now = await serverNow();
  await put('ezra', 'item:fsB2', { id: 'fsB2', name: 'Ezra future B2' }, now + 3600e3);
  const b2 = await f.evaluate(async () => {
    const out = [];
    const orig = hub.request;
    hub.request = async (...a) => { const r = await orig(...a); if (String(a[0]).includes('/batch')) out.push(r.results); return r; };
    const before = hub.get('item:fsB2');
    hub.set('item:fsB2', { id: 'fsB2', name: 'Mom edit B2 (1st)' });
    await hub.flush();
    const afterFirst = hub.get('item:fsB2');
    hub.set('item:fsB2', { id: 'fsB2', name: 'Mom edit B2 (2nd)' });
    await hub.flush();
    const afterSecond = hub.get('item:fsB2');
    hub.request = orig;
    return { before, first: out[0], afterFirst, second: out[1], afterSecond };
  });
  res.B2 = { ...b2, server: (await row('item:fsB2')).value };
  log('B2 (stale cache) Mom cache before', JSON.stringify(b2.before && b2.before.name));
  log('   1st edit applied=' + (b2.first && b2.first[0].applied), '; Mom\'s app now shows', JSON.stringify(b2.afterFirst && b2.afterFirst.name));
  log('   2nd edit applied=' + (b2.second && b2.second[0].applied), '; Mom\'s app now shows', JSON.stringify(b2.afterSecond && b2.afterSecond.name), '; server', JSON.stringify(res.B2.server));
  await mom.close();

  // B3: kid device with a clock 1 h fast, online → hub.skew corrects the stamp
  const kd = await L.newDevice({ name: 'Ezra tablet', profiles: ['ezra'] });
  const kid = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: Date.now() + 3600e3, as: kd });
  const kf = await kid.openApp('leftovers');
  await kf.evaluate(() => hub.ready());
  await kf.evaluate(() => hub.pull());
  const kskew = await kf.evaluate(() => hub.skew);
  await kf.evaluate(async () => { hub.set('item:fsB3', { id: 'fsB3', name: 'kid fast clock' }); await hub.flush(); });
  const b3 = await row('item:fsB3');
  now = await serverNow();
  res.B3 = { deviceSkewS: Math.round(kskew / 1000), storedAheadS: b3 ? Math.round((b3.updated_at - now) / 1000) : null };
  log('B3 kid device clock +1 h: hub.skew =', res.B3.deviceSkewS, 's; stored updated_at − server now =', res.B3.storedAheadS, 's');

  // B4: same fast-clock device, but the app is reopened while offline (hub.skew starts at 0, not persisted) and the
  //     write is queued offline, then flushed on reconnect.
  await kid.setOffline(true);
  await kid.page.reload({ waitUntil: 'load' });
  let kf2 = null; for (let i = 0; i < 100 && !kf2; i++) { kf2 = kid.frame('leftovers'); if (!kf2) await sleep(100); }
  await kf2.waitForLoadState('domcontentloaded');
  await kf2.evaluate(() => hub.ready());
  const skewOffline = await kf2.evaluate(() => hub.skew);
  await kf2.evaluate(() => { hub.set('item:fsB4', { id: 'fsB4', name: 'kid fast clock, queued offline' }); });
  await kid.setOffline(false);
  await kf2.evaluate(() => hub.flush());
  await sleep(500);
  const b4 = await row('item:fsB4');
  now = await serverNow();
  res.B4 = { skewWhenOffline: skewOffline, storedAheadS: b4 ? Math.round((b4.updated_at - now) / 1000) : null };
  log('B4 kid fast clock, reopened offline: hub.skew =', skewOffline, '; after reconnect stored updated_at − server now =', res.B4.storedAheadS, 's');
  if (b4) {
    const m = await put('mom', 'item:fsB4', { id: 'fsB4', name: 'Mom edit B4' }, Date.now());
    res.B4.momApplied = m.body.applied;
    log('   mom normal-clock PUT to that row → applied=' + m.body.applied);
  }
  await kid.close();
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-future-stamp-lock-1.json'), JSON.stringify(res, null, 2));
  await L.close();
}
