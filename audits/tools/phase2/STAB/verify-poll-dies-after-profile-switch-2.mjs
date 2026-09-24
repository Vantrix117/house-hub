// Skeptic #2 for STAB "poll-dies-after-profile-switch". Independent of poll.mjs/advance.mjs: NO installed fake clock —
// the browser runs on the real clock and every window is real wall time (65 s = two 30 s poll ticks), so a
// Playwright clock artefact cannot explain the result.
//   node "audits/tools/phase2/STAB/verify-poll-dies-after-profile-switch-2.mjs" ipad   (≈ 3.5 min)
//   node "audits/tools/phase2/STAB/verify-poll-dies-after-profile-switch-2.mjs" tv     (≈ 4 min)
// ipad: Ezra signed in at page load → count GET /api/data in 65 s (control) → Me → Switch → tap Ezra again (same
//       profile, so the switch is the only variable) → count again → Mae PUTs a family reminder (raw API) → 65 s → on Home?
//       → a visibilitychange (what waking the iPad fires) → on Home now?
// tv:   the board signed in at page load → count → Switch → tap Downstairs TV → count → a reminder → 65 s (the board
//       repaints every 60 s from the cache) → on the board? Also counts /api/activity (the board's own 5-min feed fetch).
// Output: audits/evidence/p2/STAB/pollswitch-v2-<leg>.json + pollswitch-v2-<leg>-stale.png (1× css)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const LEG = process.argv[2] || 'ipad';
const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
fs.mkdirSync(OUT, { recursive: true });
const R = { leg: LEG, startedAt: new Date().toISOString() };
const log = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });

function counter(d) {
  const c = { data: 0, activity: 0 };
  d.page.on('request', r => { const u = r.url(); if (r.method() !== 'GET') return; if (u.includes('/api/data/')) c.data++; else if (u.includes('/api/activity')) c.activity++; });
  return c;
}
async function windowCount(d, c, ms) { const a = { ...c }; await sleep(ms); return { data: c.data - a.data, activity: c.activity - a.activity, seconds: ms / 1000 }; }
const state = d => d.page.evaluate(() => ({ profile: hub.profile && hub.profile.id, lastPullAgoS: hub.sync.lastPull ? Math.round((Date.now() - hub.sync.lastPull) / 1000) : null, sync: hub.sync.state }));
const shot = (d, f) => d.page.screenshot({ path: path.join(OUT, f), scale: 'css', animations: 'disabled', caret: 'hide' });
async function addReminder(text) {
  const id = 'v2-' + Date.now().toString(36);
  const r = await L.apiAs('christian', `/api/data/reminders/item:${id}?scope=family`, { method: 'PUT', body: { value: { id, text, by: 'christian', byName: 'Mae', createdAt: Date.now() }, updated_at: Date.now() } });
  const back = await L.apiAs('christian', '/api/data/reminders?scope=family');
  return { id, status: r.status, onServer: JSON.stringify(back.body).includes(id) };
}
async function pickProfile(d, id) {
  await d.page.waitForSelector(`#profiles .pcard[data-id="${id}"]:not(.skeleton)`, { timeout: 15000 });
  await d.page.click(`#profiles .pcard[data-id="${id}"]`);
  await d.page.waitForFunction(pid => window.hub && hub.profile && hub.profile.id === pid && document.getElementById('gate').hidden, id, { timeout: 15000 });
}

try {
  if (LEG === 'ipad') {
    const d = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
    const c = counter(d);
    await d.goto('#home'); await d.page.waitForSelector('#view-home #remlist'); await sleep(5000);
    log('I1 control: Ezra signed in at page load, GET /api/data in 65 s real time', { ...(await windowCount(d, c, 65000)), ...(await state(d)) });
    // Me → Switch → tap Ezra (the same profile)
    await d.page.click('#tabbar .tab[data-tab="me"]'); await d.page.waitForSelector('#switch'); await d.page.click('#switch');
    await pickProfile(d, 'ezra');
    await d.page.click('#tabbar .tab[data-tab="home"]'); await d.page.waitForSelector('#view-home.on #remlist'); await sleep(5000);   // back to Home, as the kitchen iPad sits
    log('I2 after Me → Switch → Ezra, GET /api/data in 65 s real time', { ...(await windowCount(d, c, 65000)), ...(await state(d)) });
    const rem = await addReminder('Verify2: library books back today');
    const onHome = () => d.page.evaluate(t => [...document.querySelectorAll('#remlist .rem-text')].some(e => e.textContent.includes(t)), 'Verify2: library');
    await sleep(65000);
    log('I3 reminder PUT by Mae; on Ezra\'s Home 65 s later?', { ...rem, shown: await onHome(), inCache: await d.page.evaluate(id => hub.list('item:', { app: 'reminders', scope: 'family' }).some(r => r.value && r.value.id === id), rem.id), ...(await state(d)) });
    await shot(d, 'pollswitch-v2-ipad-stale.png');
    await d.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(3000);
    log('I4 after a visibilitychange (document.hidden stays false)', { shown: await onHome(), ...(await state(d)) });
    // does the timer come back on its own after that pull? (it should not: nothing re-creates it)
    log('I5 GET /api/data in the next 65 s', await windowCount(d, c, 65000));
  } else {
    const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
    const c = counter(tv);
    await tv.goto('#home'); await tv.page.waitForSelector('#tv #clock'); await sleep(5000);
    log('T1 control: TV at page load, GET /api/data in 65 s real time', { ...(await windowCount(tv, c, 65000)), ...(await state(tv)) });
    await tv.page.click('#kiosk-switch'); await pickProfile(tv, 'tv'); await sleep(5000);
    log('T2 after Switch → Downstairs TV, GET /api/data in 65 s real time', { ...(await windowCount(tv, c, 65000)), ...(await state(tv)) });
    const rem = await addReminder('Verify2: dentist at 3:30');
    await sleep(65000);
    log('T3 reminder PUT by Mae; on the board 65 s later (board repaints every 60 s)?', { ...rem, ...(await tv.page.evaluate(() => ({ remCardHidden: document.getElementById('tv-rem-card').hidden, shown: [...document.querySelectorAll('#tv-rem-card .rem-text')].some(e => e.textContent.includes('Verify2: dentist')), lastPaintAgoS: Math.round((Date.now() - window.__tv.state().lastPaint) / 1000) }))), ...(await state(tv)), activityFetchesTotal: c.activity });
    await shot(tv, 'pollswitch-v2-tv-stale.png');
  }
} finally {
  R.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, `pollswitch-v2-${LEG}.json`), JSON.stringify(R, null, 1));
  await L.close();
}
