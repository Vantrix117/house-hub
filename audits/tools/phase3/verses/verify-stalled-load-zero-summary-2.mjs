// Skeptic #2 for "stalled-load-zero-summary" (apps/verses.html render() -> writeSummary(), apps/hub.js:337 6 s wait).
// Independent of the investigator's helpers. Three runs on a fresh local instance, Eli on a brand-new paired phone:
//   S1 hold9  : every GET /api/data/<app> held 9 s, Verses opened straight away (the finding's trigger).
//   S2 hold4  : the same with a 4 s hold (under hub.ready's 6 s wait) — control.
//   S3 warm   : the shell's pulls land normally on Home first, then only GET /api/data/verses is held 9 s
//               (a first Verses open on a device whose f260 cache already exists: hub.ready does not wait at all).
// For each: a 200 ms timeline of what Eli sees, the server's verses.summary during and after, and any buttons in reach.
// Usage: node "audits/tools/phase3/verses/verify-stalled-load-zero-summary-2.mjs"            (S1-S3)
//        node "audits/tools/phase3/verses/verify-stalled-load-zero-summary-2.mjs" threshold  (2.5 s and 1.2 s holds)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const EVID = path.resolve('audits/evidence/p3/verses');
fs.mkdirSync(EVID, { recursive: true });
const PFX = 'verify-stalled-load-zero-summary-2';
const out = {};

const L = await local({ variant: 'typical', clock: 'demo' });
const summary = async () => {
  const r = await L.apiAs('eli', '/api/data/verses?scope=person');
  const it = (r.body.items || []).find(i => i.key === 'summary');
  return it ? it.value : null;
};
const look = f => f.evaluate(() => {
  const q = s => document.querySelector(s), vis = s => !!q(s) && !q(s).hidden;
  const view = vis('#trainer') ? 'trainer' : vis('#done') ? 'done' : vis('#empty') ? 'empty' : 'none';
  return {
    who: (q('#who') && q('#who').textContent.trim()) || '', view,
    emptyTitle: vis('#empty') ? q('#empty h2').textContent : null,
    stats: vis('#stats') ? { due: q('#st-due').textContent, streak: q('#st-streak').textContent, total: q('#st-total').textContent } : null,
    buttonsInReach: [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null && !b.closest('[hidden]')).map(b => b.id || b.textContent.trim()).slice(0, 12),
  };
}).catch(e => ({ err: String(e).slice(0, 120) }));

async function run(name, { holdMs, only, warm }) {
  const ph = await L.newDevice({ name: 'New phone ' + name, profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  let hold = !warm;
  const re = only ? new RegExp('/api/data/' + only + '$') : /\/api\/data\/[^/]+$/;
  await d.ctx.route(u => hold && re.test(u.pathname), async r => {
    if (r.request().method() !== 'GET') return r.continue().catch(() => {});
    await sleep(holdMs); await r.continue().catch(() => {});
  });
  const res = { holdMs, only: only || 'all', warm: !!warm, before: await summary() };
  if (warm) { await d.goto('#home'); await sleep(3000); hold = true; res.f260CachedBeforeOpen = await d.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.cache.f260')).length); }
  const t0 = Date.now();
  const f = await d.openApp('verses');
  const tl = []; let last = '', shotTaken = false, atStall = null;
  while (Date.now() - t0 < 16000) {
    const s = await look(f); const key = s.who + '|' + s.view + '|' + JSON.stringify(s.stats);
    if (key !== last) { tl.push({ ms: Date.now() - t0, ...s }); last = key; }
    if (!shotTaken && (s.view === 'empty' || (s.stats && s.stats.streak === '0'))) {
      shotTaken = true;
      await d.page.screenshot({ path: path.join(EVID, `${PFX}-${name}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
      await sleep(1500); atStall = { ms: Date.now() - t0, server: await summary() };
    }
    await sleep(200);
  }
  res.timeline = tl; res.serverDuringStall = atStall; res.after = await summary(); res.final = await look(f);
  await d.close();
  return res;
}

try {
  if (process.argv[2] === 'threshold') {   // per-request hold vs the 6 s wait: the frame pulls its channels one after another (apps/hub.js:307)
    out.T_hold2500 = await run('hold2500', { holdMs: 2500 });
    out.T_hold1200 = await run('hold1200', { holdMs: 1200 });
    for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v.timeline.map(t => [t.ms, t.who, t.view, t.stats && t.stats.total])), 'serverDuringStall', JSON.stringify(v.serverDuringStall));
    fs.writeFileSync(path.join(EVID, `${PFX}-threshold.json`), JSON.stringify(out, null, 1));
  } else {
    out.S1_hold9 = await run('hold9', { holdMs: 9000 });
    out.S2_hold4 = await run('hold4', { holdMs: 4000 });
    out.S3_warm_verses9 = await run('warm', { holdMs: 9000, only: 'verses', warm: true });
    console.log(JSON.stringify(out, null, 1));
    fs.writeFileSync(path.join(EVID, `${PFX}.json`), JSON.stringify(out, null, 1));
  }
} finally { await L.close(); }
