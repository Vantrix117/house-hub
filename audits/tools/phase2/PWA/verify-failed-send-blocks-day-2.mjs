// Phase 2 / PWA — skeptic #2 for finding "failed-send-blocks-day".
//   node "audits/tools/phase2/PWA/verify-failed-send-blocks-day-2.mjs"
// Claim under test: a push that fails is written to push_log (ok 0) and the once-a-day gate ignores `ok`, so the
// 8 pm run "cannot retry it".
// Independent of push.mjs: Mea (niece) keeps ONE subscription all day whose push service is a small flaky proxy in
// front of scripts/push-receiver.mjs — it answers 503 while "down" and forwards to the receiver while "up" (a
// transient push-service outage, the subscription itself never changes). Everyone else points at the receiver.
//   A. prayer  — Fri 8 am run while Mea's service is down (new prayer P1)
//                Fri 8 pm run, service up, NO new prayer        → does anything retry P1 for Mea? (control)
//                Fri 8:01 pm run, service up, new prayer P2     → is Mea gated by the failed 8 am row?
//   B. park    — Sat 2 pm forced park run while down; Sat 8 pm forced park run, up, a kid still stale → Mea gated?
//   C. morning — Sun 8:00 am forced morning while down; 8:10 am the admin forces it again, up → Mea gated?
//   push_log is read back through GET /api/admin/usage (sends vs ok per profile/kind/day).
// Writes audits/evidence/p2/PWA/verify-failed-send-blocks-day-2.json.
import { local, sleep } from '../../lib/local.mjs';
import { spawn } from 'node:child_process';
import http from 'node:http';
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
    const m = /^PUSH #\d+ url=(\S+) .*payload=(.*)$/.exec(line);
    if (m) { let p; try { p = JSON.parse(m[2]); } catch { p = { body: m[2] }; } pushes.push({ to: m[1].split('/').pop(), body: p.body }); }
  }
});
for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
if (!baseSub) throw new Error('push receiver did not start');

// flaky proxy for Mea: 503 while down, forwards to the receiver while up
let meaDown = true; const proxyHits = [];
const pxPort = await freePort();
const proxy = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  proxyHits.push({ down: meaDown, url: req.url });
  if (meaDown) { res.writeHead(503); res.end('push service temporarily unavailable'); return; }
  const h = {}; for (const k of ['content-encoding', 'content-type', 'authorization', 'ttl', 'urgency']) if (req.headers[k]) h[k] = req.headers[k];
  const r = await fetch(`http://127.0.0.1:${rxPort}${req.url}`, { method: req.method, headers: h, body: Buffer.concat(chunks) });
  res.writeHead(r.status); res.end(await r.text());
}).listen(pxPort, '127.0.0.1');

const L = await local({ variant: 'typical', clock: 'demo', vapid: true });
const log = [];
const say = (title, obj) => { console.log('\n== ' + title); console.log(typeof obj === 'string' ? obj : JSON.stringify(obj)); log.push({ title, obj }); };
let mark = 0;
const got = async () => { await sleep(700); const n = pushes.slice(mark); mark = pushes.length; return n.map(p => `${p.to}: ${p.body}`); };
const run = async job => {
  const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job } });
  const b = r.body || {};
  return { status: r.status, new: (b.new || []).map(x => x.title), notified: (b.notified || []).map(n => `${n.profile}(sent ${n.sent}, ok ${n.ok})`), skipped: (b.skipped || []).map(s => `${s.profile}:${s.why}`), received: await got() };
};
const usage = async (day, kind) => ((await L.apiAs('eli', '/api/admin/usage')).body.push || []).filter(r => r.day === day && r.kind === kind && ['niece', 'eli', 'christian'].includes(r.profile_id)).map(r => `${r.profile_id} ${r.kind} ${r.day}: sends ${r.sends}, ok ${r.ok}`);
const pray = (who, id, title) => L.apiAs(who, `/api/data/prayer/prayer:${id}?scope=family`, { method: 'PUT', body: { value: { id, title, for: '', by: who, category: 'Family', cadence: 'daily', days: [], status: 'active', createdAt: '2026-09-25', lastPrayedAt: null, prayedBy: {}, updates: [] } } });

