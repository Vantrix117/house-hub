// Skeptic #1 for finding "done-dial-oval": does the dial stop being round when the countdown reaches 0:00?
// Real UI path only: tap "1 min", tap Start, wait out the minute on the real clock, measure #dial before/at/after.
// Also: Reset (class 'empty' removed) should restore the round dial. iPhone PWA (Eli) and iPad portrait (Mom), in the shell.
// Run: node "audits/tools/phase3/timer/verify-done-dial-oval-1.mjs"   (takes ~75 s)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVD = path.join(ROOT, 'audits', 'evidence', 'p3', 'timer');
fs.mkdirSync(EVD, { recursive: true });
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const measure = f => f.evaluate(() => {
  const el = document.getElementById('dial'), r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  const svg = el.querySelector('svg').getBoundingClientRect();
  const go = document.getElementById('go').getBoundingClientRect();
  // which stylesheet rules set padding on the dial right now
  const rules = [];
  for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch { continue; }
    for (const ru of rs) if (ru.selectorText && ru.style && ru.style.padding && el.matches(ru.selectorText)) rules.push(`${(sh.href || 'inline').split('/').pop()}: ${ru.selectorText} { padding: ${ru.style.padding} }`); }
  return { time: document.getElementById('t').textContent, classes: el.className, bodyDone: document.body.classList.contains('done'),
    w: +r.width.toFixed(1), h: +r.height.toFixed(1), ratio: +(r.height / r.width).toFixed(3), padding: cs.padding, radius: cs.borderRadius,
    svg: { w: +svg.width.toFixed(1), h: +svg.height.toFixed(1) }, startBtnTop: Math.round(go.top), innerHeight, paddingRules: rules };
});

const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const out = {};
try {
  const run = async (key, device, profile) => {
    const d = await L.device({ device, profile, fixedTime: false });
    const f = await d.openApp('timer', { wait: '#go' });
    await f.waitForFunction(() => window.hub && hub.profile);
    await sleep(800);
    await f.click('[data-s="60"]'); await sleep(300);
    const idle = await measure(f);
    await f.click('#go'); await sleep(1500);
    const running = await measure(f);
    return { d, f, idle, running, key };
  };
  const A = await Promise.all([run('iphone', 'iphone-pwa', 'eli'), run('ipad', 'ipad-portrait', 'mom')]);
  await sleep(62000);                                   // let the 1-minute countdown finish on the real clock
  for (const x of A) {
    const done = await measure(x.f);
    const png = path.join(EVD, `verify-done-dial-oval-1-${x.key}-done.png`);
    await x.d.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
    await x.f.click('#reset'); await sleep(500);
    const afterReset = await measure(x.f);
    const png2 = path.join(EVD, `verify-done-dial-oval-1-${x.key}-reset.png`);
    await x.d.page.screenshot({ path: png2, scale: 'css', animations: 'disabled', caret: 'hide' });
    out[x.key] = { idle: x.idle, running: x.running, done, afterReset, shots: [rel(png), rel(png2)], logs: x.d.logs.filter(l => /error/i.test(l)).slice(0, 5) };
  }
} finally { await L.close(); }
const f = path.join(EVD, 'verify-done-dial-oval-1.json');
fs.writeFileSync(f, JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) for (const s of ['idle', 'running', 'done', 'afterReset'])
  console.log(k, s.padEnd(10), v[s].time, `${v[s].w}x${v[s].h}`, 'ratio', v[s].ratio, 'pad', v[s].padding, 'svg', `${v[s].svg.w}x${v[s].svg.h}`, 'startTop', v[s].startBtnTop, '|', v[s].classes, '|', v[s].paddingRules.join(' ; '));
console.log('saved', rel(f));
