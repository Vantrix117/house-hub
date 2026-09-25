// Phase 4 MOTION skeptic 1 — do behavior:'smooth' JS scrolls animate under prefers-reduced-motion: reduce?
// Independent of rm-smooth.mjs: records every `scroll` event position (not rAF samples), for three cases on F260
// standalone at iphone-pwa: (a) a real tap on F260's Reflect button (apps/f260.html:1474, scrollIntoView smooth),
// (b) window.scrollTo({top:0, behavior:'smooth'}) as readStep does (apps/f260.html:1736), (c) an overflow-x element
// scrollTo({left, behavior:'smooth'}) as the Dollywood chip bar does (apps/dollywood*.html:1127). Control: behavior 'auto'.
//   node "audits/tools/phase4/MOTION/verify-smooth-scroll-ignores-reduced-motion-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const out = {};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  try {
    for (const rm of ['reduce', 'no-preference']) {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
      await d.page.emulateMedia({ reducedMotion: rm });
      await d.page.goto(L.site + '/apps/f260.html', { waitUntil: 'load' });
      await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {});
      await sleep(1200);
      const env = await d.page.evaluate(() => ({ mq: matchMedia('(prefers-reduced-motion: reduce)').matches,
        htmlScrollBehavior: getComputedStyle(document.documentElement).scrollBehavior, docH: document.scrollingElement.scrollHeight,
        reflectHidden: document.getElementById('reflectBtn')?.hidden }));
      // install a scroll-event recorder
      const rec = () => d.page.evaluate(() => { window.__ev = []; window.__t0 = performance.now();
        const on = e => { const t = e.target === document ? document.scrollingElement : e.target; window.__ev.push([Math.round(performance.now() - window.__t0), Math.round(t.scrollTop || t.scrollLeft)]); };
        window.__on && document.removeEventListener('scroll', window.__on, true); window.__on = on; document.addEventListener('scroll', on, true); });
      const read = async () => { await sleep(900); return d.page.evaluate(() => { const ev = window.__ev; const fin = ev.length ? ev[ev.length - 1][1] : null;
        return { events: ev.length, distinctPositions: new Set(ev.map(e => e[1])).size, durationMs: ev.length ? ev[ev.length - 1][0] - ev[0][0] : 0, final: fin, trace: ev.slice(0, 8) }; }); };
      const r = { env };
      // (a) real tap on Reflect
      await d.page.evaluate(() => { document.scrollingElement.scrollTop = 0; const b = document.getElementById('reflectBtn'); if (b) b.hidden = false; });
      await sleep(300); await rec();
      const btn = d.page.locator('#reflectBtn');
      if (await btn.isVisible()) { await btn.click(); r.reflectTap = await read(); } else r.reflectTap = { err: 'reflectBtn not visible' };
      // (b) window.scrollTo top smooth (readStep) vs auto
      for (const beh of ['smooth', 'auto']) {
        await d.page.evaluate(() => { document.scrollingElement.scrollTop = 1500; }); await sleep(300); await rec();
        await d.page.evaluate(b => window.scrollTo({ top: 0, behavior: b }), beh); r['windowTop_' + beh] = await read();
      }
      // (c) overflow element scrollTo left smooth (Dollywood chips) vs auto
      await d.page.evaluate(() => { const s = document.createElement('div'); s.id = '__chips'; s.style.cssText = 'position:fixed;top:0;left:0;width:300px;height:40px;overflow-x:auto;white-space:nowrap;z-index:99';
        s.innerHTML = '<div style="display:inline-block;width:3000px;height:10px"></div>'; document.body.appendChild(s); });
      for (const beh of ['smooth', 'auto']) {
        await d.page.evaluate(() => { document.getElementById('__chips').scrollLeft = 0; }); await sleep(300); await rec();
        await d.page.evaluate(b => document.getElementById('__chips').scrollTo({ left: 1200, behavior: b }), beh); r['chips_' + beh] = await read();
      }
      out[`${engine}-${rm}`] = r;
      console.log(engine, rm, JSON.stringify({ env, a: [r.reflectTap.events, r.reflectTap.distinctPositions, r.reflectTap.durationMs, r.reflectTap.final],
        bS: [r.windowTop_smooth.events, r.windowTop_smooth.durationMs], bA: [r.windowTop_auto.events, r.windowTop_auto.durationMs],
        cS: [r.chips_smooth.events, r.chips_smooth.durationMs], cA: [r.chips_auto.events, r.chips_auto.durationMs] }));
      await d.close();
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EV, 'verify-smooth-scroll-ignores-reduced-motion-1.json'), JSON.stringify(out, null, 1));