try {
  // subscriptions: Eli + Mae -> receiver, Mea -> flaky proxy (the only subscription she has)
  for (const pid of ['eli', 'christian']) await L.apiAs(pid, '/api/push/subscribe', { method: 'POST', body: { subscription: { ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/${pid}` } } });
  await L.apiAs('niece', '/api/push/subscribe', { method: 'POST', body: { subscription: { ...baseSub, endpoint: `http://127.0.0.1:${pxPort}/push/niece` } } });
  const subs = (await L.apiAs('eli', '/api/admin/usage')).body.push_subscriptions;
  say('push_subscriptions per profile', subs);

  // ── A. prayer ──
  await L.clock('2026-09-24T20:00:00-04:00');
  say('Thu 8 pm prayer run (baseline watermark)', await run('prayer'));
  await L.clock('2026-09-25T07:30:00-04:00');
  await pray('mom', 'skep2-p1', 'P1 Healing for a neighbour');
  await L.clock('2026-09-25T08:00:00-04:00');
  meaDown = true;
  say('A1 Fri 8:00 am prayer run, Mea push service 503', await run('prayer'));
  say('A1 push_log (usage) Fri prayer', await usage('2026-09-25', 'prayer'));
  meaDown = false;
  await L.clock('2026-09-25T20:00:00-04:00');
  say('A2 Fri 8:00 pm prayer run, service back, NO new prayer (control: is P1 ever retried?)', await run('prayer'));
  await pray('dad', 'skep2-p2', 'P2 Rain for the garden');
  await L.clock('2026-09-25T20:01:00-04:00');
  say('A3 Fri 8:01 pm prayer run, service back, new prayer P2', await run('prayer'));

  // ── B. park ──
  const locAt = async (nowIso) => {
    const now = Date.parse(nowIso);
    await L.apiAs('eli', '/api/data/dollywood-live/loc:eli?scope=family', { method: 'PUT', body: { value: { x: 0.5, y: 0.5, acc: 8, t: now - 3 * 60000, name: 'Eli' } } });
    await L.apiAs('ezra', '/api/data/dollywood-live/loc:ezra?scope=family', { method: 'PUT', body: { value: { x: 0.4, y: 0.4, acc: 8, t: now - 45 * 60000, name: 'Ezra' } } });
  };
  await L.clock('2026-09-26T14:00:00-04:00'); await locAt('2026-09-26T14:00:00-04:00');
  meaDown = true;
  say('B1 Sat 2:00 pm park run (forced), Ezra 45 min stale, Mea push service 503', await run('park'));
  meaDown = false;
  await L.clock('2026-09-26T20:00:00-04:00'); await locAt('2026-09-26T20:00:00-04:00');
  say('B2 Sat 8:00 pm park run, Ezra still stale, service back', await run('park'));
  say('B push_log (usage) Sat park', await usage('2026-09-26', 'park'));

  // ── C. morning (leftovers) forced twice ──
  await L.clock('2026-09-27T08:00:00-04:00');
  meaDown = true;
  say('C1 Sun 8:00 am morning run, Mea push service 503', await run('morning'));
  meaDown = false;
  await L.clock('2026-09-27T08:10:00-04:00');
  say('C2 Sun 8:10 am admin forces morning again, service back', await run('morning'));

  say('proxy hits for Mea (down = answered 503)', proxyHits);
  fs.writeFileSync(path.join(OUT, 'verify-failed-send-blocks-day-2.json'), JSON.stringify({ log }, null, 1));
  console.log('\nwrote audits/evidence/p2/PWA/verify-failed-send-blocks-day-2.json');
} finally {
  await L.close(); rx.kill(); proxy.close();
}
