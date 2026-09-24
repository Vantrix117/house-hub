// Phase 2 / PWA — skeptic #1 for finding "shared-device-push-follows-device".
//   node "audits/tools/phase2/PWA/verify-shared-device-push-follows-device-1.mjs"
// One browser context = the Kitchen iPad (rig device, WebKit, ipad-portrait). Everything runs through the real shell UI
// (Me → Notifications toggle, Me → Switch, Me → Send a test notification) and the real Worker routes, with only these rig stubs:
//   * the stand-in push service scripts/push-receiver.mjs (every push the Worker sends is decrypted and logged by endpoint);
//   * the https gate in pushSupported() (index.html:1532, `location.protocol === 'https:'`) is relaxed for this page only by
//     rewriting that one comparison in the served index.html (the rig serves http://127.0.0.1);
//   * navigator.serviceWorker.ready / pushManager / Notification are stubbed. The stubbed PushSubscription lives in
//     localStorage 'rig.fakePushSub' — i.e. ONE per origin, exactly as a real PushSubscription belongs to the one
//     ServiceWorkerRegistration of the origin (sw.js scope), not to a hub profile.
// Mom's "sign-in" after Eli's Switch is done by putting the rig's existing Mom session for this same device into hub.session
// (what hub.login → hub.setSession stores after she types her PIN); the rig does not know the seeded PINs.
// Evidence: audits/evidence/p2/PWA/verify-shared-device-push-follows-device-1.json (+ one PNG of Mom's Me card).
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

// stand-in push service
const rxPort = await freePort();
const rx = spawn(process.execPath, [path.join(ROOT, 'scripts/push-receiver.mjs'), String(rxPort)], { stdio: ['ignore', 'pipe', 'pipe'] });
let baseSub = null; const pushes = []; let buf = '';
rx.stdout.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (line.startsWith('SUBSCRIPTION ')) baseSub = JSON.parse(line.slice(13));
    const m = /^PUSH #(\d+) url=(\S+) .*payload=(.*)$/.exec(line);
    if (m) { let p; try { p = JSON.parse(m[3]); } catch { p = m[3]; } pushes.push({ endpoint: m[2].split('/').pop(), title: p.title, body: p.body, url: p.url }); }
  }
});
for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
if (!baseSub) throw new Error('push receiver did not start');
let mark = 0;
const newPushes = async () => { await sleep(800); const n = pushes.slice(mark); mark = pushes.length; return n; };

const L = await local({ variant: 'typical', clock: 'demo', vapid: true });
const log = {};
const say = (k, v) => { log[k] = v; console.log('\n== ' + k + '\n' + JSON.stringify(v, null, 1)); };

