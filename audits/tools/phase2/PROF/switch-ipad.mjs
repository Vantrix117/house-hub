// PROF (audit Phase 2), brief item 4: switching people on the shared Kitchen iPad, driven through the UI.
// Eli changes things (theme, a kitchen timer, an offline family write + activity line, a push subscription), switches
// to Ezra and then to Mae (PIN) and finally to the Downstairs TV profile, and the script records what carries over.
//
//   node "audits/tools/phase2/PROF/switch-ipad.mjs"            (about 4 minutes: two 62 s polling windows + a 1 min timer)
//
// Evidence: audits/evidence/p2/PROF/switch-*.png and switch-ipad.json. Local rig only (real clock, typical seed).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f); };
const L = await local({ variant: 'typical', clock: 'real' });
const R = { steps: [] };
const log = (k, v) => { R.steps.push({ k, v }); console.log(k.padEnd(44), typeof v === 'string' ? v : JSON.stringify(v)); };
const MAE_PIN = '2580';
const tStart = Date.now();

try {
  // Mae gets a PIN the script knows (reset by the admin, then created again through the real route).
  await L.apiAs('eli', '/api/admin/profiles/christian/reset-pin', { method: 'POST', body: {} });
  const mp = await L.apiAs(null, '/api/profiles/christian/pin', { method: 'POST', body: { pin: MAE_PIN } });
  log('setup: Mae PIN set via /api/profiles/:id/pin', String(mp.status));
  // Eli has turned on notifications on the Kitchen iPad earlier (server row for eli × this device).
  const sub = await L.apiAs('eli', '/api/push/subscribe', { method: 'POST', body: { subscription: { endpoint: 'http://127.0.0.1:9/eli-kitchen-ipad', keys: { p256dh: 'x', auth: 'y' } } } });
  log('setup: Eli push subscription on this iPad', String(sub.status));

  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const { page } = ipad;
  // count beeps (AudioContext constructions) and every toast the shell shows
  await ipad.ctx.addInitScript(() => {
    if (window.top !== window) return;
    window.__beeps = 0; window.__toasts = [];
    const A = window.AudioContext || window.webkitAudioContext;
    if (A) { const W = class extends A { constructor(...a) { super(...a); window.__beeps++; } }; window.AudioContext = W; window.webkitAudioContext = W; }
    let last = '';
    setInterval(() => { const t = document.getElementById('hub-toast'); const s = t && !t.hidden ? t.textContent : ''; if (s && s !== last) window.__toasts.push({ at: Date.now(), text: s }); last = s; }, 200);
  });
  const reqs = [];
  page.on('request', r => { const u = new URL(r.url()); if (u.origin === L.api) reqs.push({ t: Date.now(), m: r.method(), p: u.pathname + u.search, main: r.frame() === page.mainFrame() }); });
  const pulls = (from, to) => reqs.filter(r => r.main && r.m === 'GET' && r.p.startsWith('/api/data/') && r.t >= from && r.t < to);
  const pullRounds = list => { const s = new Set(list.map(r => Math.round(r.t / 5000))); return s.size; };
  const html = () => page.evaluate(() => ({ theme: document.documentElement.dataset.theme || '(none: hearth/system)', scheme: document.documentElement.dataset.scheme, kind: document.documentElement.dataset.kind || null, lsTheme: localStorage.getItem('hub.theme') }));
  const ls = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /^hub\.(queue|activityQueue|lastProfile|session|theme)/.test(k)).map(k => [k, (() => { try { return JSON.parse(localStorage.getItem(k)); } catch { return localStorage.getItem(k); } })()])));
  const waitHome = async () => { await page.waitForFunction(() => !document.getElementById('shell').hidden && document.querySelector('#view-home.on .hero, #view-home.on .tv') , null, { timeout: 15000 }); };
  // after a switch the next person lands on whatever tab the hash names (Me, when Switch was tapped there)
  const waitShell = async id => { await page.waitForFunction(i => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === i, id, { timeout: 15000 }); return page.evaluate(() => document.documentElement.dataset.tab); };
  const waitPull = async since => { await page.waitForFunction(s => window.hub && hub.sync.lastPull > s, since, { timeout: 20000 }); };
  const tap = async sel => { await page.locator(sel).first().click(); };

  // ── A. Eli on the iPad ──
  await ipad.goto('#home'); await waitHome(); await waitPull(0);
  log('A. Eli signed in, first pull done', await html());
  const tA = Date.now(); await sleep(62000);
  const base = pulls(tA, tA + 62000);
  log('A. Eli: main-frame GET /api/data in 62 s', `${base.length} requests in ${pullRounds(base)} pull rounds`);

  // Eli starts a 1-minute kitchen timer (Apps → Kitchen timer → 1 min → Start → back to the hub)
  await tap('.tab[data-tab="apps"]'); await page.waitForSelector('#grid .tile[data-id="timer"]');
  await tap('#grid .tile[data-id="timer"]');
  let f; for (let i = 0; i < 50 && !(f = ipad.frame('timer')); i++) await sleep(100);
  await f.waitForSelector('#presets [data-s="60"]'); await sleep(800);
  await f.click('#presets [data-s="60"]'); await f.click('#go'); await sleep(500);
  await tap('#pill-home'); await sleep(500);
  const timerEnd = await page.evaluate(() => (hub.get('timer.active', { app: 'timer', scope: 'person' }) || {}).endAt);
  log('A. Eli timer running, ends at', new Date(timerEnd).toISOString() + `  pill visible=${await page.locator('#timer-pill').isVisible()}`);

  // Offline: Eli picks the Forest theme (person scope) and adds a family reminder (family scope + activity line)
  await ipad.setOffline(true);
  await tap('.tab[data-tab="me"]'); await page.waitForSelector('#theme [data-theme="forest"]');
  await tap('#theme [data-theme="forest"]'); await sleep(300);
  await tap('.tab[data-tab="home"]'); await page.waitForSelector('#remtext');
  await page.fill('#remtext', 'Eli offline: buy milk'); await page.press('#remtext', 'Enter'); await sleep(500);
  log('A. Eli offline, queued in localStorage', await ls());
  R.evidence = { eliOffline: await shot(ipad, 'switch-1-eli-offline-home.png') };

  // ── B. Switch to Ezra (Me → Switch → Ezra), going back online at the picker ──
  const t0 = Date.now();
  await tap('.tab[data-tab="me"]'); await page.waitForSelector('#switch'); await tap('#switch');
  await page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 15000 });
  log('B. Picker after Switch (offline)', { ...(await html()), pickerMsg: await page.textContent('#pickmsg'), lastProfile: await page.evaluate(() => hub.lastProfile()) });
  R.evidence.picker = await shot(ipad, 'switch-2-picker-after-eli.png');
  await ipad.setOffline(false); await sleep(300);
  const t1 = Date.now();
  await tap('#profiles .pcard[data-id="ezra"]');
  const landed = await waitShell('ezra');
  const t2 = Date.now();
  log('B. Ezra shell shown (ms from the card tap) / tab he lands on', `${t2 - t1} ms / ${landed}`);
  log('B. Ezra: theme at first paint', await html());
  R.evidence.ezraLanding = await shot(ipad, 'switch-3a-ezra-lands-on.png');
  await tap('.tab[data-tab="home"]'); await waitHome();
  R.evidence.ezraFirst = await shot(ipad, 'switch-3-ezra-home.png');
  const lp = await page.evaluate(() => hub.sync.lastPull);
  await waitPull(lp).catch(() => {});
  await sleep(800);
  log('B. Ezra: theme after his first pull', await html());
  R.evidence.ezraPulled = await shot(ipad, 'switch-4-ezra-after-pull.png');
  log('B. Ezra: timer pill visible (Eli\'s timer still running)', String(await page.locator('#timer-pill').isVisible()));
  const rems = ((await L.apiAs('eli', '/api/data/reminders?scope=family')).body.items || []).filter(i => i.value && /Eli offline/.test(i.value.text));
  log('B. server: Eli\'s offline reminder landed?', rems.length ? `yes, byName=${rems[0].value.byName} — flushed from the iPad under Ezra's session` : 'no');
  const feed1 = (await L.apiAs('eli', '/api/activity?limit=100')).body.activity.filter(a => /Eli offline/.test(a.text));
  log('B. server: Eli\'s activity line posted?', feed1.length ? feed1.map(a => a.profile_id + ': ' + a.text) : 'not yet');
  log('B. localStorage after Ezra signed in', await ls());

  // Ezra does something that writes a feed line: Kid Verse → Done ★ (falls back to the SDK call apps make if already done today)
  await tap('.tab[data-tab="apps"]'); await page.waitForSelector('#grid .tile[data-id="kidverse"]'); await tap('#grid .tile[data-id="kidverse"]');
  let kv; for (let i = 0; i < 50 && !(kv = ipad.frame('kidverse')); i++) await sleep(100);
  await kv.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 }); await sleep(2500);
  const doneTxt = await kv.evaluate(() => { const b = document.getElementById('done'); return b && !b.hidden ? b.textContent.trim() : null; });
  if (doneTxt === 'Done ★') { await kv.click('#done'); log('B. Ezra tapped Kid Verse "Done ★"', 'ok'); }
  else { await kv.evaluate(() => hub.activity('Ezra did something')); log('B. Kid Verse Done not available (' + doneTxt + '): called hub.activity from the app instead', 'ok'); }
  await sleep(2500);
  await tap('#pill-home'); await sleep(300);
  // the seed stamps some feed lines later today, so look for this run's lines by text rather than taking the newest rows
  const feed2 = (await L.apiAs('eli', '/api/activity?limit=100')).body.activity.filter(a => /Eli offline|Mae offline|read the verse|Ezra did something/.test(a.text) && a.created_at > tStart).map(a => `${a.profile_id} (${a.name}): ${a.text}`);
  log('B. server feed after Ezra\'s action (newest first)', feed2);
  R.feedAfterEzra = feed2;

  // polling after an in-page switch
  const tB = Date.now(); await sleep(62000);
  const after = pulls(tB, tB + 62000);
  log('B. Ezra: main-frame GET /api/data in 62 s', `${after.length} requests in ${pullRounds(after)} pull rounds`);
  log('B. Eli\'s timer ended during that window?', String(Date.now() > timerEnd));
  log('B. beeps / toasts on the iPad since load', await page.evaluate(() => ({ beeps: window.__beeps, toasts: window.__toasts.map(t => t.text) })));
  const eliTimer = (await L.apiAs('eli', '/api/data/timer?scope=person&key=timer.active')).body.item;
  log('B. server: Eli timer.active still set?', eliTimer && eliTimer.value ? 'yes (nobody finished it)' : 'no');
  const eliTheme = (await L.apiAs('eli', '/api/data/hub?scope=person&key=theme')).body.item;
  log('B. server: Eli\'s Forest theme reached the server?', eliTheme && eliTheme.value ? String(eliTheme.value) : 'no — still only in hub.queue.hub.person.eli on this iPad');
  const usage = (await L.apiAs('eli', '/api/admin/usage')).body;
  log('B. server: push subscriptions per profile', usage.push_subscriptions);

  // ── C. Switch Ezra → Mae (PIN) ──
  const c0 = Date.now();
  await tap('.tab[data-tab="me"]'); await page.waitForSelector('#switch'); await tap('#switch');
  await page.waitForSelector('#profiles .pcard[data-id="christian"]'); await tap('#profiles .pcard[data-id="christian"]');
  await page.waitForSelector('#pad');
  R.evidence.maePad = await shot(ipad, 'switch-5-mae-pin-pad.png');
  for (const d of MAE_PIN) await tap(`#pad [data-d="${d}"]`);
  await tap('#pingo');
  const landedMae = await waitShell('christian');
  const c1 = Date.now();
  log('C. Mae lands on tab', landedMae);
  log('C. Ezra → Mae: taps / ms (Me, Switch, card, 4 digits, Continue)', `8 taps, ${c1 - c0} ms incl. script pauses`);
  log('C. Mae at first paint', await html());
  const lp2 = await page.evaluate(() => hub.sync.lastPull); await waitPull(lp2).catch(() => {}); await sleep(800);
  log('C. Mae after her pull', await html());
  log('C. localStorage now', await ls());

  // ── D. Mae picks Midnight (online), then queues an offline reminder and hands the iPad to the TV profile ──
  await tap('.tab[data-tab="me"]'); await page.waitForSelector('#theme [data-theme="midnight"]'); await tap('#theme [data-theme="midnight"]'); await sleep(1500);
  await ipad.setOffline(true);
  await tap('.tab[data-tab="home"]'); await page.waitForSelector('#remtext');
  await page.fill('#remtext', 'Mae offline: dentist 3pm'); await page.press('#remtext', 'Enter'); await sleep(400);
  log('D. Mae offline queue', await ls());
  await tap('.tab[data-tab="me"]'); await page.waitForSelector('#switch'); await tap('#switch');
  await page.waitForSelector('#profiles .pcard[data-id="tv"]');
  await ipad.setOffline(false); await sleep(300);
  await tap('#profiles .pcard[data-id="tv"]');
  await page.waitForFunction(() => !document.getElementById('shell').hidden && document.documentElement.dataset.kind === 'kiosk', null, { timeout: 15000 });
  await sleep(4000);
  log('D. Downstairs TV on the iPad: theme', await html());
  log('D. hub.sync on the kiosk', await page.evaluate(() => ({ ...hub.sync })));
  log('D. localStorage queues after the kiosk signed in', await ls());
  const maeRem = ((await L.apiAs('eli', '/api/data/reminders?scope=family')).body.items || []).filter(i => i.value && /Mae offline/.test(i.value.text));
  log('D. server: Mae\'s offline reminder landed?', maeRem.length ? 'yes' : 'NO — dropped');
  log('D. server: this run\'s feed lines (newest first)', (await L.apiAs('eli', '/api/activity?limit=100')).body.activity.filter(a => a.created_at > tStart && /offline|read the verse|did something/.test(a.text)).map(a => `${a.profile_id} (${a.name}): ${a.text}`));
  R.evidence.kiosk = await shot(ipad, 'switch-6-kiosk-on-ipad.png');
  R.logs = ipad.logs.slice(-20);
  fs.writeFileSync(path.join(OUT, 'switch-ipad.json'), JSON.stringify(R, null, 1));
  console.log('evidence:', R.evidence);
} finally { await L.close(); }
