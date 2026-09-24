// Phase 2 / PWA — skeptic #1 for finding "park-alert-misses-park-day".
//   node "audits/tools/phase2/PWA/verify-park-alert-misses-park-day-1.mjs"
// Claim: the stale-kid park alert (worker/src/reminders.js parkJob) only runs on the 8 am / 8 pm cron runs, and its stale
// window is 30 min – 4 h, so a kid whose marker goes quiet between ~8 am and ~4 pm is never reported.
//
// Part A — the rig (fresh L = local(...), throwaway VAPID, stand-in push service scripts/push-receiver.mjs):
//   A1. Sun 27 Sep 2026 8:00 pm NY: loc:eli t = now − 5 min, loc:ezra t = 11:00 am → force the park job.
//   A2. positive control, Mon 28 Sep 2:00 pm NY: loc:eli 3 min old, loc:ezra 45 min old → force the park job.
//   (The rig has no way to fire the cron un-forced, so Part B does that.)
// Part B — the real schedule, in-process: the real worker/src (index.js fetch for writes, reminders.js runCron for the
//   cron) on the rig's own SQLite D1 shim + seed, a simulated clock, and a cron simulator that fires exactly the
//   expressions in worker/wrangler.toml ["0 12,13 * * *", "0 0,1 * * *"]. runCron is called UN-forced, as the
//   scheduled() handler does (worker/src/index.js:593-597). Scenario per run: the family is at the park Sun 27 Sep
//   10:00 am – 10:00 pm; Eli's marker refreshes every 2 min the whole time; Ezra's marker stops at Q. For Q from
//   10:30 am to 9:30 pm, every 30 min: does ANY scheduled run from Sun 00:00 to Mon 12:00 NY push a park alert?
//   Also: which NY hours of a day run the park job at all (runCron un-forced at every hour).
// Nothing leaves the machine: outbound fetch is refused except 127.0.0.1 (the stand-in push service).
process.env.TZ = 'America/New_York';
import { local, sleep } from '../../lib/local.mjs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const log = { A: {}, B: {} };
const say = (t, o) => { console.log('\n== ' + t); if (o !== undefined) console.log(typeof o === 'string' ? o : JSON.stringify(o, null, 1)); };

