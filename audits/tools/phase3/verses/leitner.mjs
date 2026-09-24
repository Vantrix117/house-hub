// Leitner correctness through the real UI (apps/verses.html:290-306, 193, 225-231).
// Setup (local rig only): Eli's f260.recall rows for weeks 1-5 verse 0 are set to box 1..5, all due today (22 Sep 2026),
// streak 2. Queue order is then plan order (same due) → 1-0, 2-0, 3-0, 4-0, 5-0, then his seeded due verses (33-0 box 3, …).
// Ratings: 1-0 Got, 2-0 Not yet, 3-0 Almost, 4-0 Got, 5-0 Got, 6-0 (box 5) Not yet, 33-0 Not yet, 36-1 Almost, 37-0 Not yet.
// Expected by the documented rule (CLAUDE.md "boxes 1–5 with due dates 1/2/4/7/14 days"; verses.html:168):
//   Got → box+1 (max 5), Almost → same box, Not yet → box-1 (min 1); due = today + [1,2,4,7,14][box-1]; last = today;
//   streak Got +1 / Almost hold / Not 0; s = 'got' for Got, 'not' otherwise. log[today] += 1 per rating.
import { local, DEMO, sleep } from '../../lib/local.mjs';
import { openVerses, state, rate, serverRow, save, waitQueueEmpty } from './_lib.mjs';
const INTERVALS = [1, 2, 4, 7, 14];
const shift = (k, n) => { const [y, m, d] = k.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { steps: [] };
try {
  const before = await serverRow(L, 'eli', 'f260', 'f260.recall');
  const rc = { ...before.value };
  const setup = { '1-0': 1, '2-0': 2, '3-0': 3, '4-0': 4, '5-0': 5, '6-0': 5 };
  for (const [id, b] of Object.entries(setup)) rc[id] = { s: 'got', t: 1, box: b, due: '2026-09-22', last: shift('2026-09-22', -INTERVALS[b - 1]), streak: 2 };
  const now = (await L.apiAs('eli', '/api/data/f260?scope=person')).body.now;
  const put = await L.apiAs('eli', '/api/data/f260/batch?scope=person', { method: 'POST', body: { items: [{ key: 'f260.recall', value: rc, updated_at: now + 1 }] } });
  out.setupApplied = put.body.results.map(r => r.applied);
  const logBefore = (await serverRow(L, 'eli', 'verses', 'log')).value;
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  const f = await openVerses(ipad);
  const plan = [['1-0', 'got'], ['2-0', 'not'], ['3-0', 'almost'], ['4-0', 'got'], ['5-0', 'got'], ['6-0', 'not'], ['33-0', 'not'], ['36-1', 'almost'], ['37-0', 'not']];
  const toasts = [];
  await f.evaluate(() => { window.__toasts = []; const o = hub.toast; hub.toast = (m, ...a) => { window.__toasts.push(m); return o.call(hub, m, ...a); }; });
  const s0 = await state(f); out.initial = { who: s0.who, stats: s0.stats, queue: s0.queue };
  for (const [id, kind] of plan) {
    const cur = await f.evaluate(() => window.verses.current());
    if (cur !== id) { out.steps.push({ expected: id, onCard: cur, note: 'queue order differs' }); }
    await rate(f, kind);
    out.steps.push({ id: cur, kind });
  }
  out.toasts = await f.evaluate(() => window.__toasts);
  out.final = await state(f);
  await waitQueueEmpty(ipad);
  const after = (await serverRow(L, 'eli', 'f260', 'f260.recall')).value;
  const logAfter = (await serverRow(L, 'eli', 'verses', 'log')).value;
  const summary = (await serverRow(L, 'eli', 'verses', 'summary')).value;
  const today = '2026-09-22';
  out.check = plan.map(([id, kind]) => {
    const prev = rc[id] || { box: 1, streak: 0 }; const pb = prev.box || 1;
    const box = kind === 'got' ? Math.min(5, pb + 1) : kind === 'not' ? Math.max(1, pb - 1) : pb;
    const exp = { s: kind === 'got' ? 'got' : 'not', box, due: shift(today, INTERVALS[box - 1]), last: today, streak: kind === 'got' ? (prev.streak || 0) + 1 : kind === 'almost' ? (prev.streak || 0) : 0 };
    const got = after[id]; const ok = got && ['s', 'box', 'due', 'last', 'streak'].every(k => got[k] === exp[k]);
    return { id, kind, prevBox: pb, expected: exp, server: got && { s: got.s, box: got.box, due: got.due, last: got.last, streak: got.streak }, ok };
  });
  out.log = { before: logBefore[today] || 0, after: logAfter[today], keysBefore: Object.keys(logBefore).length, keysAfter: Object.keys(logAfter).length };
  out.summary = summary;
  out.untouched = Object.keys(before.value).filter(id => !(id in setup) && !plan.some(p => p[0] === id)).every(id => JSON.stringify(before.value[id]) === JSON.stringify(after[id]));
  console.log(JSON.stringify(out, null, 1));
  save('leitner.json', out);
} finally { await L.close(); }
