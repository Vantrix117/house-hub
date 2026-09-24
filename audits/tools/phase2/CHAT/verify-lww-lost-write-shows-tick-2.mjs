// Skeptic #2 for finding "lww-lost-write-shows-tick" (audit Phase 2, CHAT). Independent of 03-cap.mjs.
// Questions:
//   A. Raw repro: f260.done last written with updated_at = server now + 2 min (as a fast-clock device's queued write would be).
//      Chat toggle_f260_reading on an unticked day: chip / tool_result / server row / feed / f260.summary + f260.log
//      (does the tool half-apply: summary + log move, done does not?).
//   B. Is a future-stamped row realistic through the app's own write path (hub.js)? hub.js corrects stamps by
//      hub.skew = server now - device now (hub.js:236, 290), but skew is not persisted and only learned on a pull.
//      B1: phone clock +2 min, online (skew learned) -> F260's hub.set stamp vs server now, then a chat tick.
//      B2: same phone reloaded with no network (skew = 0), ticks a reading from the cache, network returns, queue flushes
//          -> stamp vs server now, then a chat tick within the window.
// Run: node "audits/tools/phase2/CHAT/verify-lww-lost-write-shows-tick-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'CHAT');
fs.mkdirSync(EVID, { recursive: true });
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));
const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const P = 'eli';
  const row = async k => { const r = await L.apiAs(P, `/api/data/f260?scope=person&key=${encodeURIComponent(k)}`); return { value: r.body.item && r.body.item.value, updated_at: r.body.item && r.body.item.updated_at, serverNow: r.body.now }; };
  async function chatTick(week, day) {
    await L.anthropicLog({ clear: true });
    await L.anthropic([{ tools: [{ name: 'toggle_f260_reading', input: { week, day } }] }, { text: 'Done, ticked it off.' }]);
    const r = await L.apiAs(P, '/api/chat', { method: 'POST', body: { message: `I read week ${week} day ${day}, tick it off`, apps } });
    const events = String(r.body).split('\n\n').filter(Boolean).map(c => { let ev = 'message', d = null; for (const l of c.split('\n')) { if (l.startsWith('event:')) ev = l.slice(6).trim(); else if (l.startsWith('data:')) { try { d = JSON.parse(l.slice(5)); } catch { d = l.slice(5); } } } return { ev, d }; });
    const tool = events.find(e => e.ev === 'tool');
    const log = await L.anthropicLog();
    const last = log[1] && log[1].body.messages.at(-1);
    const tr = last && Array.isArray(last.content) ? last.content.find(b => b.type === 'tool_result') : null;
    const text = events.filter(e => e.ev === 'text').map(e => e.d.text).join('');
    return { http: r.status, chip: tool && tool.d.chip, ok: tool && tool.d.ok, toolResult: tr && tr.content, text };
  }
  // the feed line the tool posted (the seeded feed can hold rows stamped after real now, so search rather than take the top)
  const feedLine = async (w, d) => { const r = await L.apiAs(P, '/api/activity?limit=100'); const a = r.body.activity; const i = a.findIndex(x => x.text.includes(`week ${w} day ${d} (via chat)`)); return i < 0 ? null : { text: a[i].text, position: i, createdMinusNow: a[i].created_at - Date.now(), rowsAbove: a.slice(0, i).map(x => ({ text: x.text.slice(0, 50), createdMinusNow: x.created_at - Date.now() })) }; };

  // ── A ──
  const d0 = await row('f260.done'), s0 = await row('f260.summary'), l0 = await row('f260.log');
  const week = s0.value.week;
  const free = [0, 1, 2, 3, 4].filter(d => !d0.value[`${week}-${d}`]);
  console.log('seed: week', week, 'unticked days (0-based)', free, 'done.updated_at - now =', d0.updated_at - d0.serverNow, 'ms');
  const fut = await L.apiAs(P, '/api/data/f260/f260.done?scope=person', { method: 'PUT', body: { value: d0.value, updated_at: Date.now() + 120000 } });
  console.log('A: fast-stamped PUT ->', fut.status, 'applied', fut.body.applied, 'updated_at - now', fut.body.updated_at - Date.now());
  const dayA = free[0];
  const a = await chatTick(week, dayA + 1);
  const d1 = await row('f260.done'), s1 = await row('f260.summary'), l1 = await row('f260.log');
  out.A = {
    key: `${week}-${dayA}`, chip: a.chip, ok: a.ok, toolResult: a.toolResult, modelText: a.text,
    serverDoneHasIt: !!d1.value[`${week}-${dayA}`], doneUpdatedAtUnchanged: d1.updated_at === fut.body.updated_at,
    summary: { weekDone: `${s0.value.weekDone} -> ${s1.value.weekDone}`, total: `${s0.value.total} -> ${s1.value.total}`, readToday: `${s0.value.readToday} -> ${s1.value.readToday}` },
    doneCountActual: Object.keys(d1.value).length, logChanged: JSON.stringify(l0.value) !== JSON.stringify(l1.value), feed: await feedLine(week, dayA + 1),
  };
  console.log('A:', JSON.stringify(out.A, null, 1));
  // after the 2-minute window the same request lands
  out.A.windowNote = 'putOne caps a future stamp at server now + 5 min (data.js:41); the loss window lasts until server time passes the stamp';

  // ── B: through hub.js on a phone whose clock runs 2 minutes fast ──
  await L.reset('typical');
  const ph = await L.newDevice({ name: 'Eli phone (fast clock)', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() + 120000, as: ph });
  let f = await phone.openApp('f260');
  await f.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
  const b0 = await row('f260.done'), sB = await row('f260.summary');
  const wk = sB.value.week;
  const freeB = [0, 1, 2, 3, 4].filter(d => !b0.value[`${wk}-${d}`]);
  const skew1 = await f.evaluate(() => hub.skew);
  // B1: online, skew learned
  await f.evaluate(k => { const d = { ...(hub.get('f260.done', { default: {} }) || {}) }; d[k] = true; hub.set('f260.done', d); return hub.flush(); }, `${wk}-${freeB[0]}`);
  await sleep(800);
  const b1 = await row('f260.done');
  const c1 = await chatTick(wk, freeB[1] + 1);
  const b1after = await row('f260.done');
  out.B1 = { phoneSkewMs: skew1, appStampMinusServerNow: b1.updated_at - b1.serverNow, appTickLanded: !!b1.value[`${wk}-${freeB[0]}`], chatChip: c1.chip, chatTickLanded: !!b1after.value[`${wk}-${freeB[1]}`] };
  console.log('B1 (online, skew learned):', JSON.stringify(out.B1));

  // B2: phone reopened with no network (skew back to 0), ticks from its cache; network returns; queue flushes
  const block = u => u.href.startsWith(L.api);
  await phone.ctx.route(block, r => r.abort('internetdisconnected'));
  f = await phone.openApp('f260');
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 });
  await sleep(1500);
  const skew2 = await f.evaluate(() => hub.skew);
  const kB2 = `${wk}-${freeB[2]}`;
  await f.evaluate(k => { const d = { ...(hub.get('f260.done', { default: {} }) || {}) }; d[k] = true; hub.set('f260.done', d); }, kB2);
  const queued = await f.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')).map(k => [k, JSON.parse(localStorage.getItem(k))])));
  const qStamp = Object.values(queued).map(q => q['f260.done']).filter(Boolean).map(q => q.updated_at)[0];
  await phone.ctx.unroute(block);
  await f.evaluate(() => hub.flush());
  await sleep(800);
  const b2 = await row('f260.done');
  const c2 = await chatTick(wk + 1, 1);   // this week's free days are used up by now; tick next week's day 1
  const b2after = await row('f260.done');
  out.B2 = { phoneSkewMs: skew2, queuedStampMinusRealNow: qStamp ? qStamp - Date.now() : null, serverStampMinusServerNow: b2.updated_at - b2.serverNow, appTickLanded: !!b2.value[kB2],
    chatChip: c2.chip, chatToolResult: c2.toolResult, chatTickLanded: !!b2after.value[`${wk + 1}-0`], serverStillHoldsPhoneStamp: b2after.updated_at === b2.updated_at };
  console.log('B2 (offline reopen, skew 0, then flush):', JSON.stringify(out.B2));
} finally { await L.close(); }
const file = path.join(EVID, 'verify-lww-lost-write-shows-tick-2.json');
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log('evidence:', path.relative(ROOT, file).replace(/\\/g, '/'));
