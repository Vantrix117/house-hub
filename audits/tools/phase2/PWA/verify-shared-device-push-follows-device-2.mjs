// Phase 2 / PWA — skeptic #2 for finding "shared-device-push-follows-device".
//   node "audits/tools/phase2/PWA/verify-shared-device-push-follows-device-2.mjs"
// Independent of push.mjs / standalone.mjs. Everything local (rig Worker on in-memory SQLite + scripts/push-receiver.mjs).
//
// Why an https stand-in: index.html:1532 pushSupported() requires location.protocol === 'https:', and the rig serves
// http://127.0.0.1, so the Me → Notifications switch never renders its toggle there. This script loads the real
// index.html/apps from the rig through Playwright routes under https://hub.test (Chromium), proxies
// https://hub.test/__api/* to the rig Worker (same origin, no CORS), and replaces ONLY the browser's push plumbing:
//   ServiceWorkerContainer.ready → a fake registration whose pushManager keeps ONE subscription per origin in
//   localStorage 'rig.pushsub' (the browser fact the claim rests on: a PushSubscription belongs to the origin's service
//   worker registration, not to a hub profile), Notification.permission = 'granted'.
// The fake subscription's endpoint is the local receiver (/push/kitchen-ipad), so the Worker's real pushTo() delivers
// to it and the receiver decrypts what arrived.
// Steps: Eli turns notifications on in Me (real click) → Me → Switch (real click; POST /api/logout) → server rows →
// forced 'evening' job + admin test push to Eli (from Eli's phone) → Mom signs in on the same iPad → her Me switch
// state/help → her "Send a test notification" toast → Mom turns the switch off → server rows → tap routing of the
// f260 push while Mom / Ezra are signed in (the exact message sw.js:62-69 posts).
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

