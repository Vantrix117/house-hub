// Phase 4 MOTION — what keeps running while nobody touches the screen (the iPad and the TV are open 24/7).
// Chromium (installed Chrome) via CDP Performance metrics, real browser clock. For each area it loads the surface, waits
// for the first pull plus 3 s, then idles for IDLE ms and records: main-thread busy % (TaskDuration), script %, style
// recalcs and layouts per second, requestAnimationFrame calls per second, live setInterval timers (period in ms), and
// the CSS/Web animations that are running with infinite iterations (document.getAnimations()).
// Shell surfaces load index.html#home; apps load standalone by URL (apps/<id>.html) as the given profile.
//   node "audits/tools/phase4/MOTION/idle.mjs" [areaFilter…]   → audits/evidence/p4/MOTION/idle.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const IDLE = +(process.env.IDLE_MS || 10000);   // IDLE_MS=60000 for the TV's 45 s rotation
const VARIANT = process.env.VARIANT || 'typical';  // VARIANT=park for the park map's live state
const SURF = [
  ['shell-home-adult', 'ipad-portrait', 'eli', '#home'],
  ['shell-home-kid', 'ipad-portrait', 'ezra', '#home'],
  ['shell-apps-adult', 'ipad-portrait', 'eli', '#apps'],
  ['tv-board', 'tv', 'tv', '#home'],
  ['f260', 'ipad-portrait', 'eli', 'apps/f260.html'],
  ['leftovers', 'ipad-portrait', 'eli', 'apps/leftovers.html'],
  ['prayer', 'ipad-portrait', 'eli', 'apps/prayer.html'],
  ['tally', 'ipad-portrait', 'eli', 'apps/tally.html'],
  ['timer', 'ipad-portrait', 'eli', 'apps/timer.html'],
  ['dollywood', 'ipad-portrait', 'eli', 'apps/dollywood.html'],
  ['dollywood-live', 'ipad-portrait', 'eli', 'apps/dollywood-live.html'],
  ['kidverse-kid', 'ipad-portrait', 'ezra', 'apps/kidverse.html'],
  ['verses', 'ipad-portrait', 'eli', 'apps/verses.html'],
];
const want = process.argv.slice(2);
const INSTR = () => {
  const w = window; w.__mo = { raf: 0, iv: new Map(), seq: 0 };
  const sI = w.setInterval, cI = w.clearInterval, rAF = w.requestAnimationFrame;
  w.setInterval = function (fn, ms, ...a) { const id = sI.call(w, fn, ms, ...a); w.__mo.iv.set(id, ms | 0); return id; };
  w.clearInterval = function (id) { w.__mo.iv.delete(id); return cI.call(w, id); };
  w.requestAnimationFrame = function (cb) { w.__mo.raf++; return rAF.call(w, cb); };
};
const out = {};
const L = await local({ variant: VARIANT, engine: 'chromium' });
try {
  for (const [name, device, profile, where] of SURF) {
    if (want.length && !want.some(w => name.includes(w))) continue;
    const d = await L.device({ device, profile, fixedTime: false });
    await d.ctx.addInitScript(INSTR);
    if (where.startsWith('#')) await d.goto(where); else await d.page.goto(L.site + '/' + where, { waitUntil: 'load' });
    await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 20000 }).catch(() => {});
    await sleep(3000);
    const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Performance.enable');
    const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    const snap = () => d.page.evaluate(() => ({ raf: window.__mo ? __mo.raf : null, t: performance.now() }));
    const a = await m(), s0 = await snap();
    await sleep(IDLE);
    const b = await m(), s1 = await snap();
    const sec = IDLE / 1000;
    const state = await d.page.evaluate(() => {
      const anims = document.getAnimations().filter(x => x.playState === 'running');
      const inf = anims.filter(x => { const t = x.effect && x.effect.getComputedTiming(); return t && t.iterations === Infinity; });
      const desc = x => { const el = x.effect && x.effect.target; const t = x.effect.getComputedTiming(); return `${x.animationName || x.transitionProperty || x.id || 'anim'} ${Math.round(t.duration)}ms on ${el ? (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList && el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '')) : '?'}`; };
      return { running: anims.length, infinite: inf.map(desc), intervalsMs: window.__mo ? [...__mo.iv.values()].sort((p, q) => p - q) : null, hidden: document.hidden };
    });
    const r = {
      device, profile, where,
      busyPct: +(((b.TaskDuration - a.TaskDuration) / sec) * 100).toFixed(1),
      scriptPct: +(((b.ScriptDuration - a.ScriptDuration) / sec) * 100).toFixed(1),
      stylePerSec: +((b.RecalcStyleCount - a.RecalcStyleCount) / sec).toFixed(1),
      layoutPerSec: +((b.LayoutCount - a.LayoutCount) / sec).toFixed(1),
      rafPerSec: s0.raf == null ? null : +((s1.raf - s0.raf) / ((s1.t - s0.t) / 1000)).toFixed(1),
      ...state,
    };
    out[name] = r;
    console.log(name.padEnd(18), `busy ${r.busyPct}%  script ${r.scriptPct}%  style/s ${r.stylePerSec}  layout/s ${r.layoutPerSec}  rAF/s ${r.rafPerSec}  running ${r.running}  intervals ${JSON.stringify(r.intervalsMs)}\n${' '.repeat(19)}infinite ${JSON.stringify(r.infinite)}`);
    await d.close();
  }
} finally {
  const f = path.join(EV, want.length || VARIANT !== 'typical' || IDLE !== 10000 ? `idle-${[...want, VARIANT, IDLE].join('-')}.json` : 'idle.json');
  fs.writeFileSync(f, JSON.stringify({ engine: 'chromium', variant: VARIANT, idleMs: IDLE, out }, null, 1));
  await L.close();
}
