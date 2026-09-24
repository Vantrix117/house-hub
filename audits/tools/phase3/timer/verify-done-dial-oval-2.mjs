// Skeptic #2 for finding "done-dial-oval": does the timer dial stop being round at 0:00, and is the cause the design.css
// empty-state rule `.ds .empty` matching the dial's `empty` class? Driven through the real UI (1 min preset -> Start ->
// the browser clock fast-forwarded past 0), on three devices, with a control (the class removed in the done state).
// Run: node "audits/tools/phase3/timer/verify-done-dial-oval-2.mjs"
// Output: audits/evidence/p3/timer/verify-done-dial-oval-2.json + verify-done-dial-oval-2-*.png
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
const EVD = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer');
fs.mkdirSync(EVD, { recursive: true });
const out = { runs: [] };
const measure = f => f.evaluate(() => {
  const el = document.getElementById('dial'), r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  const act = document.querySelector('.actions').getBoundingClientRect();
  const rules = [];
  for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch { continue; }
    for (const ru of rs) if (ru.selectorText && /padding/.test(ru.cssText) && el.matches(ru.selectorText)) rules.push(ru.selectorText + ' { padding: ' + ru.style.padding + ' }'); }
  return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), padding: cs.padding, classes: el.className, time: document.getElementById('t').textContent,
    bodyDone: document.body.classList.contains('done'), actionsTop: Math.round(act.top), paddingRulesMatching: rules };
});
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  for (const [device, mode] of [['iphone-pwa', 'light'], ['ipad-portrait', 'dark'], ['desktop', 'light']]) {
    const d = await L.device({ device, mode, profile: 'eli', fixedTime: false, installClock: Date.now() });
    await d.goto('#home'); await sleep(1200);
    const f = await d.openApp('timer');
    await f.waitForFunction(() => window.hub && document.getElementById('go')); await sleep(600);
    await f.click('[data-s="60"]'); await sleep(200);
    const idle = await measure(f);
    await f.click('#go'); await d.ctx.clock.runFor(2000); await sleep(300);
    const running = await measure(f);
    // step the clock 1 s at a time (so storage events and pulls interleave as in real time) until 0:00
    for (let i = 0; i < 62; i++) { await d.ctx.clock.runFor(1000); await sleep(40); }
    await sleep(800);
    const done = await measure(f);
    const png = `verify-done-dial-oval-2-done-${device}-${mode}.png`;
    await d.page.screenshot({ path: path.join(EVD, png), scale: 'css', animations: 'disabled', caret: 'hide' });
    // control: same done state, only the `empty` class removed from #dial
    await f.evaluate(() => document.getElementById('dial').classList.remove('empty'));
    const controlNoEmpty = await measure(f);
    await f.evaluate(() => document.getElementById('dial').classList.add('empty'));
    const run = { device, mode, idle, running, done, controlNoEmpty, png: 'audits/evidence/p3/timer/' + png,
      aspectDone: +(done.h / done.w).toFixed(3), actionsShiftPx: done.actionsTop - running.actionsTop };
    out.runs.push(run);
    console.log(device, mode, '| running', running.w + 'x' + running.h, running.padding, '| done', done.time, done.w + 'x' + done.h, done.padding,
      '| control(no .empty)', controlNoEmpty.w + 'x' + controlNoEmpty.h, controlNoEmpty.padding, '| buttons moved', run.actionsShiftPx, 'px');
    console.log('   padding rules matching #dial at done:', done.paddingRulesMatching.join(' ; '));
    await d.ctx.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EVD, 'verify-done-dial-oval-2.json'), JSON.stringify(out, null, 1));
console.log('wrote audits/evidence/p3/timer/verify-done-dial-oval-2.json');
