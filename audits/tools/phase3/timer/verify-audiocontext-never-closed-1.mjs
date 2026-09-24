// Skeptic #1 for finding "audiocontext-never-closed" (Kitchen timer). Independent of clocktz.mjs.
//  A  apps/timer.html standalone, browser clock installed: 1-min preset, Start, run 62 s to the end (beep), Start again ... x3,
//     all through the UI (clicks). Count AudioContexts constructed / close() calls / state of every context kept alive.
//  B  the shell (index.html#home, Timer app NOT open, real clock): timer.active written through the API 4 s ahead, shell pulls,
//     pill reaches 0 -> finishTimer -> timerBeep (index.html:788-796). x3. Same counts in the shell document.
// Run: node "audits/tools/phase3/timer/verify-audiocontext-never-closed-1.mjs"
// Output: audits/evidence/p3/timer/verify-audiocontext-never-closed-1.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer', 'verify-audiocontext-never-closed-1.json');
const probe = () => {
  const Real = window.AudioContext || window.webkitAudioContext;
  const log = window.__ac = { made: 0, closeCalls: 0, list: [] };
  if (!Real) { log.none = true; return; }
  class P extends Real { constructor(...a) { super(...a); log.made++; log.list.push(this); } close() { log.closeCalls++; return super.close(); } }
  window.AudioContext = P; window.webkitAudioContext = P;
};
const read = f => f.evaluate(() => { const l = window.__ac; return l.none ? { none: true } : { made: l.made, closeCalls: l.closeCalls, states: l.list.map(c => c.state), notClosed: l.list.filter(c => c.state !== 'closed').length }; });
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  { // A
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.now() });
    await d.ctx.addInitScript(probe);
    await d.page.goto(L.site + '/apps/timer.html');
    await d.page.waitForFunction(() => window.hub && hub.profile && document.getElementById('go'));
    await d.ctx.clock.runFor(1500);
    const f = d.page.mainFrame();
    await f.click('[data-s="60"]');
    const runs = [];
    for (let i = 0; i < 3; i++) {
      await f.click('#go'); await d.ctx.clock.runFor(62000); await sleep(400);
      runs.push({ run: i + 1, time: await f.textContent('#t'), done: await f.evaluate(() => document.body.classList.contains('done')), ...(await read(f)) });
    }
    await d.ctx.clock.runFor(120000); await sleep(300);
    out.A_timerApp = { runs, twoMinutesAfterLast: await read(f), engine: 'chromium' };
    await d.close();
  }
  { // B
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.ctx.addInitScript(probe);
    await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile); await sleep(1500);
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const now = Date.now();
      const w = await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: { endAt: now + 4000, total: 60, startedAt: now - 56000 }, updated_at: now } ] } });
      await d.page.evaluate(() => hub.pull()).catch(e => String(e));
      await sleep(8000);
      runs.push({ run: i + 1, write: w.status, pill: await d.page.evaluate(() => document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent),
        toastSeen: await d.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t ? t.textContent : null; }), ...(await read(d.page)) });
    }
    out.B_shell = { runs };
    await d.close();
  }
} finally { await L.close(); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
console.log('saved', path.relative(ROOT, OUT));
