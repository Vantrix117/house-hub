// Rev3 check for P2-CHAT-04 (audit Phase 2, CHAT): after toggle_f260_reading unticks a reading the person asked to tick,
// does asking again restore everything, or is some information (log dates, streak, week-completion dates, summary) gone?
//   A. current week, a ticked day: chat untick → chat re-ask. Diff every f260 person row, before vs after.
//   B. a completed earlier week, day 1: chat untick → chat re-ask. Same diff (does weekDone[w] keep its date?).
//   C. another completed week, day 1: chat untick → re-tick in the F260 app (tap the day's mark on the iPhone). Diff.
// Local rig only (real clock, typical household). Output: audits/evidence/p2/CHAT/rev3-chat-04-restore.json
// Run: node "audits/tools/phase2/CHAT/rev3-chat-04-restore.mjs"
import { local, sleep } from '../../lib/local.mjs';
import { toolCall, data, save } from './lib.mjs';

const out = { clock: 'real', variant: 'typical', profile: 'eli' };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const P = 'eli';
  const rows = async () => {
    const items = await data(L, P, 'f260', 'person');
    const m = {}; for (const it of items || []) m[it.key] = { value: it.value, t: it.updated_at };
    return m;
  };
  const diff = (a, b) => {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(); const d = {};
    for (const k of keys) {
      const va = a[k] && a[k].value, vb = b[k] && b[k].value;
      if (JSON.stringify(va) === JSON.stringify(vb)) continue;
      if (va && vb && typeof va === 'object' && typeof vb === 'object' && !Array.isArray(va)) {
        const sub = {}; for (const s of new Set([...Object.keys(va), ...Object.keys(vb)])) if (JSON.stringify(va[s]) !== JSON.stringify(vb[s])) sub[s] = [va[s] === undefined ? '(absent)' : va[s], vb[s] === undefined ? '(absent)' : vb[s]];
        d[k] = sub;
      } else d[k] = [va === undefined ? '(absent)' : va, vb === undefined ? '(absent)' : vb];
    }
    return d;
  };
  const ask = (week, day) => toolCall(L, P, 'toggle_f260_reading', { week, day }, { message: `I read week ${week} day ${day}, tick it off`, after: 'Ticked it off.' });

  const s0 = await rows();
  const sum = s0['f260.summary'].value, done = s0['f260.done'].value, weekDone = (s0['f260.weekDone'] || {}).value || {};
  const week = sum.week;
  const completed = Object.keys(weekDone).map(Number).filter(w => w < week && [0, 1, 2, 3, 4].every(d => done[`${w}-${d}`])).sort((x, y) => y - x);
  out.before = { serverNow: Date.now(), week, summary: sum, weekDoneTail: Object.fromEntries(completed.slice(0, 4).map(w => [w, weekDone[w]])),
    rowStampsAheadOfNow: Object.fromEntries(Object.entries(s0).map(([k, v]) => [k, v.t - Date.now()]).filter(([, a]) => a > 0)) };
  console.log('BEFORE', JSON.stringify(out.before));

  // A. current week, a ticked day
  const dA = [0, 1, 2, 3, 4].find(d => done[`${week}-${d}`]) + 1;
  const a1 = await ask(week, dA); const sA1 = await rows();
  const a2 = await ask(week, dA); const sA2 = await rows();
  out.A = { reading: `${week}-${dA}`, untick: { chip: a1.chip, diff: diff(s0, sA1) }, reask: { chip: a2.chip }, netDiffBeforeVsAfterReask: diff(s0, sA2) };
  console.log('A', JSON.stringify(out.A));

  // B. completed earlier week, day 1 — chat both ways
  const wB = completed[0];
  const b1 = await ask(wB, 1); const sB1 = await rows();
  const b2 = await ask(wB, 1); const sB2 = await rows();
  out.B = { reading: `${wB}-1`, weekDoneBefore: weekDone[wB], untick: { chip: b1.chip, diff: diff(sA2, sB1) }, reask: { chip: b2.chip }, netDiffBeforeVsAfterReask: diff(sA2, sB2),
    weekDoneAfter: ((sB2['f260.weekDone'] || {}).value || {})[wB] };
  console.log('B', JSON.stringify(out.B));

  // C. another completed week, day 1 — chat untick, then the F260 app's own tick
  const wC = completed[1];
  const c1 = await ask(wC, 1); const sC1 = await rows();
  const phone = await L.device({ device: 'iphone-pwa', profile: P, fixedTime: false });
  const f = await phone.openApp('f260', { wait: '#todayDone' });
  await sleep(3000);
  const settle = async () => { for (let i = 0; i < 40; i++) { const h = await phone.hub(f); if (h.sync && h.sync.state === 'synced' && !Object.values(h.queue).some(q => Array.isArray(q) ? q.length : Object.keys(q || {}).length)) return h; await sleep(250); } return phone.hub(f); };
  await settle();
  const sC2 = await rows();                                   // after the app opened (it may save its own derived rows)
  const uiBefore = await f.evaluate(id => { const el = document.querySelector('[data-day="' + id + '"]'); const sec = el && el.closest('section.week'); return { exists: !!el, done: el && el.classList.contains('done'), weekComplete: sec && sec.classList.contains('complete') }; }, `${wC}-0`);
  await f.evaluate(id => document.querySelector('[data-day="' + id + '"] .mark').click(), `${wC}-0`);
  await sleep(1500); const hC = await settle();
  const sC3 = await rows();
  const lc = await f.evaluate(k => { try { return JSON.parse(localStorage.getItem(Object.keys(localStorage).find(x => x.startsWith('hub.cache.') && x.includes('f260')) || 'null')); } catch { return 'unreadable'; } }, null).catch(() => null);
  const uiAfter = await f.evaluate(w => ({ summary: (document.querySelector('#week-' + w + ' .sumt') || {}).textContent || null, complete: document.getElementById('week-' + w).classList.contains('complete') }), wC);
  out.C = { reading: `${wC}-1`, weekDoneBefore: weekDone[wC], untick: { chip: c1.chip, diff: diff(sB2, sC1) }, appOpenDiff: diff(sC1, sC2), uiBeforeTap: uiBefore,
    appTapDiff: diff(sC2, sC3), netDiffBeforeVsAfterAppTick: diff(sB2, sC3), weekDoneAfter: ((sC3['f260.weekDone'] || {}).value || {})[wC], uiAfter, syncAfter: hC.sync,
    localCacheKeysSeen: lc && typeof lc === "object" ? Object.keys(lc).slice(0, 5) : lc };
  console.log('C', JSON.stringify(out.C));
} catch (e) {
  out.error = String(e && e.stack || e); console.error(e);
} finally {
  console.log('saved', save('rev3-chat-04-restore.json', out));
  await L.close();
}
