// Probe 5: Reset -> Undo, timed; then the same with a second device that ticks in the 10 s window and is pulled before Undo.
import { local, sleep, DEMO, rows, texts, ready } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const count = r => { const n = p => Object.keys(r).filter(k => k.startsWith(p) && r[k] !== false && r[k] != null).length; return { done: n('done:'), log: n('log:'), recall: n('recall:'), mem: n('mem:'), week: r['f260.week'], best: r['f260.best'] && r['f260.best'].n, miles: Object.keys(r['f260.miles'] || {}).length, jentries: (r['f260.jstats'] || {}).entries, ws: Object.keys(r['f260.weekStart'] || {}).length, wd: Object.keys(r['f260.weekDone'] || {}).length }; };
try {
  for (const mode of ['plain', 'otherPulled', 'otherUnpulled']) {
    await L.reset('typical');
    const A = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    const fa = await A.openApp('f260'); await ready(fa);
    await fa.evaluate(() => hub.pull()); await sleep(300);
    const s0 = count(await rows(L, 'eli'));
    const t0 = Date.now();
    await fa.evaluate(() => { document.getElementById('settingsBtn').click(); document.getElementById('resetBtn').click(); document.getElementById('doConfirm').click(); });
    await A.ctx.clock.runFor(1500); await sleep(800);
    const s1 = count(await rows(L, 'eli'));
    let B, fb, sB = null;
    if (mode !== 'plain') {
      B = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO + 3000 });
      fb = await B.openApp('f260'); await ready(fb);
      sB = await texts(fb, ['#todayTitle', '#doneCount']);
      await fb.evaluate(() => document.querySelector('[data-day="45-0"] .mark').click()); await sleep(300);
      await fb.evaluate(() => hub.flush()); await sleep(600);
      if (mode === 'otherPulled') { await fa.evaluate(() => hub.pull()); await sleep(600); }
    }
    const toastBefore = await fa.evaluate(() => { const t = document.getElementById('hub-toast'); return t ? { hidden: t.hidden, text: t.textContent, act: !!t.querySelector('.toast-act') } : null; });
    await fa.evaluate(() => document.querySelector('#hub-toast .toast-act').click());
    await A.ctx.clock.runFor(1500); await sleep(500); await fa.evaluate(() => hub.flush()); await sleep(1500);
    const r2 = await rows(L, 'eli'); const s2 = { ...count(r2), d450: r2['done:45-0'], ws45: (r2['f260.weekStart'] || {})['45'], ws1: (r2['f260.weekStart'] || {})['1'], log0: r2['log:2026-09-22'] };
    const shown = await texts(fa, ['#doneCount', '#todayTitle']);
    out[mode] = { s0, s1, s2, toastBefore, realMsReset2Undo: Date.now() - t0, shown, sB, logs: A.logs.filter(l => /error/i.test(l)).slice(0, 5) };
    if (B) await B.close();
    await A.close();
  }
} catch (e) { out.err = String(e && e.stack || e); }
finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
