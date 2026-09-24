// STAB (2): are the long-running timers computed from timestamps (right after a suspended tab resumes) or by counting ticks?
//   node "audits/tools/phase2/STAB/timers.mjs"
//
// Playwright clock.fastForward(t) jumps the page clock and fires each due timer at most once — what a suspended iPad tab
// sees when it wakes. After every jump the script reads what is on screen:
//   A  the shell's timer pill (index.html:813-823) for a 10-minute timer started in the real Timer app
//   B  the Kitchen timer app itself (apps/timer.html:103-110) — mid-countdown and past the end
//   C  finishing while suspended: 30 s past the end vs 5 min past the end (index.html:804-810, `recent` < 60 s)
//   D  the TV clock (index.html:1111-1116): clock text, repaint, feed refresh right after a 10-minute jump
//   E  hub.js: the 30 s poll after a jump (one pull, not twenty) and the flush retry timer (apps/hub.js:269) after a jump
// Engine: WebKit (the iPad's engine). Clock: the Worker on real time; each browser context installs its own clock.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { settle, track, shot1x } from './advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const R = {};
const log = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)); };
try {
  // ── A + B + C: Eli on the iPad ────────────────────────────────────────────────────────────────────────────────
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.now() });
  track(d);
  await d.goto('#home'); await d.page.waitForSelector('#view-home .card');
  const ff = async (t) => { await d.ctx.clock.fastForward(t); await settle(d); };
  const pill = () => d.page.evaluate(() => ({ pillHidden: document.getElementById('timer-pill').hidden, pill: document.getElementById('timer-pill-time').textContent,
    chipHidden: document.getElementById('pill-timer').hidden, chip: document.getElementById('pill-timer-time').textContent,
    toast: (() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; })(),
    active: (() => { try { return hub.get('timer.active', { app: 'timer', scope: 'person' }) || null; } catch (e) { return String(e); } })() }));
  // B: start 10 min in the real app (Eli's last preset is 10 min in the seed; click the chip anyway)
  let f = await d.openApp('timer', { wait: '#go' });
  await f.click('[data-s="600"]'); await f.click('#go'); await d.ctx.clock.runFor(1000); await settle(d);
  const appT = () => f.evaluate(() => ({ t: document.getElementById('t').textContent, done: document.body.classList.contains('done'), go: document.getElementById('go').textContent }));
  log('B0 app just started', await appT());
  await ff('04:00');
  log('B1 app after fastForward 4:00 (expect 6:00; tick counting would show ~9:59)', await appT());
  log('B1 shell chip while the app is open', await pill());
  // A: close the viewer, the Home pill takes over
  await d.page.click('#pill-home'); await d.ctx.clock.runFor(1000); await settle(d);
  await d.page.evaluate(() => { location.hash = '#home'; }); await d.ctx.clock.runFor(500); await settle(d);
  log('A0 Home pill after closing the app', await pill());
  await ff('03:00');
  log('A1 pill after fastForward 3:00 (expect ~2:59-3:00 left)', await pill());
  await shot1x(d, path.join(OUT, 'timers-pill-after-ff.png'));
  // C1: wake 30 s after the end → beep + toast + cleared
  await ff('03:30');
  log('C1 pill after waking 30 s past the end (recent: toast expected)', await pill());
  // C2: another 10-minute timer, wake 5 min past the end → silently cleared (index.html:806 recent = < 60 s)
  f = await d.openApp('timer', { wait: '#go' });
  await f.click('[data-s="600"]'); await f.click('#go'); await d.ctx.clock.runFor(1000); await settle(d);
  await d.page.click('#pill-home'); await d.ctx.clock.runFor(1000); await d.page.evaluate(() => { location.hash = '#home'; }); await d.ctx.clock.runFor(500); await settle(d);
  log('C2a pill, second timer running', await pill());
  await ff('15:00');
  log('C2b pill after waking 5 min past the end (no toast, record cleared)', await pill());
  const srv = await L.apiAs('eli', '/api/data/timer?scope=person');
  log('C2c server timer.active after the shell cleared it', (srv.body.items || []).filter(i => i.key === 'timer.active').map(i => ({ value: i.value })));
  // B2: the app open and suspended past the end
  f = await d.openApp('timer', { wait: '#go' });
  await f.click('[data-s="60"]'); await f.click('#go'); await d.ctx.clock.runFor(1000); await settle(d);
  await ff('05:00');
  log('B2 app open, woken 4 min past the end of a 1-min timer', { ...(await appT()), shell: await pill() });
  await d.page.click('#pill-home'); await d.ctx.clock.runFor(1000); await settle(d);

  // ── E: hub.js poll and retry after a jump ────────────────────────────────────────────────────────────────────
  const T = track(d);
  await d.page.evaluate(() => { location.hash = '#home'; }); await d.ctx.clock.runFor(35000); await settle(d);
  await sleep(1500);
  const urls = []; const onReq = r => { if (r.url().includes('/api/data/')) urls.push(r.url().replace(L.api, '').replace(/&since=\d+/, '')); };
  d.page.on('request', onReq);
  await d.ctx.clock.fastForward('10:00'); await sleep(2500);            // real time only: no further fake timers fire
  d.page.off('request', onReq);
  log('E1 /api/data requests caused by a 10-minute jump (one pull = one request per shell channel, not 20 pulls)', { requests: urls.length, distinct: [...new Set(urls)].length, urls });
  // flush retry: the API refuses (navigator.onLine stays true, so no 'online' event will rescue it) → scheduleFlush(5000)
  const block = u => u.href.startsWith(L.api) && u.href.includes('/batch');
  await d.ctx.route(block, r => r.abort('connectionrefused'));
  await d.page.evaluate(() => hub.set('item:stab-retry', { id: 'stab-retry', text: 'STAB retry test', by: 'eli', byName: 'Eli', createdAt: Date.now() }, { app: 'reminders', scope: 'family' }));
  await d.ctx.clock.runFor(1000); await settle(d);
  const s1 = await d.page.evaluate(() => ({ ...hub.sync }));
  await d.ctx.unroute(block);
  await ff('02:00');                           // a suspended tab wakes 2 min later: the 5 s retry fires once
  await d.ctx.clock.runFor(500); await settle(d);
  const s2 = await d.page.evaluate(() => ({ ...hub.sync }));
  const onServer = (await L.apiAs('eli', '/api/data/reminders?scope=family')).body.items.some(i => i.key === 'item:stab-retry' && i.value);
  log('E2 flush retry after a jump', { afterFailure: { state: s1.state, pending: s1.pending, lastError: s1.lastError }, afterWake: { state: s2.state, pending: s2.pending }, onServer });
  await d.close();

  // ── D: the TV clock ───────────────────────────────────────────────────────────────────────────────────────────
  const tv = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() });
  track(tv);
  await tv.goto('#home'); await tv.page.waitForSelector('#tv #clock'); await tv.ctx.clock.runFor(2000); await settle(tv);
  const tvState = () => tv.page.evaluate(() => ({ now: new Date().toTimeString().slice(0, 8), clock: document.getElementById('clock').textContent, date: document.getElementById('tv-date').textContent,
    feedAgo: [...document.querySelectorAll('#tv-feed .when')].slice(0, 2).map(e => e.textContent), st: window.__tv.state() }));
  const t0 = await tvState(); const feedReq0 = tv._track.byKind.activity || 0;
  await tv.ctx.clock.fastForward('10:00'); await settle(tv, { min: 300 });
  const t1 = await tvState();
  log('D TV after a 10-minute jump', { before: { now: t0.now, clock: t0.clock, feedAgo: t0.feedAgo }, after: { now: t1.now, clock: t1.clock, feedAgo: t1.feedAgo },
    repaintedSinceJump: t1.st.lastPaint > t0.st.lastPaint, crossfadedSinceJump: t1.st.lastFade > t0.st.lastFade, feedFetches: (tv._track.byKind.activity || 0) - feedReq0 });
  fs.writeFileSync(path.join(OUT, 'timers.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
