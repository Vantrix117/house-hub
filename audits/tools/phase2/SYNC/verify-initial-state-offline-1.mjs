// Skeptic #1 for SYNC finding "initial-state-offline": hub.sync.state starts as 'offline' while online, so apps show a
// false offline line on open. Independent re-run on a fresh local instance (does not reuse e11).
//   node "audits/tools/phase2/SYNC/verify-initial-state-offline-1.mjs"
// Part A  Larder warm open, NO throttling (local server, ~ms pulls): does the false line ever reach a painted frame?
// Part B  Larder warm open, the leftovers pull held 400 ms and 2 s (slow cellular): state/line/online + every /api/ fetch
//         outcome, to show nothing failed while the line said "Can't reach".
// Part C  Home cold load (new device, empty cache, /api/data held 2 s): skeletons vs final empty wording while 'offline'.
// Part D  Counterfactual: the same B + C with an overlay hub.js whose ONLY change is the initial state 'offline'→'loading'
//         (generated below from the real apps/hub.js) — proves the initial value is the cause.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const log = (...a) => console.log(...a);

// counterfactual overlay: real hub.js with the initial state changed, nothing else
const OVL = path.join(HERE, 'overlay-verify-initial-state-1');
const src = fs.readFileSync(path.join(ROOT, 'apps', 'hub.js'), 'utf8');
const needle = "sync: { state: 'offline', pending: 0, lastError: null, lastPull: 0 },";
if (!src.includes(needle)) throw new Error('hub.js initial state line not found — code changed?');
fs.mkdirSync(path.join(OVL, 'apps'), { recursive: true });
fs.writeFileSync(path.join(OVL, 'apps', 'hub.js'), src.replace(needle, "sync: { state: 'loading', pending: 0, lastError: null, lastPull: 0 },"));