// push receiver
const rxPort = await freePort();
const rx = spawn(process.execPath, [path.join(ROOT, 'scripts/push-receiver.mjs'), String(rxPort)], { stdio: ['ignore', 'pipe', 'pipe'] });
let baseSub = null; const pushes = []; let rxBuf = '';
rx.stdout.on('data', d => {
  rxBuf += d; let i;
  while ((i = rxBuf.indexOf('\n')) >= 0) {
    const line = rxBuf.slice(0, i).trim(); rxBuf = rxBuf.slice(i + 1);
    if (line.startsWith('SUBSCRIPTION ')) baseSub = JSON.parse(line.slice(13));
    const m = /^PUSH #(\d+) url=(\S+) vapid=(\S+) ttl=(\S+) urgency=(\S+) enc=(\S+) payload=(.*)$/.exec(line);
    if (m) { let p; try { p = JSON.parse(m[7]); } catch { p = m[7]; } pushes.push({ to: m[2].split('/').pop(), vapid: m[3], title: p.title, body: p.body, url: p.url }); }
  }
});
for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
if (!baseSub) throw new Error('push receiver did not start');
const KITCHEN_SUB = { ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/kitchen-ipad` };
let mark = 0; const newPushes = async () => { await sleep(800); const n = pushes.slice(mark); mark = pushes.length; return n; };

const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium', vapid: true });
const ORIGIN = 'https://hub.test';
try {
  const S = L.S;
  const phone = await L.newDevice({ name: "Eli's phone (v2)", profiles: ['eli'] });
  const asPhone = { deviceToken: phone.device.token, profileToken: phone.sessions.eli };
  const rows = async () => {   // every push row, straight from the admin usage route (called from Eli's phone)
    const u = await L.apiAs('eli', '/api/admin/usage', asPhone);
    return u.body.push_subscriptions;
  };
  say('push_subscriptions before anything (seed)', await rows());

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
      if (location.origin === c.origin && !localStorage.getItem('v2.init')) {
        localStorage.setItem('hub.api', JSON.stringify(c.origin + '/__api'));
        localStorage.setItem('hub.device', JSON.stringify(c.device));
        localStorage.setItem('hub.session', JSON.stringify(c.session));
        localStorage.setItem('hub.profiles', JSON.stringify(c.profiles));
        localStorage.setItem('hub.lastProfile', JSON.stringify('eli'));
        localStorage.setItem('v2.init', '1');
      }
      // the browser's push plumbing: one subscription per origin (survives any hub profile switch)
      const KEY = 'rig.pushsub';
      const mk = j => ({ endpoint: j.endpoint, options: {}, toJSON: () => j, unsubscribe: async () => { localStorage.removeItem(KEY); localStorage.setItem('rig.unsubscribed', j.endpoint); return true; } });
      const pm = {
        getSubscription: async () => { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j ? mk(j) : null; },
        subscribe: async () => { localStorage.setItem(KEY, JSON.stringify(c.sub)); return mk(c.sub); },
      };
      const reg = { pushManager: pm, showNotification: async () => {} };
      Object.defineProperty(ServiceWorkerContainer.prototype, 'ready', { get: () => Promise.resolve(reg), configurable: true });
      Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true });
      Notification.requestPermission = async () => 'granted';
    } catch (e) { console.log('init error ' + e.message); }
  }, { origin: ORIGIN, device: S.info.device, session: S.sessions.eli, profiles: S.profiles, sub: KITCHEN_SUB });
  const page = await ctx.newPage();
  const cl = []; page.on('console', m => cl.push(m.type() + ': ' + m.text())); page.on('pageerror', e => cl.push('pageerror: ' + e.message));
  const notifState = async () => { await page.waitForFunction(() => { const h = document.getElementById('notif-help'); return h && h.textContent !== 'Checking…'; }, null, { timeout: 10000 }).catch(() => {});
    return page.evaluate(() => ({ signedInAs: hub.profile && hub.profile.id, toggleChecked: document.getElementById('notif-toggle').getAttribute('aria-checked'), toggleDisabled: document.getElementById('notif-toggle').disabled, help: document.getElementById('notif-help').textContent, prefsVisible: !document.getElementById('notif-prefs').hidden, browserSub: localStorage.getItem('rig.pushsub') ? JSON.parse(localStorage.getItem('rig.pushsub')).endpoint.split('/').pop() : null })); };
  const toastText = async () => { await sleep(900); return page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; }); };

  // 1. Eli on the Kitchen iPad: Me → Notifications on (real click)
  await page.goto(ORIGIN + '/index.html#me', { waitUntil: 'load' }); await sleep(1500);
  say('1a. Eli opens Me on the Kitchen iPad (https stand-in)', { protocol: await page.evaluate(() => location.protocol), ...(await notifState()) });
  await page.click('#notif-toggle'); await sleep(1200);
  say('1b. Eli taps the switch on', { toast: await toastText(), ...(await notifState()), serverRows: await rows() });

  // 2. Me → Switch (real click): hub.signOut → POST /api/logout → picker
  await page.click('#switch'); await sleep(1500);
  const me = await L.apiAs('eli', '/api/me');   // the Kitchen iPad's Eli token after logout
  say('2. Eli taps Me → Switch', { pickerShown: await page.evaluate(() => !document.getElementById('gate').hidden), hubSession: await page.evaluate(() => localStorage.getItem('hub.session')), eliTokenAfter: me.status + ' ' + (me.body.error || ''), serverRows: await rows(), browserSubStill: await page.evaluate(() => localStorage.getItem('rig.pushsub') ? 'yes' : 'no') });

  // 3. pushes meant for Eli after he left the iPad
  const test = await L.apiAs('eli', '/api/push/test', { method: 'POST', body: { profile_id: 'eli' }, ...asPhone });
  say('3a. admin test push to Eli (sent from his phone) after he switched out on the iPad', { status: test.status, sent: test.body.sent, ok: test.body.ok, received: await newPushes() });
  await L.clock('2026-09-22T20:00:30-04:00');
  const ev = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'evening' }, ...asPhone });
  say('3b. forced 8 pm evening job (F260 nudge)', { status: ev.status, notified: (ev.body.notified || []).map(n => `${n.profile}(sent ${n.sent}, ok ${n.ok})`), skipped: (ev.body.skipped || []).map(s => `${s.profile}:${s.why}`), received: await newPushes() });

  // 4. Mom signs in on the same iPad (her Kitchen-iPad session, as a PIN login would leave it)
  await page.evaluate(s => { localStorage.setItem('hub.session', JSON.stringify(s)); localStorage.setItem('hub.lastProfile', JSON.stringify('mom')); }, S.sessions.mom);
  await page.goto('about:blank'); await page.goto(ORIGIN + '/index.html#me', { waitUntil: 'load' }); await sleep(1500);
  const momMe = await L.apiAs('mom', '/api/me');
  say('4-debug', { momMe: momMe.status + ' ' + (momMe.body.error || (momMe.body.profile && momMe.body.profile.id)), ls: await page.evaluate(() => localStorage.getItem('hub.session')), gate: await page.evaluate(() => !document.getElementById('gate').hidden), consoleTail: cl.slice(-8) });
  const rowsMom = await rows();
  say('4a. Mom signed in on the Kitchen iPad → Me → Notifications', { ...(await notifState()), serverRows: rowsMom, momHasRow: rowsMom.some(r => r.profile_id === 'mom') });
  if (!(await page.isVisible('#notif-test'))) throw new Error('Mom not signed in');
  await page.click('#notif-test');
  say('4b. Mom taps "Send a test notification"', { toast: await toastText(), received: await newPushes() });

  // 5. Mom taps the switch off
  await page.click('#notif-toggle'); await sleep(1200);
  say('5. Mom taps the switch off', { toast: await toastText(), ...(await notifState()), browserUnsubscribed: await page.evaluate(() => localStorage.getItem('rig.unsubscribed')), serverRows: await rows() });
  const test2 = await L.apiAs('eli', '/api/push/test', { method: 'POST', body: { profile_id: 'eli' }, ...asPhone });
  say('5b. push to Eli after Mom turned it off (the receiver cannot emulate a real push service rejecting the unsubscribed endpoint)', { sent: test2.body.sent, ok: test2.body.ok, received: await newPushes() });

  // 6. tap routing: the exact message sw.js notificationclick posts to an open hub window, for Eli's '#f260' nudge
  const tap = async hash => {
    await page.goto('about:blank'); await page.goto(ORIGIN + '/index.html#home', { waitUntil: 'load' }); await sleep(1500);   // about:blank first: same-URL goto with a hash is only a fragment navigation
    await page.evaluate(h => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { source: 'hubsw', type: 'open', url: location.origin + '/index.html' + h } })), hash);
    await sleep(700); const toast = await page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
    await sleep(1500);
    const f = page.frames().find(x => /\/apps\/f260\.html/.test(x.url()));
    return { hash: await page.evaluate(() => location.hash), signedInAs: await page.evaluate(() => hub.profile && hub.profile.id), appFrame: f ? 'f260' : null, appProfile: f ? await f.evaluate(() => window.hub && hub.profile && hub.profile.id).catch(() => null) : null, toast };
  };
  say('6a. Mom signed in, tap on Eli\'s F260 nudge (#f260)', await tap('#f260'));
  await page.evaluate(s => { localStorage.setItem('hub.session', JSON.stringify(s)); }, S.sessions.ezra);
  say('6b. Ezra signed in, tap on Eli\'s F260 nudge (#f260)', await tap('#f260'));
  await page.screenshot({ path: path.join(OUT, 'verify2-shared-push-tap-ezra.png'), scale: 'css' });

  say('console (errors only)', cl.filter(l => /error/i.test(l)).slice(0, 10));
  fs.writeFileSync(path.join(OUT, 'verify-shared-device-push-follows-device-2.json'), JSON.stringify(log, null, 1));
  await ctx.close();
} finally {
  await L.close(); rx.kill();
}
