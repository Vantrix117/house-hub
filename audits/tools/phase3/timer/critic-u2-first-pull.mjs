// Completeness critic, for Unresolved U-2 ("the first API-written timer after the shell loaded produced no beep or toast").
// Hypothesis: a rig artefact. hub.pull() returns the pull already in flight (apps/hub.js:303 `if (pulling) return pulling`),
// so a pull requested right after the write can be the shell's first pull, which started before the write and misses it;
// the next pull is 30 s later. Chromium (real AudioContext), Kitchen iPad as Eli, Home, Timer app closed.
//  A: write 1.5 s after hub.profile appears (as the skeptic did), then hub.pull(); was a pull already in flight?
//  B: wait for the first pull to finish (hub.sync.lastPull set), then write and hub.pull().
// Run: node "audits/tools/phase3/timer/critic-u2-first-pull.mjs"  -> audits/evidence/p3/timer/critic-u2-first-pull.json
import { local, sleep } from '../../lib/local.mjs';
import { save, audioProbe, notifyProbe, toastText } from './_util.mjs';
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  for (const mode of ['A', 'B']) {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await audioProbe(d.ctx); await notifyProbe(d.ctx);
    await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.profile);
    if (mode === 'A') await sleep(1500); else await d.page.waitForFunction(() => hub.sync && hub.sync.lastPull, null, { timeout: 20000 });
    const o = out[mode] = { lastPullBeforeWrite: await d.page.evaluate(() => hub.sync.lastPull || null) };
    const now = Date.now();
    await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: { endAt: now + 4000, total: 60, startedAt: now - 56000 }, updated_at: now }] } });
    o.samePromise = await d.page.evaluate(() => { const p1 = hub.pull(), p2 = hub.pull(); return p1 === p2; });
    await sleep(8000);
    o.at8s = { beeps: await d.page.evaluate(() => window.__audio.made), notify: await d.page.evaluate(() => window.__notify.shown.length), cacheTimerValue: await d.page.evaluate(() => { const it = JSON.parse(localStorage.getItem('hub.cache.timer.person.eli') || '{"items":{}}').items['timer.active']; return it ? it.v : 'absent'; }), lastPull: await d.page.evaluate(() => hub.sync.lastPull) };
    o.writeAt = now;
    await d.close();
  }
} finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('critic-u2-first-pull.json', out));
