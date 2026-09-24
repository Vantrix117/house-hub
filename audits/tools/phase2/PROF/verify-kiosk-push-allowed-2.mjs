// PROF skeptic #2 for "kiosk-push-allowed": can the display profile (tv, kind kiosk) register and test push on the server,
// and does that give it anything a PIN-less kid tap on the same paired device does not already give?
//
//   node "audits/tools/phase2/PROF/verify-kiosk-push-allowed-2.mjs"
//
// Local rig only (real worker/src on in-memory SQLite, throwaway VAPID pair). A local HTTP receiver on 127.0.0.1 stands in
// for the push service so we can see whether the Worker actually POSTs to the kiosk's endpoint.
// Writes audits/evidence/p2/PROF/verify-kiosk-push-allowed-2.json.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { local, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const say = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); log.push(s); console.log(s); };

// stand-in push service: records every POST by path
const hits = [];
const recv = http.createServer((req, res) => { let n = 0; req.on('data', d => n += d.length); req.on('end', () => { hits.push({ path: req.url, bytes: n, auth: (req.headers.authorization || '').slice(0, 12), at: Date.now() }); res.writeHead(201); res.end(); }); });
await new Promise(r => recv.listen(0, '127.0.0.1', r));
const RP = recv.address().port;
const keys = async () => {
  const k = await crypto.webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return { p256dh: Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', k.publicKey)).toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') };
};
const hitsFor = p => hits.filter(h => h.path === p).length;

const L = await local({ variant: 'typical', clock: 'real', vapid: true });
const result = {};
try {
  const call = async (who, method, p, body, opts = {}) => {
    const r = await L.apiAs(who, p, { method, body, ...opts });
    say(`${String(who || '(device only)').padEnd(14)} ${method.padEnd(6)} ${p.padEnd(40)} → ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
    return r;
  };

  say('── 0. who is tv ──');
  const me = await call('tv', 'GET', '/api/me');
  result.tvKind = me.body.profile && me.body.profile.kind;

  say('\n── 1. baseline: the kiosk is refused a data write ──');
  const w = await call('tv', 'PUT', '/api/data/reminders/item:tv-probe?scope=family', { value: { text: 'probe' }, updated_at: Date.now() });
  result.tvDataWrite = w.status;

  say('\n── 2. no profile token: refused ──');
  const dev = await call(null, 'POST', '/api/push/subscribe', { subscription: { endpoint: `http://127.0.0.1:${RP}/device-only`, keys: await keys() } });
  result.deviceOnlySubscribe = dev.status;

  say('\n── 3. kiosk subscribes, tests, and the Worker delivers ──');
  const s = await call('tv', 'POST', '/api/push/subscribe', { subscription: { endpoint: `http://127.0.0.1:${RP}/tv`, keys: await keys() } });
  const t = await call('tv', 'POST', '/api/push/test', {});
  result.tvSubscribe = s.status; result.tvTest = { status: t.status, sent: t.body.sent, ok: t.body.ok };
  result.tvHitsAfterTest = hitsFor('/tv');
  say('receiver hits on /tv after the kiosk test:', hitsFor('/tv'));

  say('\n── 4. the same thing as a PIN-less kid tap on the same paired device ──');
  const ks = await call('ezra', 'POST', '/api/push/subscribe', { subscription: { endpoint: `http://127.0.0.1:${RP}/ezra`, keys: await keys() } });
  const kt = await call('ezra', 'POST', '/api/push/test', {});
  result.kidSubscribe = ks.status; result.kidTest = { status: kt.status, sent: kt.body.sent, ok: kt.body.ok };
  result.kidHitsAfterTest = hitsFor('/ezra');
  say('receiver hits on /ezra after the kid test:', hitsFor('/ezra'));

  say('\n── 5. kiosk cannot target anyone else ──');
  const other = await call('tv', 'POST', '/api/push/test', { profile_id: 'mom' });
  result.tvTestOther = other.status;

  say('\n── 6. what the server now holds (admin usage) ──');
  const u = await call('eli', 'GET', '/api/admin/usage');
  result.subs = u.body.push_subscriptions;
  result.pushLogTv = (u.body.push || []).filter(r => r.profile_id === 'tv');
  say('push_subscriptions:', u.body.push_subscriptions);
  say('push_log rows for tv:', result.pushLogTv);

  say('\n── 7. does any scheduled job ever reach the kiosk subscription? (every job forced as the admin) ──');
  const before = hitsFor('/tv');
  const jobs = {};
  for (const job of ['morning', 'evening', 'behind', 'prayer', 'park']) {
    const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job } });
    const b = r.body || {};
    const names = x => (x || []).map(n => n.profile);
    jobs[job] = { status: r.status, notified: names(b.notified), skipped: (b.skipped || []).map(n => n.profile + ':' + n.why) };
    say(`job ${job.padEnd(8)} → ${r.status} notified=${JSON.stringify(jobs[job].notified)} skipped=${JSON.stringify(jobs[job].skipped).slice(0, 160)}`);
  }
  result.jobs = jobs;
  result.tvHitsFromJobs = hitsFor('/tv') - before;
  say('receiver hits on /tv from the five jobs:', result.tvHitsFromJobs);

  say('\n── 8. kiosk unsubscribes ──');
  const d = await call('tv', 'DELETE', '/api/push/subscribe');
  result.tvDelete = d.status;
  const u2 = await L.apiAs('eli', '/api/admin/usage');
  result.subsAfterDelete = u2.body.push_subscriptions;
  say('push_subscriptions after the kiosk DELETE:', u2.body.push_subscriptions);

  say('\n── 9. the TV UI: is the Notifications card rendered for the kiosk? ──');
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  await tv.goto('#me');
  await tv.page.waitForTimeout(1500);
  result.ui = await tv.page.evaluate(() => ({ kind: document.documentElement.dataset.kind, notifCard: !!document.querySelector('#notif'), notifToggle: !!document.querySelector('#notif-toggle') }));
  say('TV #me:', result.ui);
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-kiosk-push-allowed-2.json'), JSON.stringify({ result, hits, log }, null, 2));
  await L.close();
  recv.close();
}
