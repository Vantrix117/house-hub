// Completeness critic: when does the Kitchen timer reach 0:00 relative to endAt? step() rounds (apps/timer.html:108), and
// the shell pill rounds too (index.html:815). Standalone app (no shell, so one clock), WebKit, controllable browser clock
// stepped 50 ms at a time. Records the offset (ms before/after endAt) of the first "0:59" after Start, of "0:00" + done,
// and of the shell's clear when run inside the hub.
// Run: node "audits/tools/phase3/timer/critic-early-finish.mjs"  -> audits/evidence/p3/timer/critic-early-finish.json
import { local, sleep } from '../../lib/local.mjs';
import { save, audioProbe } from './_util.mjs';
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: Date.now() });
  await audioProbe(d.ctx);
  await d.page.goto(L.site + '/apps/timer.html', { waitUntil: 'load' });
  const f = d.page;
  for (let i = 0; i < 100; i++) { if (await f.evaluate(() => typeof document.getElementById('go').onclick === 'function')) break; await d.ctx.clock.runFor(100); await sleep(20); }
  await f.click('[data-s="60"]'); await f.click('#go');
  const endAt = await f.evaluate(() => hub.get('timer.active').endAt);
  const rows = [];
  let first59 = null, done = null;
  const read = () => f.evaluate(() => ({ now: Date.now(), t: document.getElementById('t').textContent, done: document.body.classList.contains('done'), beeps: window.__audio ? window.__audio.made : null }));
  for (let i = 0; i < 40; i++) { await d.ctx.clock.runFor(50); const r = await read(); if (r.t === '0:59' && first59 == null) { first59 = { ...r, msAfterStart: r.now - (endAt - 60000) }; break; } }
  await d.ctx.clock.runFor(endAt - 2000 - (await read()).now);
  for (let i = 0; i < 60; i++) { await d.ctx.clock.runFor(50); const r = await read(); rows.push({ msToEnd: endAt - r.now, t: r.t, done: r.done }); if (r.done) { done = { ...r, msBeforeEndAt: endAt - r.now }; break; } }
  Object.assign(out, { endAt, first59, done, lastRows: rows.slice(-8) });
} finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('critic-early-finish.json', out));
