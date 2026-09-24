// PROF skeptic #1 (audit Phase 2): can the display (kiosk) profile register / test / delete a push subscription?
// Runs only against the rig's local Worker (real worker/src on in-memory SQLite) with a throwaway VAPID pair and a
// local HTTP receiver on 127.0.0.1 standing in for the push service. Nothing touches production.
//
//   node "audits/tools/phase2/PROF/verify-kiosk-push-allowed-1.mjs"
//
// Prints each call's status/body, the admin usage view of push_subscriptions, and whether the receiver got a POST.
// Also: the same calls as a kid (ezra), and a real app_data write as the kiosk, for comparison.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { local, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });

// local stand-in push service: records every POST it receives
const hits = [];
const recv = http.createServer((req, res) => { let n = 0; req.on('data', c => n += c.length); req.on('end', () => { hits.push({ url: req.url, method: req.method, bytes: n, ttl: req.headers.ttl, urgency: req.headers.urgency, hasVapid: /^vapid /i.test(req.headers.authorization || '') }); res.writeHead(201); res.end(); }); });
await new Promise(r => recv.listen(0, '127.0.0.1', r));
const port = recv.address().port;

// a structurally valid browser subscription (P-256 public key + 16-byte auth secret), so the Worker can encrypt to it
const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
const sub = who => ({ endpoint: `http://127.0.0.1:${port}/push/${who}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } });

const L = await local({ variant: 'typical', clock: 'real', vapid: true });
const log = [];
const rec = (label, r) => { const line = `${label.padEnd(52)} → ${r.status} ${JSON.stringify(r.body)}`; console.log(line); log.push(line); return r; };
try {
  const me = await L.apiAs('tv', '/api/me');
  rec('tv   GET  /api/me', { status: me.status, body: { id: me.body.profile && me.body.profile.id, kind: me.body.profile && me.body.profile.kind } });

  // control: an ordinary write as the kiosk is refused
  rec('tv   PUT  /api/data/leftovers/item:kx (family)', await L.apiAs('tv', '/api/data/leftovers/item:kx?scope=family', { method: 'PUT', body: { value: { name: 'x' }, updated_at: Date.now() } }));
  rec('tv   POST /api/chat', await L.apiAs('tv', '/api/chat', { method: 'POST', body: { messages: [{ role: 'user', content: 'hi' }] } }));

  const cfg = rec('tv   GET  /api/push/config', await L.apiAs('tv', '/api/push/config'));
  rec('tv   POST /api/push/subscribe', await L.apiAs('tv', '/api/push/subscribe', { method: 'POST', body: { subscription: sub('tv') } }));
  const u1 = await L.apiAs('eli', '/api/admin/usage');
  rec('eli  GET  /api/admin/usage → push_subscriptions', { status: u1.status, body: u1.body.push_subscriptions });
  rec('tv   POST /api/push/test', await L.apiAs('tv', '/api/push/test', { method: 'POST', body: {} }));
  await new Promise(r => setTimeout(r, 300));
  console.log('receiver hits after tv test:', JSON.stringify(hits)); log.push('receiver hits after tv test: ' + JSON.stringify(hits));
  rec('tv   POST /api/push/test {profile_id:"eli"}', await L.apiAs('tv', '/api/push/test', { method: 'POST', body: { profile_id: 'eli' } }));
  rec('tv   DELETE /api/push/subscribe', await L.apiAs('tv', '/api/push/subscribe', { method: 'DELETE' }));
  const u2 = await L.apiAs('eli', '/api/admin/usage');
  rec('eli  GET  /api/admin/usage → push_subscriptions', { status: u2.status, body: u2.body.push_subscriptions });

  // comparison: a kid (also PIN-less, also opens on tap) gets the same treatment
  rec('ezra POST /api/push/subscribe', await L.apiAs('ezra', '/api/push/subscribe', { method: 'POST', body: { subscription: sub('ezra') } }));
  rec('ezra DELETE /api/push/subscribe', await L.apiAs('ezra', '/api/push/subscribe', { method: 'DELETE' }));
  // device token only (no profile) is refused
  rec('(device only) POST /api/push/subscribe', await L.apiAs(null, '/api/push/subscribe', { method: 'POST', body: { subscription: sub('none') } }));

  fs.writeFileSync(path.join(OUT, 'verify-kiosk-push-allowed-1.txt'), log.join('\n') + '\n');
  console.log('\nwrote audits/evidence/p2/PROF/verify-kiosk-push-allowed-1.txt; vapid enabled =', cfg.body.enabled);
} finally {
  await L.close();
  recv.close();
}
