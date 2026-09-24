// PROF skeptic #2 — "A person's offline person-scope writes are stranded on the shared iPad after Switch".
// Independent rerun on a fresh local instance (real clock, typical seed, WebKit). Everything through the UI except the
// admin PIN reset that lets the script sign Eli back in, and the read-only server checks (done with Eli's PHONE session,
// so the iPad's own sign-out can never make a check read "no" by accident).
//
//   node "audits/tools/phase2/PROF/verify-person-writes-stranded-after-switch-2.mjs"      (~70 s)
//
// 1. Eli on the Kitchen iPad: F260 open, Wi-Fi drops, he taps Done twice, then Me → Forest → Switch; Wi-Fi back; Ezra signs in.
//    After 35 s: does the server / Eli's phone have the ticks and the theme? What is in the iPad's localStorage?
// 2. Eli's phone (unaware) ticks its own next reading. Eli signs back in on the iPad (PIN): what reaches the server?
// 3. Flaky Wi-Fi (navigator.onLine stays true, API requests fail): Frost + Switch within the 5 s retry → stranded too?
// Evidence: audits/evidence/p2/PROF/verify2-stranded-*.png + verify2-stranded.json.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const R = {};
const log = (k, v) => { R[k] = v; console.log(k.padEnd(62), typeof v === 'string' ? v : JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const ELI_PIN = '4826';

try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  let eliTok = ph.sessions.eli;
  const srv = async (app, key) => { const r = await L.apiAs(null, `/api/data/${app}?scope=person&key=${encodeURIComponent(key)}`, { deviceToken: ph.device.token, profileToken: eliTok }); if (r.status !== 200) throw new Error('server check failed ' + r.status + JSON.stringify(r.body)); return r.body.item; };
  const doneIds = v => Object.keys(v || {}).filter(k => v[k]).sort();

  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const page = ipad.page;
  const lsQueues = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hub.queue.') && localStorage.getItem(k) !== '{}').map(k => [k, JSON.parse(localStorage.getItem(k))])));
  const waitShell = id => page.waitForFunction(i => !document.getElementById('shell').hidden && window.hub && hub.profile && hub.profile.id === i, id, { timeout: 20000 });
  const waitPull = since => page.waitForFunction(s => window.hub && hub.sync.lastPull > s, since, { timeout: 20000 });

  // ── 1. Eli ticks F260 twice and picks Forest while the iPad is offline, then Switch → Ezra ──
  const base = { theme: (await srv('hub', 'theme')), done: await srv('f260', 'f260.done') };
  log('0. server before: Eli theme / f260.done ids', { theme: base.theme ? base.theme.value : '(unset)', done: doneIds(base.done && base.done.value) });
  const f = await ipad.openApp('f260', { wait: '#todayDone' });
  await f.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(800);
  await ipad.setOffline(true);
  const t1 = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
  await f.click('#todayDone'); await sleep(900);
  const t2 = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
  await f.click('#todayDone'); await sleep(900);
  log('1. iPad (offline) ticked readings', [t1, t2]);
  await page.click('#pill-home'); await sleep(400);
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#theme [data-theme="forest"]');
  await page.click('#theme [data-theme="forest"]'); await sleep(400);
  log('1. Eli Me → Sync card before Switch', await page.evaluate(() => ({ state: hub.sync.state, pending: hub.sync.pending })));
  await page.screenshot({ path: path.join(OUT, 'verify2-stranded-1-eli-me-before-switch.png'), scale: 'css', fullPage: false, animations: 'disabled', caret: 'hide' });
  log('1. iPad queues before Switch', await lsQueues());
  await page.click('#switch');
  await page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 15000 });
  await ipad.setOffline(false); await sleep(300);
  await page.click('#profiles .pcard[data-id="ezra"]');
  await waitShell('ezra'); await waitPull(0).catch(() => {});
  await sleep(35000);   // > one 30 s poll period and several 5 s retries
  log('1. Ezra on the iPad 35 s later: hub.sync', await page.evaluate(() => ({ profile: hub.profile.id, state: hub.sync.state, pending: hub.sync.pending })));
  const after1 = { theme: await srv('hub', 'theme'), done: await srv('f260', 'f260.done') };
  log('1. server after 35 s: Eli theme', after1.theme ? after1.theme.value : '(unset)');
  log('1. server after 35 s: f260.done has iPad ticks?', { t1: !!(after1.done && after1.done.value && after1.done.value[t1]), t2: !!(after1.done && after1.done.value && after1.done.value[t2]) });
  const q1 = await lsQueues();
  log('1. iPad localStorage queues while Ezra is signed in', Object.fromEntries(Object.entries(q1).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([kk, vv]) => [kk, kk === 'f260.done' ? doneIds(vv.value) : kk === 'theme' ? vv.value : '…'] ))])));

  // Eli's phone opens the hub: what does it see?
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const pf = await phone.openApp('f260', { wait: '#todayDone' });
  await pf.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(1500);
  const phoneSees = await pf.evaluate(() => ({ theme: document.documentElement.dataset.theme || '(hearth/system)', done: Object.keys(hub.get('f260.done') || {}).sort(), next: document.getElementById('todayDone').dataset.target }));
  log('1. Eli phone: theme / next reading offered', { theme: phoneSees.theme, next: phoneSees.next, hasT1: phoneSees.done.includes(t1), hasT2: phoneSees.done.includes(t2) });
  await phone.page.screenshot({ path: path.join(OUT, 'verify2-stranded-2-eli-phone-f260.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  // ── 2. The phone ticks its next reading (Eli thinks he is behind), then Eli signs back in on the iPad ──
  await pf.click('#todayDone'); await sleep(1500);
  await pf.evaluate(() => hub.flush()); await sleep(800);
  const afterPhone = await srv('f260', 'f260.done');
  log('2. server after the phone ticked ' + phoneSees.next, { done: doneIds(afterPhone.value), updated_at: afterPhone.updated_at });
  await phone.close();
  // give Eli a PIN the script knows (admin reset kills Eli's sessions, so the phone's device mints the new one)
  await L.apiAs(null, '/api/admin/profiles/eli/reset-pin', { method: 'POST', body: {}, deviceToken: ph.device.token, profileToken: eliTok });
  const np = await L.apiAs(null, '/api/profiles/eli/pin', { method: 'POST', body: { pin: ELI_PIN }, deviceToken: ph.device.token, profileToken: null });
  eliTok = np.body.profile_token;
  log('2. setup: Eli PIN reset + recreated (for the script only)', String(np.status));
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#switch'); await page.click('#switch');
  await page.waitForSelector('#profiles .pcard[data-id="eli"]'); await page.click('#profiles .pcard[data-id="eli"]');
  await page.waitForSelector('#pad');
  for (const d of ELI_PIN) await page.click(`#pad [data-d="${d}"]`);
  await page.click('#pingo');
  await waitShell('eli'); await waitPull(0).catch(() => {}); await sleep(4000);
  const back = { theme: await srv('hub', 'theme'), done: await srv('f260', 'f260.done') };
  log('2. Eli back on the iPad: server theme', back.theme ? back.theme.value : '(unset)');
  log('2. Eli back on the iPad: server f260.done', { ids: doneIds(back.done.value), t1: !!back.done.value[t1], t2: !!back.done.value[t2], updated_at: back.done.updated_at });
  log('2. Eli back on the iPad: iPad f260.done / queues', { ipadDone: await page.evaluate(() => Object.keys(hub.get('f260.done', { app: 'f260', scope: 'person' }) || {}).sort()), queues: Object.keys(await lsQueues()) });

  // ── 3. Flaky Wi-Fi: navigator.onLine stays true, requests to the API fail ──
  const flaky = u => u.href.startsWith(L.api);
  await page.context().route(flaky, r => r.abort('failed'));
  await page.click('.tab[data-tab="me"]'); await page.waitForSelector('#theme [data-theme="frost"]');
  await page.click('#theme [data-theme="frost"]'); await sleep(1200);
  log('3. flaky: Eli picked Frost, hub.sync', await page.evaluate(() => ({ onLine: navigator.onLine, state: hub.sync.state, pending: hub.sync.pending })));
  await page.click('#switch'); await page.waitForSelector('#profiles .pcard[data-id="ezra"]', { timeout: 15000 });
  await page.context().unroute(flaky); await sleep(300);
  await page.click('#profiles .pcard[data-id="ezra"]'); await waitShell('ezra'); await sleep(12000);
  const t3 = await srv('hub', 'theme');
  log('3. flaky: server Eli theme 12 s after Ezra signed in', t3 ? t3.value : '(unset)');
  log('3. flaky: iPad queues', Object.fromEntries(Object.entries(await lsQueues()).map(([k, v]) => [k, Object.keys(v)])));
  fs.writeFileSync(path.join(OUT, 'verify2-stranded.json'), JSON.stringify(R, null, 1));
  console.log('logs:', ipad.logs.filter(l => /error/i.test(l)).slice(-8));
} finally { await L.close(); }
