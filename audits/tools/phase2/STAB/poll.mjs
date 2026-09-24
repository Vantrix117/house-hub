// STAB (6): the shell's 30 s pull after an in-page profile switch (apps/hub.js:338-342 wires the interval once;
// hub.reset() at :370 clears it; enterShell calls hub.reset() + hub.ready() on every sign-in, index.html:623).
//   node "audits/tools/phase2/STAB/poll.mjs"
//
// A  Kitchen iPad: Eli's Home → count /api/data requests in 3 simulated minutes → Me → Switch → tap Ezra (kids open on tap)
//    → count again → Mae adds a family reminder from her phone (raw API; Eli's rig session is revoked by the Switch) → does Ezra's Home show it within 3 minutes?
//    → then a visibilitychange (what waking the iPad fires) → does it show now?
// B  TV: the board → count → Switch → tap Downstairs TV again → count → a reminder is added → does the board show it?
// WebKit, the Worker on real time, each context on its own installed clock advanced with real pulls (advance.mjs).
// Output: audits/evidence/p2/STAB/poll.json + poll-*.png
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { advance, settle, track, shot1x } from './advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const R = {};
const log = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)); };
const countData = async (d, ms) => { const T = track(d); const a = T.byKind.data || 0; await advance(d, ms); return (T.byKind.data || 0) - a; };
const addReminder = async (text) => { const id = 'stab-' + Date.now().toString(36); const r = await L.apiAs('christian', `/api/data/reminders/item:${id}?scope=family`, { method: 'PUT', body: { value: { id, text, by: 'christian', byName: 'Mae', createdAt: Date.now() }, updated_at: Date.now() } }); return { id, status: r.status }; };
const switchTo = async (d, id, openSwitch) => {
  await openSwitch();
  await d.page.waitForSelector(`#profiles .pcard[data-id="${id}"]`, { timeout: 10000 });
  await d.page.click(`#profiles .pcard[data-id="${id}"]`);
  await d.page.waitForFunction(pid => window.hub && hub.profile && hub.profile.id === pid && document.getElementById('gate').hidden, id, { timeout: 10000 });
  await d.ctx.clock.runFor(1000); await settle(d, { min: 500 });
};
try {
  // ── A: the Kitchen iPad ──
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.now() });
  track(d);
  await d.goto('#home'); await d.page.waitForSelector('#view-home .card'); await advance(d, 20000);
  log('A1 Eli, /api/data requests in 3 simulated min (expect ~6 pulls × 10 channels)', { requests: await countData(d, 180000), profile: await d.page.evaluate(() => hub.profile.id) });
  await switchTo(d, 'ezra', async () => { await d.page.evaluate(() => { location.hash = '#me'; }); await d.page.waitForSelector('#switch'); await d.page.click('#switch'); });
  await advance(d, 20000);
  log('A2 after Me → Switch → Ezra, /api/data requests in 3 simulated min', { requests: await countData(d, 180000), profile: await d.page.evaluate(() => hub.profile.id), lastPullAgoS: await d.page.evaluate(() => Math.round((Date.now() - hub.sync.lastPull) / 1000)) });
  const rem = await addReminder('STAB: poll check — pick up library books');
  const onHome = () => d.page.evaluate(t => [...document.querySelectorAll('#remlist .rem-text')].some(e => e.textContent.includes(t)), 'STAB: poll check');
  await advance(d, 180000);
  log('A3 reminder added on the server; shown on Ezra\'s Home 3 simulated min later?', { put: rem.status, shown: await onHome(), lastPullAgoS: await d.page.evaluate(() => Math.round((Date.now() - hub.sync.lastPull) / 1000)) });
  await shot1x(d, path.join(OUT, 'poll-ipad-ezra-stale.png'));
  await advance(d, 30 * 60000);
  log('A4 … and 30 simulated min later?', { shown: await onHome(), lastPullAgoS: await d.page.evaluate(() => Math.round((Date.now() - hub.sync.lastPull) / 1000)) });
  await d.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await d.ctx.clock.runFor(500); await settle(d, { min: 500 });
  log('A5 after a visibilitychange (waking the iPad)', { shown: await onHome() });
  // control: a fresh page load signed in as Ezra polls normally
  const c = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: Date.now() });
  track(c); await c.goto('#home'); await c.page.waitForSelector('#view-home .hero-title'); await advance(c, 20000);
  log('A6 control: Ezra signed in at page load, /api/data requests in 3 simulated min', { requests: await countData(c, 180000) });
  await c.close(); await d.close();

  // ── B: the TV ──
  const tv = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() });
  track(tv);
  await tv.goto('#home'); await tv.page.waitForSelector('#tv #clock'); await advance(tv, 20000);
  log('B1 TV, /api/data requests in 3 simulated min', { requests: await countData(tv, 180000) });
  await switchTo(tv, 'tv', async () => { await tv.page.click('#kiosk-switch'); });
  await advance(tv, 20000);
  log('B2 TV after Switch → Downstairs TV, /api/data requests in 3 simulated min', { requests: await countData(tv, 180000) });
  const remTv = await addReminder('STAB: TV poll check — dentist 3:30');
  await advance(tv, 10 * 60000);
  const tvShown = await tv.page.evaluate(() => ({ remCardHidden: document.getElementById('tv-rem-card').hidden, shown: [...document.querySelectorAll('#tv-rem-card .rem-text')].some(e => e.textContent.includes('STAB: TV poll')), clock: document.getElementById('clock').textContent }));
  log('B3 reminder added on the server; on the TV board 10 simulated min later?', { put: remTv.status, ...tvShown, lastPullAgoS: await tv.page.evaluate(() => Math.round((Date.now() - hub.sync.lastPull) / 1000)), feedFetches: tv._track.byKind.activity });
  await shot1x(tv, path.join(OUT, 'poll-tv-after-switch.png'));
  fs.writeFileSync(path.join(OUT, 'poll.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
