// Phase 2 / PWA — skeptic #2 for finding "test-button-counts-all-devices".
//   node "audits/tools/phase2/PWA/verify-test-button-counts-all-devices-2.mjs"
// Independent of push.mjs. Everything local (rig Worker on in-memory SQLite + scripts/push-receiver.mjs as the push service).
//
// The investigator called POST /api/push/test straight from the API. In the real Me card the "Send a test notification"
// button sits inside #notif-prefs, which is hidden unless THIS browser already holds a PushSubscription
// (index.html:1263-1270, 1553 prefsEl.hidden = !sub). So the question is whether a real tap can reach the case at all.
// Two UI-reachable paths are tried, both with real clicks in the real index.html:
//   A. Shared Kitchen iPad: Eli turned notifications on there (browser sub + server row eli/ipad). Mom has notifications on
//      only on her own phone. Mom signs in on the iPad → Me shows "On for this device" (the browser sub is the origin's,
//      not Mom's) → she taps "Send a test notification".
//   B. Eli has notifications on on the iPad AND on his phone; the iPad's server row points at a push endpoint that fails
//      (closed port — stands in for a push service refusing / an expired endpoint). Eli taps the test on the iPad.
// https stand-in (same as verify-shared-device-push-follows-device-2.mjs): index.html:1532 pushSupported() needs https,
// so the rig's pages are served under https://hub.test through Playwright routes (Chromium), /__api/* is proxied to the
// rig Worker, and ONLY the browser push plumbing is replaced (one PushSubscription per origin kept in localStorage).
import { local, sleep } from '../../lib/local.mjs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const log = [];
const say = (k, v) => { log.push({ step: k, v }); console.log('\n== ' + k + '\n' + (typeof v === 'string' ? v : JSON.stringify(v, null, 1))); };