// recorder injected in every frame: hub.sync state changes, the Larder #mode line as seen at each animation frame, /api/ fetches
const RECORDER = () => {
  const rec = window.__rec = { ev: [] };
  const push = (k, v) => rec.ev.push({ t: Math.round(performance.now()), k, v });
  const of = window.fetch;
  window.fetch = function (u) {
    const url = String((u && u.url) || u).replace(/^https?:\/\/[^/]+/, '');
    const api = url.includes('/api/'); if (api) push('fetch>', url);
    return of.apply(this, arguments).then(r => { if (api) push('fetch<', r.status + ' ' + url); return r; }, e => { if (api) push('fetch!', e.message + ' ' + url); throw e; });
  };
  let ls, lm;
  const tick = () => {
    try {
      if (window.hub && hub.sync) { const s = hub.sync.state + '|' + hub.sync.lastPull; if (s !== ls) { ls = s; push('state', { state: hub.sync.state, lastPull: hub.sync.lastPull, onLine: navigator.onLine }); } }
      const m = document.getElementById('mode');
      if (m) { const v = m.hidden ? '(hidden)' : m.textContent; if (v !== lm) { lm = v; push('mode@frame', v); } }
    } catch {}
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const FALSE_LINE = "Can't reach the house list";
const out = { A: [], B: {}, C: {}, D: {} };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const ph = await L.newDevice({ name: 'Verify phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  await phone.ctx.addInitScript(RECORDER);
  // warm the cache
  let f = await phone.openApp('leftovers');
  for (let i = 0; i < 60 && !(await f.evaluate(() => window.hub && hub.sync.lastPull > 0)); i++) await sleep(250);
  await sleep(500);
  out.warm = await f.evaluate(() => ({ since: JSON.parse(localStorage.getItem('hub.cache.leftovers.family') || '{}').since || 0, items: Object.keys((JSON.parse(localStorage.getItem('hub.cache.leftovers.family') || '{}').items) || {}).length }));
  log('warm cache:', JSON.stringify(out.warm));

  // ── A: unthrottled warm opens ─────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    await phone.page.goto('about:blank');
    f = await phone.openApp('leftovers');
    await sleep(1500);
    const ev = await f.evaluate(() => window.__rec.ev);
    const painted = ev.filter(e => e.k === 'mode@frame' && String(e.v).includes("Can't reach"));
    const pullDone = ev.find(e => e.k === 'state' && e.v.lastPull > 0);
    out.A.push({ run: i + 1, falseLinePaintedFrames: painted.length, firstState: (ev.find(e => e.k === 'state') || {}).v, pullDoneAtMs: pullDone && pullDone.t, lineShownAtMs: painted[0] && painted[0].t, failedFetches: ev.filter(e => e.k === 'fetch!').length });
  }
  log('A unthrottled warm opens:', JSON.stringify(out.A));

  // ── B: throttled leftovers pull ──────────────────────────────────────────
  async function slowOpen(label, ms) {
    const h = async route => { await sleep(ms); route.continue().catch(() => {}); };
    await phone.ctx.route(/\/api\/data\/leftovers\?/, h);
    await phone.page.goto('about:blank');
    const t0 = Date.now();
    f = await phone.openApp('leftovers');
    const probe = () => f.evaluate(() => { const m = document.getElementById('mode'); return { onLine: navigator.onLine, state: hub.sync.state, lastPull: hub.sync.lastPull, line: m && !m.hidden ? m.textContent : null }; });
    await sleep(Math.min(250, ms / 2));
    const during = await probe(); during.atMs = Date.now() - t0;
    const png = path.join(EVID, `verify-initial-state-offline-1-${label}.png`);
    await phone.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
    await sleep(ms + 1500);
    const after = await probe(); after.atMs = Date.now() - t0;
    const ev = await f.evaluate(() => window.__rec.ev);
    await phone.ctx.unroute(/\/api\/data\/leftovers\?/, h);
    return { during, after, shot: rel(png), fetches: ev.filter(e => e.k.startsWith('fetch')).map(e => `${e.t}ms ${e.k} ${e.v}`), modeTimeline: ev.filter(e => e.k === 'mode@frame').map(e => `${e.t}ms ${String(e.v).slice(0, 40)}`), states: ev.filter(e => e.k === 'state').map(e => `${e.t}ms ${e.v.state} lastPull=${e.v.lastPull ? 'set' : 0} onLine=${e.v.onLine}`) };
  }
  out.B.ms400 = await slowOpen('larder-400ms', 400);
  log('B 400 ms pull:', JSON.stringify({ during: out.B.ms400.during, after: out.B.ms400.after }));
  out.B.ms2000 = await slowOpen('larder-2s', 2000);
  log('B 2 s pull:', JSON.stringify({ during: out.B.ms2000.during, after: out.B.ms2000.after }));
  log('B 2 s states:', JSON.stringify(out.B.ms2000.states));
  log('B 2 s fetches:', JSON.stringify(out.B.ms2000.fetches));
  log('B 2 s mode line per frame:', JSON.stringify(out.B.ms2000.modeTimeline));

  // ── C: Home cold load, empty cache, /api/data held 2 s ────────────────────
  async function coldHome(label) {
    const ph2 = await L.newDevice({ name: 'Cold ' + label, profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph2 });
    await d.ctx.addInitScript(RECORDER);
    await d.ctx.route(/\/api\/data\//, async route => { await sleep(2000); route.continue().catch(() => {}); });
    const t0 = Date.now();
    await d.goto('#home');
    await sleep(700);
    const probe = () => d.page.evaluate(() => {
      const v = document.getElementById('view-home'); const txt = v ? v.innerText : '';
      const empties = ['Nothing to remember right now.', 'All quiet in the house.', 'Nothing aging', 'Nothing on the list today', 'Start with Genesis'].filter(s => txt.includes(s));
      return { state: hub.sync.state, lastPull: hub.sync.lastPull, onLine: navigator.onLine, skeletons: v ? v.querySelectorAll('.skeleton').length : -1, emptyWording: empties };
    });
    const during = await probe(); during.atMs = Date.now() - t0;
    const png = path.join(EVID, `verify-initial-state-offline-1-home-cold-${label}.png`);
    await d.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
    await sleep(4000);
    const after = await probe(); after.atMs = Date.now() - t0;
    await d.close();
    return { during, after, shot: rel(png) };
  }
  out.C = await coldHome('real');
  log('C Home cold load (real hub.js):', JSON.stringify(out.C));

  // ── D: counterfactual overlay (initial state 'loading') ──────────────────
  await L.overlay(rel(OVL));
  out.D.larder2s = await slowOpen('larder-2s-overlay', 2000);
  log('D Larder 2 s pull, overlay:', JSON.stringify({ during: out.D.larder2s.during, after: out.D.larder2s.after }));
  out.D.home = await coldHome('overlay');
  log('D Home cold load, overlay:', JSON.stringify(out.D.home));
  out.logs = phone.logs.filter(l => /error/i.test(l)).slice(0, 10);
  const ev = path.join(EVID, 'verify-initial-state-offline-1.json');
  fs.writeFileSync(ev, JSON.stringify(out, null, 2));
  log('evidence', rel(ev));
} finally { await L.close(); }