try {
  const phone = await L.newDevice({ name: "Eli's phone (rig)", profiles: ['eli'] });   // admin calls once Eli has left the iPad
  const asPhone = { deviceToken: phone.device.token, profileToken: phone.sessions.eli };
  const kitchenSub = { ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/KITCHEN-IPAD` };

  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', localStorage: { 'rig.fakePushTemplate': kitchenSub } });
  // relax only the https gate of pushSupported()
  await ipad.ctx.route(u => new URL(u).pathname === '/index.html', async route => {
    const res = await route.fetch(); let body = await res.text();
    const gate = "'Notification' in window && location.protocol === 'https:';";
    if (!body.includes(gate)) throw new Error('gate text not found');
    body = body.replace(gate, "'Notification' in window && true /* rig: https gate relaxed */;");
    await route.fulfill({ response: res, body });
  });
  await ipad.ctx.addInitScript(() => {
    const K = 'rig.fakePushSub';
    const wrap = j => j && ({ endpoint: j.endpoint, toJSON: () => j, unsubscribe: async () => { localStorage.setItem('rig.unsubscribed', String((+localStorage.getItem('rig.unsubscribed') || 0) + 1)); localStorage.removeItem(K); return true; } });
    const pushManager = {
      getSubscription: async () => { const s = localStorage.getItem(K); return s ? wrap(JSON.parse(s)) : null; },
      subscribe: async () => { const j = JSON.parse(localStorage.getItem('rig.fakePushTemplate')); localStorage.setItem(K, JSON.stringify(j)); return wrap(j); },
    };
    const reg = { pushManager, addEventListener() {} };
    if (!('PushManager' in window)) window.PushManager = function PushManager() {};
    if (!('Notification' in window)) window.Notification = function Notification() {};
    try { Object.defineProperty(window.Notification, 'permission', { get: () => 'granted', configurable: true }); } catch {}
    window.Notification.requestPermission = async () => 'granted';
    if ('serviceWorker' in navigator) {
      try { Object.defineProperty(Object.getPrototypeOf(navigator.serviceWorker), 'ready', { get: () => Promise.resolve(reg), configurable: true }); } catch {}
    } else {
      const c = new EventTarget(); c.ready = Promise.resolve(reg); c.register = () => new Promise(() => {});
      Object.defineProperty(Navigator.prototype, 'serviceWorker', { get: () => c, configurable: true });
    }
  });

  const toast = () => ipad.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t ? t.textContent : null; });
  // a real document load (goto with only a new hash is a same-document navigation), signed in as `session`
  const loadAs = async (session, hash) => {
    await ipad.page.evaluate(s => { if (s) localStorage.setItem('hub.session', JSON.stringify(s)); }, session);
    await ipad.goto(hash); await ipad.page.reload({ waitUntil: 'load' }); await sleep(1500);
    return ipad.page.evaluate(() => window.hub && hub.profile && hub.profile.id);
  };
  const tapNudge = async hash => {
    await ipad.page.evaluate(h => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { source: 'hubsw', type: 'open', url: location.origin + '/index.html' + h } })), hash);
    await sleep(600);
    const t = await ipad.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden && getComputedStyle(t).opacity !== '0' ? t.textContent : null; });
    await sleep(2000);
    const f = ipad.frame(hash.slice(1));
    return { toastVisible: t, signedInAs: await ipad.page.evaluate(() => hub.profile && hub.profile.id), hash: await ipad.page.evaluate(() => location.hash), viewerOpen: await ipad.page.evaluate(() => document.getElementById('viewer').classList.contains('on')), appInViewer: await ipad.page.evaluate(() => document.getElementById('frame').dataset.id || null), appProfile: f ? await f.evaluate(() => window.hub && hub.profile && hub.profile.id).catch(e => 'err ' + e.message) : null };
  };
  const meState = async () => {
    await ipad.page.waitForFunction(() => { const t = document.getElementById('notif-toggle'); return t && !t.disabled; }, null, { timeout: 10000 });
    return ipad.page.evaluate(() => ({
      signedInAs: hub.profile && hub.profile.id,
      toggleAriaChecked: document.getElementById('notif-toggle').getAttribute('aria-checked'),
      help: document.getElementById('notif-help').textContent,
      prefsVisible: !document.getElementById('notif-prefs').hidden,
      browserSub: JSON.parse(localStorage.getItem('rig.fakePushSub') || 'null') && JSON.parse(localStorage.getItem('rig.fakePushSub')).endpoint.split('/').pop(),
    }));
  };
  const serverSubs = async () => (await L.apiAs('eli', '/api/admin/usage', asPhone)).body.push_subscriptions;

  // 0. baseline
  say('0. server push_subscriptions before (seeded)', await serverSubs());

  // 1. Eli on the Kitchen iPad turns notifications on through the real toggle
  await ipad.goto('#me');
  say('1a. Eli, Me → Notifications before', await meState());
  await ipad.page.click('#notif-toggle'); await sleep(1500);
  say('1b. Eli taps the toggle', { ...(await meState()), toast: await toast(), serverSubs: await serverSubs() });
  const t1 = await L.apiAs('eli', '/api/push/test', { method: 'POST', body: {} });
  say('1c. Eli: Send a test notification (API, Kitchen iPad session)', { sent: t1.body.sent, ok: t1.body.ok, received: await newPushes() });

  // 2. Me → Switch (the real button: hub.signOut → POST /api/logout → picker)
  await ipad.page.click('#switch'); await sleep(1500);
  const me = await L.apiAs('eli', '/api/me');
  say('2. Eli taps Me → Switch', {
    pickerShown: await ipad.page.evaluate(() => !!document.querySelector('.pcard[data-id]')),
    hubSession: await ipad.page.evaluate(() => localStorage.getItem('hub.session')),
    eliKitchenSessionAfter: me.status + ' ' + (me.body.error || ''),
    browserSubStillThere: await ipad.page.evaluate(() => !!localStorage.getItem('rig.fakePushSub')),
    serverSubs: await serverSubs(),
  });

  // 3. Eli's personal pushes after he left the iPad
  const t2 = await L.apiAs('eli', '/api/push/test', { method: 'POST', body: { profile_id: 'eli' }, ...asPhone });
  say('3a. admin test push to eli (from his phone) after the Switch', { sent: t2.body.sent, ok: t2.body.ok, received: await newPushes() });
  await L.clock('2026-09-22T20:00:00-04:00');
  const ev = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'evening' }, ...asPhone });
  say('3b. evening job (8 pm F260 nudge) after the Switch', { notified: (ev.body.notified || []).map(n => `${n.profile}(sent ${n.sent}, ok ${n.ok})`), skipped: (ev.body.skipped || []).map(s => `${s.profile}:${s.why}`), received: await newPushes() });
  const bh = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'behind' }, ...asPhone });
  say('3c. behind job (forced) after the Switch', { notified: (bh.body.notified || []).map(n => `${n.profile}(sent ${n.sent}, ok ${n.ok})`), skipped: (bh.body.skipped || []).map(s => `${s.profile}:${s.why}`), received: await newPushes() });

  // 4. Mom signs in on the same iPad (her rig session on this device) and opens Me
  const who4 = await loadAs(L.S.sessions.mom, '#me');
  const momMe = { loadedAs: who4, ...(await meState()) };
  const momMeShot = path.join(OUT, 'verify-shared-push-mom-me-ipad-portrait-light.png');
  await ipad.page.locator('#notif').scrollIntoViewIfNeeded();
  await ipad.page.locator('#notif').screenshot({ path: momMeShot, scale: 'css', animations: 'disabled' });
  const momSubsTest = await L.apiAs('mom', '/api/push/test', { method: 'POST', body: {} });
  say('4a. Mom, Me → Notifications on the same iPad', { ...momMe, shot: path.relative(ROOT, momMeShot).replace(/\\/g, '/'), momServerTest: { sent: momSubsTest.body.sent, ok: momSubsTest.body.ok }, received: await newPushes() });
  await ipad.page.click('#notif-test'); await sleep(1200);
  say('4b. Mom taps "Send a test notification"', { toast: await toast(), received: await newPushes() });

  // 5. tap routing: the message sw.js:67 posts for Eli's F260 nudge (url '#f260') while Mom is signed in
  await loadAs(null, '#home');
  say('5. Mom signed in on Home, Eli\'s F260 nudge tapped', await tapNudge('#f260'));

  // 6. Mom turns the switch "off"
  await loadAs(null, '#me'); await meState();
  await ipad.page.click('#notif-toggle'); await sleep(1500);
  const t3 = await L.apiAs('eli', '/api/push/test', { method: 'POST', body: { profile_id: 'eli' }, ...asPhone });
  say('6. Mom taps the toggle off', { ...(await meState()), toast: await toast(), unsubscribedCalls: await ipad.page.evaluate(() => localStorage.getItem('rig.unsubscribed')), serverSubs: await serverSubs(), eliRowsStillTargeted: { sent: t3.body.sent, details: t3.body.details } , note: 'the stand-in receiver still accepts KITCHEN-IPAD; a real push service would answer 410 for an unsubscribed endpoint and pushTo would prune the row (reminders.js:43)', received: await newPushes() });

  // 7. Ezra on the same iPad taps the same nudge
  await loadAs(L.S.sessions.ezra, '#home');
  say('7. Ezra signed in on Home, the F260 nudge tapped', await tapNudge('#f260'));
  say('page errors', ipad.logs.filter(l => /pageerror|error/i.test(l)).slice(0, 10));
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-shared-device-push-follows-device-1.json'), JSON.stringify(log, null, 1));
  console.log('\nwrote audits/evidence/p2/PWA/verify-shared-device-push-follows-device-1.json');
  await L.close(); rx.kill();
}
