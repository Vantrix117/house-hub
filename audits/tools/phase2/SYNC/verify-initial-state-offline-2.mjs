// SYNC skeptic #2 — finding "initial-state-offline": hub.sync.state starts as 'offline' (apps/hub.js:51) while the device is
// online, so Larder's "Can't reach the house list" line (apps/leftovers.html:183-186) shows on a warm open until the first
// pull ends, and the shell's Home treats "offline" as "pulled" (index.html:1158, 1221) on a cold load.
//   node "audits/tools/phase2/SYNC/verify-initial-state-offline-2.mjs"
// Independent of e11: samples the Larder frame on every animation frame (what is actually about to paint), records the pull
// request's own start/end, and runs at three API latencies plus two controls (truly offline; server answering 500).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p2', 'SYNC');
fs.mkdirSync(EVID, { recursive: true });
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const out = { larder: {}, home: {} };

// Runs in every frame before any page script: in the Larder frame, log #mode each animation frame and the leftovers pull.
const PROBE = () => {
  if (!/\/apps\/leftovers\.html$/.test(location.pathname)) return;
  const T = window.__probe = { frames: [], fetches: [] };
  const of = window.fetch;
  window.fetch = function (u, o) {
    const url = String(u); const rec = { url: url.replace(/^https?:\/\/[^/]+/, '').slice(0, 60), start: performance.now(), end: null, status: null };
    if (/\/api\/data\/leftovers\?/.test(url)) T.fetches.push(rec);
    return of.apply(this, arguments).then(r => { rec.end = performance.now(); rec.status = r.status; return r; }, e => { rec.end = performance.now(); rec.status = 'fail'; throw e; });
  };
  let last = '';
  const tick = () => {
    const m = document.getElementById('mode');
    const s = window.hub && window.hub.sync;
    const row = { vis: !!(m && !m.hidden), text: m && !m.hidden ? m.textContent : null, state: s ? s.state : null, lastPull: s ? s.lastPull : null, onLine: navigator.onLine };
    const k = JSON.stringify(row);
    if (k !== last) { T.frames.push({ t: Math.round(performance.now()), ...row }); last = k; }
    if (performance.now() < 8000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

function summarise(p) {
  const shown = p.frames.filter(f => f.vis);
  const firstOn = shown[0];
  const offAfter = firstOn && p.frames.find(f => f.t > firstOn.t && !f.vis);
  const pull = p.fetches[0];
  return {
    falseLinePainted: !!shown.find(f => f.onLine && /Can't reach/.test(f.text || '')),
    visibleFromMs: firstOn ? firstOn.t : null,
    hiddenAtMs: offAfter ? offAfter.t : null,
    visibleForMs: firstOn ? ((offAfter ? offAfter.t : null) ?? NaN) - firstOn.t : 0,
    stateWhileShown: firstOn ? { state: firstOn.state, onLine: firstOn.onLine, lastPull: firstOn.lastPull, text: firstOn.text } : null,
    pullRequest: pull ? { startMs: Math.round(pull.start), endMs: pull.end && Math.round(pull.end), status: pull.status } : null,
    transitions: p.frames,
  };
}

const L = await local({ variant: 'typical', clock: 'real' });
try {
  // ── A. Larder warm opens at three latencies ────────────────────────────────
  const ph = await L.newDevice({ name: 'Skeptic phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  await phone.ctx.addInitScript(PROBE);
  let f = await phone.openApp('leftovers');
  for (let i = 0; i < 60 && !(await f.evaluate(() => window.hub && hub.sync.lastPull > 0).catch(() => false)); i++) await sleep(250);
  await sleep(600);                                      // cache now warm (store.since > 0)
  out.larder.cacheSince = await f.evaluate(() => JSON.parse(localStorage.getItem('hub.cache.leftovers.family') || '{}').since || 0);

  let delay = 0;
  await phone.ctx.route(/\/api\/data\/leftovers\?/, async route => { if (delay) await sleep(delay); route.continue().catch(() => {}); });
  for (const ms of [0, 300, 1500]) {
    delay = ms;
    await phone.page.goto('about:blank');
    f = await phone.openApp('leftovers');
    await sleep(ms + 2500);
    const p = await f.evaluate(() => window.__probe);
    out.larder['latency' + ms] = summarise(p);
    const s = out.larder['latency' + ms];
    console.log(`Larder warm open, +${ms} ms API latency: false line painted=${s.falseLinePainted}, visible ${s.visibleFromMs}→${s.hiddenAtMs} ms (${s.visibleForMs} ms); pull ${JSON.stringify(s.pullRequest)}; while shown ${JSON.stringify(s.stateWhileShown)}`);
  }
  // screenshot mid-pull at 1500 ms latency
  delay = 1500;
  await phone.page.goto('about:blank');
  f = await phone.openApp('leftovers');
  await sleep(600);
  out.larder.midPullRead = await f.evaluate(() => ({ onLine: navigator.onLine, state: hub.sync.state, lastPull: hub.sync.lastPull, line: document.getElementById('mode').hidden ? null : document.getElementById('mode').textContent, items: document.querySelectorAll('#list li, #list .item, #list > *').length }));
  const shotA = path.join(EVID, 'v-initial-offline-2-larder-midpull.png');
  await phone.page.screenshot({ path: shotA, scale: 'css', animations: 'disabled', caret: 'hide' });
  out.larder.midPullShot = rel(shotA);
  console.log('Larder 0.6 s into a 1.5 s pull:', JSON.stringify(out.larder.midPullRead), '→', out.larder.midPullShot);
  delay = 0;

  // ── B. Controls: truly offline (line is correct) and server error (is the 'error' branch used instead?) ─────────
  // setOffline stores the switch in the tab's sessionStorage (site origin), so it must be flipped on a loaded page, then reload
  f = await phone.openApp('leftovers');
  await phone.setOffline(true);
  await phone.page.reload({ waitUntil: 'load' });
  await sleep(2500);
  f = phone.frame('leftovers');
  out.larder.controlOffline = f ? await f.evaluate(() => ({ onLine: navigator.onLine, state: hub.sync.state, line: document.getElementById('mode').hidden ? null : document.getElementById('mode').textContent })) : 'no frame';
  console.log('Control, truly offline:', JSON.stringify(out.larder.controlOffline));
  await phone.setOffline(false);

  await phone.ctx.unroute(/\/api\/data\/leftovers\?/);
  await phone.ctx.route(/\/api\/data\/leftovers\?/, route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"server_error"}' }));
  await phone.page.goto('about:blank');
  f = await phone.openApp('leftovers');
  await sleep(2000);
  out.larder.controlServer500 = await f.evaluate(() => ({ onLine: navigator.onLine, state: hub.sync.state, line: document.getElementById('mode').hidden ? null : document.getElementById('mode').textContent }));
  console.log('Control, server 500:', JSON.stringify(out.larder.controlServer500));
  await phone.ctx.unroute(/\/api\/data\/leftovers\?/);

  // ── C. Shell Home on a cold load (a device whose cache is empty) with a 2 s first pull ─────────────────────────
  const ph2 = await L.newDevice({ name: 'Skeptic cold phone', profiles: ['eli'] });
  const cold = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph2 });
  await cold.ctx.route(/\/api\/data\//, async route => { await sleep(2000); route.continue().catch(() => {}); });
  const serverReminders = await L.apiAs('eli', '/api/data/reminders?scope=family');
  out.home.serverReminderCount = ((serverReminders.body && serverReminders.body.items) || []).filter(i => i.value != null).length;
  await cold.page.goto(L.site + '/index.html#home', { waitUntil: 'domcontentloaded' });
  await sleep(700);
  const readHome = () => cold.page.evaluate(() => ({
    onLine: navigator.onLine, state: hub.sync.state, lastPull: hub.sync.lastPull,
    pulledExpr: !!hub.sync.lastPull || hub.sync.state === 'offline',
    skeletons: document.querySelectorAll('#view-home .skeleton').length,
    reminders: (document.getElementById('remlist') || {}).innerText || null,
    dot: (document.getElementById('syncdot') || {}).className || null,
  }));
  out.home.at700ms = await readHome();
  const shotC = path.join(EVID, 'v-initial-offline-2-home-cold-midpull.png');
  await cold.page.screenshot({ path: shotC, scale: 'css', animations: 'disabled', caret: 'hide' });
  out.home.midPullShot = rel(shotC);
  await sleep(3500);
  out.home.after = await readHome();
  console.log(`Home cold load, server has ${out.home.serverReminderCount} reminders. 0.7 s (pull pending):`, JSON.stringify(out.home.at700ms), '→', out.home.midPullShot);
  console.log('Home after the pull:', JSON.stringify(out.home.after));

  const file = path.join(EVID, 'v-initial-offline-2.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log('evidence', rel(file));
} finally { await L.close(); }
