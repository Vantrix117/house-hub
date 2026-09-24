// PROF skeptic #1 — finding "person-writes-stranded-after-switch".
// Claim: on the shared Kitchen iPad, a person's offline person-scope writes (theme, an F260 tick) stay in
// hub.queue.<app>.person.<id> after Me → Switch and are never sent while other people use the iPad; they only reach the
// server when that same person signs in again on that same iPad. (hub.js queues are per person, flush walks only the
// signed-in person's channels, and Switch → hub.signOut() does not flush first.)
//
//   node "audits/tools/phase2/PROF/verify-person-writes-stranded-after-switch-1.mjs"     (about 2 minutes)
//
// One local rig (typical seed, real clock, WebKit), everything driven through the UI on one iPad context:
//   1. Eli signs in with a PIN on the picker (PIN reset + recreated through the real routes so the script knows it).
//   2. Offline: Me → Forest theme; Apps → F260 → Done. Home.
//   3. Me → Switch (still offline) → back online at the picker → Ezra. Wait 40 s (a 30 s pull cycle + flush retries).
//   4. Ezra → Switch → Downstairs TV. Wait 8 s.
//   5. Eli's phone (second paired device) opens the hub: does it see Forest / the tick?
//   6. Control: TV → Switch → Eli (PIN) on the iPad: does the queue flush now?
// Evidence: audits/evidence/p2/PROF/verify-person-writes-stranded-after-switch-1.json (+ one PNG of Eli's phone).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real' });
const R = {};
const log = (k, v) => { console.log(k.padEnd(60), typeof v === 'string' ? v : JSON.stringify(v)); R[k] = v; return v; };
const PIN = '1357';

