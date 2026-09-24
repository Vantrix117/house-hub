// PROF skeptic #2: does the shell stop its 30 s pull after an in-page profile switch?
//
//   node "audits/tools/phase2/PROF/verify-poll-stops-after-switch-2.mjs"      (about 5 minutes: four 65 s windows)
//
// One Kitchen iPad (WebKit, real clock, typical seed). setInterval/clearInterval in the top window are wrapped so the
// 30 000 ms pull timer (apps/hub.js:342) is observed directly. In each window "Mae's phone" (a second paired device,
// raw API) adds a family reminder 5 s in; at the end we read whether the iPad's hub store / screen has it.
//   A. Eli, fresh page load                   (control: poll expected)
//   B. Me → Switch → Ezra (tap), no reload    (the claim)
//   C. Me → Switch → Downstairs TV, no reload (the kiosk: CLAUDE.md says its Home "refreshes itself")
//   D. page reload as the TV                  (control: a fresh load polls again)
// Nothing is hidden/backgrounded, no app is opened during a window. Evidence: audits/evidence/p2/PROF/verify-poll-2.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const WIN = 65000;
const L = await local({ variant: 'typical', clock: 'real' });
const R = { windows: [] };
const log = (k, v) => { console.log(k.padEnd(52), typeof v === 'string' ? v : JSON.stringify(v)); };

try {
  const ph = await L.newDevice({ name: 'Mae phone', profiles: ['christian'] });
  const phoneAdd = async text => {
    const id = 'v2-' + Date.now().toString(36);
    const r = await L.apiAs(null, `/api/data/reminders/item:${id}?scope=family`, { method: 'PUT', deviceToken: ph.device.token, profileToken: ph.sessions.christian,
      body: { value: { id, text, by: 'christian', byName: 'Mae', createdAt: Date.now() }, updated_at: Date.now() } });
    return r.status;
  };

  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const { page } = ipad;
  await ipad.ctx.addInitScript(() => {
    if (window.top !== window) return;
    window.__iv = [];
    const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
    window.setInterval = function (fn, ms, ...a) { const id = si(fn, ms, ...a); if (ms === 30000) window.__iv.push({ ev: 'set', id, at: Date.now() }); return id; };
    window.clearInterval = function (id) { if (window.__iv.some(x => x.ev === 'set' && x.id === id)) window.__iv.push({ ev: 'clear', id, at: Date.now() }); return ci(id); };
  });
  const reqs = [];
  page.on('request', r => { const u = new URL(r.url()); if (u.origin === L.api && r.frame() === page.mainFrame()) reqs.push({ t: Date.now(), m: r.method(), p: u.pathname }); });

  const state = () => page.evaluate(() => ({ profile: hub.profile && hub.profile.id, tab: document.documentElement.dataset.tab, visibility: document.visibilityState,
    liveTimers: (() => { const set = window.__iv.filter(x => x.ev === 'set').map(x => x.id); const cl = new Set(window.__iv.filter(x => x.ev === 'clear').map(x => x.id)); return set.filter(i => !cl.has(i)).length; })(),
    ivLog: window.__iv.map(x => x.ev + '#' + x.id), lastPull: hub.sync.lastPull, syncState: hub.sync.state }));
  const hasRem = text => page.evaluate(t => ({
    store: hub.list('item:', { app: 'reminders', scope: 'family' }).some(r => r.value && r.value.text === t),
    screen: document.body.innerText.includes(t) }), text);
  const waitProfile = id => page.waitForFunction(i => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === i, id, { timeout: 20000 });
  const waitPullAfter = since => page.waitForFunction(s => window.hub && hub.sync.lastPull > s, since, { timeout: 20000 });
  const switchTo = async id => {
    await page.locator('.tab[data-tab="me"]').first().click(); await page.waitForSelector('#switch');
    await page.locator('#switch').click();
    await page.waitForSelector(`#profiles .pcard[data-id="${id}"]`, { timeout: 15000 });
    const before = Date.now();
    await page.locator(`#profiles .pcard[data-id="${id}"]`).click();
    await waitProfile(id);
    if (id !== 'tv') await page.locator('.tab[data-tab="home"]').first().click();
    await waitPullAfter(before - 1).catch(() => {});
    await sleep(1500);
  };
  const windowRun = async label => {
    const s0 = await state();
    const t0 = Date.now();
    await sleep(5000);
    const text = `${label.slice(0, 1)} check ${new Date().toISOString().slice(11, 19)}`;
    const st = await phoneAdd(text);
    await sleep(WIN - 5000);
    const got = reqs.filter(r => r.m === 'GET' && r.p.startsWith('/api/data/') && r.t >= t0 && r.t < t0 + WIN);
    const rounds = new Set(got.map(r => Math.floor(r.t / 5000))).size;
    const s1 = await state();
    const rem = await hasRem(text);
    const w = { label, profileAtStart: s0.profile, visibility: s1.visibility, tab: s1.tab, liveThirtySecondTimers: s1.liveTimers, intervalLog: s1.ivLog,
      getApiData: got.length, pullRounds: rounds, lastPullAgeS: Math.round((Date.now() - s1.lastPull) / 1000), syncState: s1.syncState,
      phoneReminder: text, phonePutStatus: st, onIpadAfter60s: rem };
    R.windows.push(w);
    log(`${label}: GET /api/data in ${WIN / 1000}s`, `${w.getApiData} requests / ${w.pullRounds} rounds; live 30s timers=${w.liveThirtySecondTimers}; lastPull ${w.lastPullAgeS}s ago; visibility=${w.visibility}`);
    log(`${label}: phone reminder "${text}" (PUT ${st}) on iPad?`, rem);
    log(`${label}: interval log`, w.intervalLog.join(' '));
    return w;
  };

  // A. fresh load as Eli
  await ipad.goto('#home');
  await page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(1500);
  await windowRun('A Eli fresh load');
  // B. in-page switch to Ezra
  await switchTo('ezra');
  await windowRun('B after switch to Ezra');
  // C. in-page switch to the TV (kiosk)
  await switchTo('tv');
  await windowRun('C after switch to TV');
  await page.screenshot({ path: path.join(OUT, 'verify-poll-2-tv-after-switch.png'), scale: 'css', animations: 'disabled', caret: 'hide' });
  // D. reload as the TV (control)
  const rC = R.windows[2].phoneReminder;
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(1500);
  log('D. after reload: C\'s reminder now on the iPad?', await hasRem(rC));
  await windowRun('D TV after reload');
  fs.writeFileSync(path.join(OUT, 'verify-poll-2.json'), JSON.stringify(R, null, 2));
  log('evidence', 'audits/evidence/p2/PROF/verify-poll-2.json, verify-poll-2-tv-after-switch.png');
  const errs = ipad.logs.filter(l => /error/i.test(l)); if (errs.length) log('page errors', errs.slice(0, 5));
} finally {
  await L.close();
}