const rxPort = await freePort();
const rx = spawn(process.execPath, [path.join(ROOT, 'scripts/push-receiver.mjs'), String(rxPort)], { stdio: ['ignore', 'pipe', 'pipe'] });
let baseSub = null; const pushes = []; let rxBuf = '';
rx.stdout.on('data', d => {
  rxBuf += d; let i;
  while ((i = rxBuf.indexOf('\n')) >= 0) {
    const line = rxBuf.slice(0, i).trim(); rxBuf = rxBuf.slice(i + 1);
    if (line.startsWith('SUBSCRIPTION ')) baseSub = JSON.parse(line.slice(13));
    const m = /^PUSH #(\d+) url=(\S+) vapid=(\S+) ttl=(\S+) urgency=(\S+) enc=(\S+) payload=(.*)$/.exec(line);
    if (m) { let p; try { p = JSON.parse(m[7]); } catch { p = m[7]; } pushes.push({ to: m[2].split('/').pop(), title: p.title, body: p.body }); }
  }
});
for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
if (!baseSub) throw new Error('push receiver did not start');
const subAt = name => ({ ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/${name}` });
let mark = 0; const newPushes = async () => { await sleep(900); const n = pushes.slice(mark); mark = pushes.length; return n; };

const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium', vapid: true });
const ORIGIN = 'https://hub.test';
try {
  const S = L.S;
  const elisPhone = await L.newDevice({ name: "Eli's phone (skeptic 2)", profiles: ['eli'] });
  const momsPhone = await L.newDevice({ name: "Mom's phone (skeptic 2)", profiles: ['mom'] });
  const asEliPhone = { deviceToken: elisPhone.device.token, profileToken: elisPhone.sessions.eli };
  const asMomPhone = { deviceToken: momsPhone.device.token, profileToken: momsPhone.sessions.mom };
  const rows = async () => (await L.apiAs('eli', '/api/admin/usage', asEliPhone)).body.push_subscriptions;
  const devs = async () => (await L.apiAs('eli', '/api/admin/usage', asEliPhone)).body.devices.map(d => d.name);
  say('0. seed: push rows / paired devices', { rows: await rows(), devices: await devs(), kitchenIpadDeviceId: S.info.device.id });

  // Mom: notifications on ONLY on her own phone
  const mp = await L.apiAs('mom', '/api/push/subscribe', { method: 'POST', body: { subscription: subAt('mom-phone') }, ...asMomPhone });
  say('0b. Mom turns notifications on on her own phone (POST /api/push/subscribe from that device)', { status: mp.status, rows: await rows() });

  const ctx = await L.browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('https://house-hub-api.catalystfarm1.workers.dev/**', r => r.abort());
  await ctx.route(ORIGIN + '/**', async route => {
    const req = route.request(); const u = new URL(req.url());
    const target = u.pathname.startsWith('/__api/') ? L.api + u.pathname.slice(6) + u.search : L.site + u.pathname + u.search;
    const h = { ...req.headers() }; delete h.host; delete h['accept-encoding'];
    if (u.pathname.startsWith('/__api/')) h.origin = L.site;
    const r = await fetch(target, { method: req.method(), headers: h, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer() || undefined });
    const rh = Object.fromEntries(r.headers); delete rh['content-encoding']; delete rh['content-length']; delete rh['transfer-encoding'];
    await route.fulfill({ status: r.status, headers: rh, body: Buffer.from(await r.arrayBuffer()) });
  });
  await ctx.addInitScript(c => {
    try {
      if (location.origin !== c.origin) return;
      if (!localStorage.getItem('sk2.init')) {
        localStorage.setItem('hub.api', JSON.stringify(c.origin + '/__api'));
        localStorage.setItem('hub.device', JSON.stringify(c.device));
        localStorage.setItem('hub.session', JSON.stringify(c.session));
        localStorage.setItem('hub.profiles', JSON.stringify(c.profiles));
        localStorage.setItem('hub.lastProfile', JSON.stringify('eli'));
        localStorage.setItem('sk2.init', '1');
      }
      const KEY = 'rig.pushsub';   // one PushSubscription per origin, whoever is signed in to the hub
      const mk = j => ({ endpoint: j.endpoint, options: {}, toJSON: () => j, unsubscribe: async () => { localStorage.removeItem(KEY); return true; } });
      const pm = {
        getSubscription: async () => { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j ? mk(j) : null; },
        subscribe: async () => { localStorage.setItem(KEY, JSON.stringify(c.sub)); return mk(c.sub); },
      };
      const reg = { pushManager: pm, showNotification: async () => {} };
      Object.defineProperty(ServiceWorkerContainer.prototype, 'ready', { get: () => Promise.resolve(reg), configurable: true });
      Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true });
      Notification.requestPermission = async () => 'granted';
    } catch (e) { console.log('init error ' + e.message); }
  }, { origin: ORIGIN, device: S.info.device, session: S.sessions.eli, profiles: S.profiles, sub: subAt('kitchen-ipad') });
  const page = await ctx.newPage();
  const cl = []; page.on('console', m => cl.push(m.type() + ': ' + m.text())); page.on('pageerror', e => cl.push('pageerror: ' + e.message));
  const notifState = async () => {
    await page.waitForFunction(() => { const h = document.getElementById('notif-help'); return h && h.textContent !== 'Checking…'; }, null, { timeout: 10000 }).catch(() => {});
    return page.evaluate(() => ({ signedInAs: hub.profile && hub.profile.id, switchOn: document.getElementById('notif-toggle').getAttribute('aria-checked'), help: document.getElementById('notif-help').textContent, testButtonVisible: !document.getElementById('notif-prefs').hidden, browserSub: localStorage.getItem('rig.pushsub') ? JSON.parse(localStorage.getItem('rig.pushsub')).endpoint.split('/').pop() : null }));
  };
  const toastText = async () => { await sleep(1000); return page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; }); };
  const signInOnIpad = async pid => {
    await page.evaluate(([s, p]) => { localStorage.setItem('hub.session', JSON.stringify(s)); localStorage.setItem('hub.lastProfile', JSON.stringify(p)); }, [S.sessions[pid], pid]);
    await page.goto('about:blank'); await page.goto(ORIGIN + '/index.html#me', { waitUntil: 'load' }); await sleep(1500);
  };

  // Control: Mom on the iPad, nobody has turned notifications on in this browser yet → is the test button reachable?
  await page.goto(ORIGIN + '/index.html#me', { waitUntil: 'load' }); await sleep(800);
  await signInOnIpad('mom');
  say('C. control — Mom on the Kitchen iPad, this browser has no PushSubscription', await notifState());

  // A. Eli turns notifications on on the iPad (real click), then Mom signs in there and taps the test
  await signInOnIpad('eli');
  await page.click('#notif-toggle'); await sleep(1200);
  say('A1. Eli taps Notifications on, on the Kitchen iPad', { toast: await toastText(), ...(await notifState()), rows: await rows() });
  await signInOnIpad('mom');
  say('A2. Mom signs in on the Kitchen iPad → Me → Notifications', { ...(await notifState()), rows: await rows() });
  await page.click('#notif-test');
  const tA = await toastText();
  const rA = await newPushes();
  say('A3. Mom taps "Send a test notification" on the Kitchen iPad', { toast: tA, deliveredTo: rA });
  await page.screenshot({ path: path.join(OUT, 'verify-test-button-counts-all-devices-2-A.png'), scale: 'css' });

  // B. Eli, subscribed on the iPad and on his phone; the iPad's endpoint fails; Eli taps the test on the iPad
  const closed = await freePort();
  await L.apiAs('eli', '/api/push/subscribe', { method: 'POST', body: { subscription: subAt('eli-phone') }, ...asEliPhone });
  await L.apiAs('eli', '/api/push/subscribe', { method: 'POST', body: { subscription: { ...baseSub, endpoint: `http://127.0.0.1:${closed}/push/kitchen-ipad-dead` } } });
  await signInOnIpad('eli');
  say('B1. Eli on the iPad: server rows (iPad row → unreachable endpoint, phone row ok)', { ...(await notifState()), rows: await rows() });
  const direct = await L.apiAs('eli', '/api/push/test', { method: 'POST', body: {} });
  await newPushes();
  say('B2. what the route returns for the same call (raw, Kitchen iPad token)', direct.body);
  await page.click('#notif-test');
  const tB = await toastText();
  say('B3. Eli taps "Send a test notification" on the Kitchen iPad', { toast: tB, deliveredTo: await newPushes() });

  say('console (errors only)', cl.filter(l => /error/i.test(l) && !/ServiceWorkerContainer is not defined/.test(l)).slice(0, 10));
  fs.writeFileSync(path.join(OUT, 'verify-test-button-counts-all-devices-2.json'), JSON.stringify(log, null, 1));
  await ctx.close();
} finally {
  await L.close(); rx.kill();
}