// ── stand-in push service ──────────────────────────────────────────────────────
const rxPort = await freePort();
const rx = spawn(process.execPath, [path.join(ROOT, 'scripts/push-receiver.mjs'), String(rxPort)], { stdio: ['ignore', 'pipe', 'pipe'] });
let baseSub = null, rxBuf = ''; const pushes = [];
rx.stdout.on('data', d => {
  rxBuf += d; let i;
  while ((i = rxBuf.indexOf('\n')) >= 0) {
    const line = rxBuf.slice(0, i).trim(); rxBuf = rxBuf.slice(i + 1);
    if (line.startsWith('SUBSCRIPTION ')) baseSub = JSON.parse(line.slice(13));
    const m = /^PUSH #(\d+) url=(\S+) .*payload=(.*)$/.exec(line);
    if (m) { let p; try { p = JSON.parse(m[3]); } catch { p = m[3]; } pushes.push({ to: m[2].split('/').pop(), title: p.title, body: p.body, tag: p.tag }); }
  }
});
for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
if (!baseSub) throw new Error('push receiver did not start');
const subFor = pid => ({ ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/${pid}` });
let mark = 0;
const newPushes = async () => { await sleep(500); const n = pushes.slice(mark); mark = pushes.length; return n; };
const ADULTS = ['eli', 'christian', 'mom', 'dad', 'niece'];

try {
  // ═══ Part A: the rig ═════════════════════════════════════════════════════════
  const L = await local({ variant: 'typical', clock: 'demo', vapid: true });
  try {
    for (const pid of ADULTS) {
      const r = await L.apiAs(pid, '/api/push/subscribe', { method: 'POST', body: { subscription: subFor(pid) } });
      if (r.status !== 200) console.log('subscribe', pid, r.status, JSON.stringify(r.body));
    }
    const put = (who, pid, t) => L.apiAs(who, `/api/data/dollywood-live/loc:${pid}?scope=family`, { method: 'PUT', body: { value: { x: 0.5, y: 0.5, acc: 8, t, name: pid } } });
    const force = async () => { const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'park' } }); const b = r.body || {}; return { status: r.status, parkDay: b.parkDay, markers: b.markers, stale: b.stale, notified: (b.notified || []).map(n => n.profile), skipped: b.skipped, received: await newPushes() }; };

    await L.clock('2026-09-27T20:00:00-04:00');
    const n1 = Date.parse('2026-09-27T20:00:00-04:00');
    const w1 = [await put('eli', 'eli', n1 - 5 * 60000), await put('ezra', 'ezra', Date.parse('2026-09-27T11:00:00-04:00'))].map(r => r.status);
    log.A.A1 = { writes: w1, result: await force() };
    say('A1 Sun 8:00 pm, forced park: Eli 5 min old, Ezra quiet since 11:00 am', log.A.A1);

    await L.clock('2026-09-28T14:00:00-04:00');
    const n2 = Date.parse('2026-09-28T14:00:00-04:00');
    const w2 = [await put('eli', 'eli', n2 - 3 * 60000), await put('ezra', 'ezra', n2 - 45 * 60000)].map(r => r.status);
    log.A.A2 = { writes: w2, result: await force() };
    say('A2 Mon 2:00 pm, forced park (control): Eli 3 min old, Ezra 45 min old', log.A.A2);
  } finally { await L.close(); }

  // ═══ Part B: the real cron schedule, in-process ══════════════════════════════
  let SIM = Date.parse('2026-09-27T00:00:00-04:00');
  const RealDate = Date;
  class SimDate extends RealDate { constructor(...a) { if (a.length === 0) super(SIM); else super(...a); } static now() { return SIM; } }
  globalThis.Date = SimDate;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/^http:\/\/127\.0\.0\.1:/.test(url)) return realFetch(input, init);
    throw new Error('verify script: outbound fetch refused: ' + url);
  };
  const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
  const worker = (await imp('worker/src/index.js')).default;
  const { runCron } = await imp('worker/src/reminders.js');
  const { createD1 } = await imp('audits/tools/lib/d1.mjs');
  const { seedDemo, DEVICE, sessionToken } = await imp('audits/tools/seed.mjs');
  const { default: crypto } = await import('node:crypto');
  const ORIGIN = 'http://localhost:1';
  const vk = await crypto.webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const env = {
    DB: createD1(':memory:'), ALLOWED_ORIGINS: ORIGIN,
    VAPID_PUBLIC_KEY: Buffer.from(await crypto.webcrypto.subtle.exportKey('raw', vk.publicKey)).toString('base64url'),
    VAPID_PRIVATE_KEY: (await crypto.webcrypto.subtle.exportKey('jwk', vk.privateKey)).d, VAPID_SUBJECT: 'mailto:rig@example.invalid',
  };
  await seedDemo(env.DB, { variant: 'typical', now: SIM });
  const api = async (pid, p, method = 'GET', body) => {
    const res = await worker.fetch(new Request('http://api.local' + p, { method, headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Device-Token': DEVICE.token, 'X-Profile-Token': sessionToken(pid) }, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil() {}, passThroughOnException() {} });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  for (const pid of ADULTS) { const r = await api(pid, '/api/push/subscribe', 'POST', { subscription: subFor(pid) }); if (r.status !== 200) console.log('B subscribe', pid, r.status, JSON.stringify(r.body)); }
  await newPushes();

  // B0: which NY hours run the park job at all (un-forced runCron at every hour of Sun 27 Sep)
  const parkHours = [];
  for (let h = 0; h < 24; h++) {
    const t = Date.parse(`2026-09-27T${String(h).padStart(2, '0')}:00:00-04:00`); SIM = t;
    await env.DB.prepare("DELETE FROM app_data WHERE app_id = 'dollywood-live' AND key LIKE 'loc:%'").run();
    const out = await runCron(env, t);
    if ((out.ran || []).some(j => j.job === 'park')) parkHours.push(h);
  }
  await env.DB.prepare("DELETE FROM push_log").run(); await newPushes();
  log.B.parkHoursNY = parkHours;
  say('B0 NY hours at which un-forced runCron runs the park job', parkHours);

  // the cron expressions in worker/wrangler.toml
  const toml = fs.readFileSync(path.join(ROOT, 'worker/wrangler.toml'), 'utf8');
  const crons = JSON.parse(/crons\s*=\s*(\[[^\]]*\])/.exec(toml)[1]);
  const utcHours = new Set(crons.flatMap(c => c.split(' ')[1].split(',').map(Number)));
  const fires = [];
  for (let t = Date.parse('2026-09-27T00:00:00-04:00'); t <= Date.parse('2026-09-28T12:00:00-04:00'); t += 3600000) if (utcHours.has(new RealDate(t).getUTCHours())) fires.push(t);
  const ny = t => new RealDate(t).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' });
  log.B.crons = crons; log.B.firesNY = fires.map(ny);
  say('B cron firings simulated (wrangler.toml ' + JSON.stringify(crons) + ')', fires.map(ny));

  const ARRIVE = Date.parse('2026-09-27T10:00:00-04:00'), LEAVE = Date.parse('2026-09-27T22:00:00-04:00');
  const rows = [];
  for (let q = Date.parse('2026-09-27T10:30:00-04:00'); q <= Date.parse('2026-09-27T21:30:00-04:00'); q += 30 * 60000) {
    await env.DB.prepare("DELETE FROM app_data WHERE app_id = 'dollywood-live' AND key LIKE 'loc:%'").run();
    await env.DB.prepare("DELETE FROM push_log").run();
    let alerted = null; const runs = [];
    for (const T of fires) {
      SIM = T;
      if (T >= ARRIVE) {   // markers as the park map leaves them at T: Eli refreshes every 2 min until he leaves; Ezra until Q
        const eliT = Math.min(T, LEAVE) - 2 * 60000, ezraT = Math.min(T - 2 * 60000, q);
        const we = await api('eli', '/api/data/dollywood-live/loc:eli?scope=family', 'PUT', { value: { x: 0.5, y: 0.5, acc: 8, t: eliT, name: 'Eli' } });
        const wz = await api('ezra', '/api/data/dollywood-live/loc:ezra?scope=family', 'PUT', { value: { x: 0.4, y: 0.6, acc: 8, t: ezraT, name: 'Ezra' } });
        if (we.status !== 200 || wz.status !== 200) console.log('  write failed', we.status, wz.status, JSON.stringify(wz.body));
      }
      const out = await runCron(env, T);                 // UN-forced, exactly as scheduled() calls it
      const park = (out.ran || []).find(j => j.job === 'park');
      const got = await newPushes();
      runs.push({ at: ny(T), ranPark: !!park, parkDay: park ? park.parkDay : null, stale: park ? park.stale : null, pushes: got.filter(p => p.tag === 'park').length });
      if (!alerted && got.some(p => p.tag === 'park')) alerted = { at: ny(T), body: got.find(p => p.tag === 'park').body, to: got.filter(p => p.tag === 'park').map(p => p.to) };
    }
    rows.push({ ezraQuietAt: ny(q), alerted: alerted ? `${alerted.at} → ${alerted.to.join(',')}: "${alerted.body}"` : 'NEVER', runs });
  }
  log.B.sweep = rows;
  say('B sweep: Ezra goes quiet at Q (Eli at the park 10 am – 10 pm, fresh at every run) → park alert from any scheduled run?');
  for (const r of rows) console.log(`  Ezra quiet at ${r.ezraQuietAt.padEnd(14)} → ${r.alerted}`);
  const n = rows.filter(r => r.alerted === 'NEVER').length;
  say(`B summary: ${n} of ${rows.length} quiet times never alerted`);
  globalThis.Date = RealDate; globalThis.fetch = realFetch;
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-park-alert-misses-park-day-1.json'), JSON.stringify(log, null, 1));
  console.log('\nwrote audits/evidence/p2/PWA/verify-park-alert-misses-park-day-1.json');
  rx.kill();
}