try {
  // Eli's PIN: reset by the admin (Eli), then created again through the real route. This kills the rig's Eli session,
  // so server reads below use the token that route returns.
  const rs = await L.apiAs('eli', '/api/admin/profiles/eli/reset-pin', { method: 'POST', body: {} });
  const cp = await L.apiAs(null, '/api/profiles/eli/pin', { method: 'POST', body: { pin: PIN } });
  const tokEli = cp.body.profile_token;
  log('setup: reset Eli PIN / create PIN', `${rs.status} / ${cp.status}`);
  const asEli = p => L.apiAs(null, p, { profileToken: tokEli });
  const serverTheme = async () => { const it = (await asEli('/api/data/hub?scope=person&key=theme')).body.item; return it ? it.value : '(no row)'; };
  const serverDone = async () => { const it = (await asEli('/api/data/f260?scope=person&key=f260.done')).body.item; return it && it.value ? Object.keys(it.value).sort() : []; };

  const ipad = await L.device({ device: 'ipad-portrait', profile: null, fixedTime: false });
  const { page } = ipad;
  const posts = [];
  page.on('request', r => { const u = new URL(r.url()); if (u.origin === L.api && r.method() === 'POST') posts.push({ t: Date.now(), p: u.pathname + u.search, main: r.frame() === page.mainFrame() }); });
  const tap = sel => page.locator(sel).first().click();
  const queues = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hub.queue.') && localStorage.getItem(k) !== '{}').map(k => [k, JSON.parse(localStorage.getItem(k))])));
  const waitShell = id => page.waitForFunction(i => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === i, id, { timeout: 20000 });
  const pinIn = async () => { await page.waitForSelector('#pad'); for (const d of PIN) await tap(`#pad [data-d="${d}"]`); await tap('#pingo'); };
  const sw = async () => { await tap('.tab[data-tab="me"]'); await page.waitForSelector('#switch'); await tap('#switch'); await page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 15000 }); };

  // 1. Eli signs in on the picker
  await ipad.goto('#home');
  await page.waitForSelector('#profiles .pcard[data-id="eli"]', { timeout: 15000 });
  await tap('#profiles .pcard[data-id="eli"]'); await pinIn(); await waitShell('eli');
  await page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 20000 });
  log('1. Eli signed in on the iPad; theme on this device', await page.evaluate(() => hub.theme()));
  const theme0 = log('1. server: Eli theme before', await serverTheme());
  const done0 = await serverDone();
  log('1. server: Eli f260.done count before', String(done0.length));

  // 2. offline: Forest + F260 Done
  await ipad.setOffline(true);
  await tap('.tab[data-tab="me"]'); await page.waitForSelector('#theme [data-theme="forest"]');
  await tap('#theme [data-theme="forest"]'); await sleep(400);
  await tap('.tab[data-tab="apps"]'); await page.waitForSelector('#grid .tile[data-id="f260"]'); await tap('#grid .tile[data-id="f260"]');
  let f; for (let i = 0; i < 80 && !(f = ipad.frame('f260')); i++) await sleep(100);
  await f.waitForFunction(() => window.hub && hub.profile && document.getElementById('todayDone') && !document.getElementById('todayDone').hidden && document.getElementById('todayDone').dataset.target, null, { timeout: 20000 });
  await sleep(1200);
  const target = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
  await f.click('#todayDone'); await sleep(1200);
  log('2. Eli offline: ticked F260 reading', target);
  await tap('#pill-home'); await sleep(600);
  await tap('.tab[data-tab="home"]'); await sleep(300);
  const q2 = await queues();
  log('2. localStorage queues (offline, Eli signed in)', Object.fromEntries(Object.entries(q2).map(([k, v]) => [k, Object.keys(v)])));
  log('2. hub.sync (Eli)', await page.evaluate(() => ({ state: hub.sync.state, pending: hub.sync.pending })));

  // 3. Switch while offline → online at the picker → Ezra
  await sw();
  await ipad.setOffline(false); await sleep(500);
  const tSwitch = Date.now();
  await tap('#profiles .pcard[data-id="ezra"]'); await waitShell('ezra');
  await sleep(40000);
  const q3 = await queues();
  log('3. after Ezra 40 s: localStorage queues', Object.fromEntries(Object.entries(q3).map(([k, v]) => [k, Object.keys(v)])));
  log('3. hub.sync (Ezra) — what the Me tab "Waiting to send" shows', await page.evaluate(() => ({ state: hub.sync.state, pending: hub.sync.pending })));
  log('3. POSTs to /api/data/*/batch since the switch', posts.filter(p => p.t >= tSwitch && /\/batch/.test(p.p)).map(p => p.p));
  log('3. server: Eli theme', String(await serverTheme()));
  const done3 = await serverDone();
  log('3. server: Eli f260.done has the offline tick?', done3.includes(target) ? 'yes' : 'no');

  // 4. Ezra → TV
  await sw();
  await tap('#profiles .pcard[data-id="tv"]');
  await page.waitForFunction(() => !document.getElementById('shell').hidden && document.documentElement.dataset.kind === 'kiosk', null, { timeout: 15000 });
  await sleep(8000);
  const q4 = await queues();
  log('4. after TV 8 s: Eli queues still on the iPad?', { hub: Object.keys(q4['hub.queue.hub.person.eli'] || {}), f260: Object.keys(q4['hub.queue.f260.person.eli'] || {}) });
  log('4. server: Eli theme / tick', `${await serverTheme()} / ${(await serverDone()).includes(target) ? 'tick yes' : 'tick no'}`);

  // 5. Eli's phone
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  await phone.goto('#home');
  await phone.page.waitForFunction(() => window.hub && hub.profile && hub.sync.lastPull > 0, null, { timeout: 20000 });
  await sleep(1000);
  log('5. Eli phone: theme / sees the tick?', await phone.page.evaluate(t => `${hub.theme()} / ${(hub.get('f260.done', { app: 'f260', scope: 'person' }) || {})[t] ? 'yes' : 'no'}`, target));
  R.phoneShot = path.relative(ROOT, await phone.shot(path.join(OUT, 'verify-person-writes-stranded-after-switch-1-phone.png')));

  // 6. control: Eli back on the iPad (the TV board has its own Switch button; no tab bar in kiosk mode)
  await tap('#kiosk-switch');
  await page.waitForSelector('#profiles .pcard[data-id="eli"]'); await tap('#profiles .pcard[data-id="eli"]'); await pinIn(); await waitShell('eli');
  await sleep(5000);
  const q6 = await queues();
  log('6. Eli back on the iPad (5 s): Eli queues', { hub: Object.keys(q6['hub.queue.hub.person.eli'] || {}), f260: Object.keys(q6['hub.queue.f260.person.eli'] || {}) });
  log('6. server: Eli theme / tick', `${await serverTheme()} / ${(await serverDone()).includes(target) ? 'tick yes' : 'tick no'}`);
  log('logs (tail)', ipad.logs.slice(-8));
  fs.writeFileSync(path.join(OUT, 'verify-person-writes-stranded-after-switch-1.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
