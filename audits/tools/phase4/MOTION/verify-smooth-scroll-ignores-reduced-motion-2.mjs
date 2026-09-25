// Phase 4 MOTION skeptic #2 — do the apps' JS smooth scrolls (behavior:'smooth') still animate under Reduce Motion?
// Independent of rm-smooth.mjs: samples with BOTH requestAnimationFrame and a 4 ms setInterval (WebKit on Windows fires
// rAF sparsely), confirms the media emulation took (matchMedia), and covers three call sites:
//   F260 Reflect jump (apps/f260.html:1474, scrollIntoView smooth)
//   F260 window.scrollTo top:0 smooth as at apps/f260.html:1691/1736 (+ a behavior:'auto' control) from the bottom
//   Build guide section chips (apps/dollywood.html:1127, chips.scrollTo left smooth) at iPhone width
// Also records whether dollywood-live's mapIntoView (line 1140) can ever run (PHONE() is FLAVOR==='hub' only, line 689).
//   node "audits/tools/phase4/MOTION/verify-smooth-scroll-ignores-reduced-motion-2.mjs"
//   → audits/evidence/p4/MOTION/verify-smooth-scroll-ignores-reduced-motion-2.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const out = {};

const SAMPLER = `window.__sample = (getter, ms) => new Promise(res => {
  const s = []; const t0 = performance.now(); const push = () => s.push([Math.round(performance.now() - t0), Math.round(getter())]);
  push(); const iv = setInterval(push, 4); const raf = () => { push(); if (performance.now() - t0 < ms) requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  setTimeout(() => { clearInterval(iv); push(); s.sort((a, b) => a[0] - b[0]);
    const y0 = s[0][1], fin = s[s.length - 1][1]; const mids = [...new Set(s.filter(([, y]) => y !== y0 && y !== fin).map(([, y]) => y))];
    const reachAt = (s.find(([, y]) => y === fin) || [null])[0];
    res({ y0, final: fin, distinctIntermediate: mids.length, intermediateSample: mids.slice(0, 8), msToReachFinal: reachAt, nSamples: s.length }); }, ms);
});`;

for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  try {
    for (const rm of ['no-preference', 'reduce']) {
      const key = `${engine}-${rm}`; out[key] = {};
      // F260
      {
        const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
        await d.page.emulateMedia({ reducedMotion: rm });
        await d.page.goto(L.site + '/apps/f260.html', { waitUntil: 'load' });
        await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {});
        await sleep(1200);
        await d.page.evaluate(SAMPLER);
        out[key].mediaReduceMatches = await d.page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
        out[key].f260Reflect = await d.page.evaluate(async () => {
          const btn = document.getElementById('reflectBtn'); if (!btn) return { err: 'no reflectBtn' };
          const se = document.scrollingElement; se.scrollTop = 0; await new Promise(r => setTimeout(r, 100));
          const p = __sample(() => se.scrollTop, 900); btn.click(); return p;
        });
        // same window.scrollTo({top:0, behavior:'smooth'}) as apps/f260.html:1691/1736 (readStep is not global), then a
        // behavior:'auto' control showing what a jump looks like to this sampler
        for (const behavior of ['smooth', 'auto']) {
          out[key]['f260ScrollTop_' + behavior] = await d.page.evaluate(async (behavior) => {
            const se = document.scrollingElement; se.scrollTop = se.scrollHeight; await new Promise(r => setTimeout(r, 150));
            const start = se.scrollTop; const p = __sample(() => se.scrollTop, 900);
            window.scrollTo({ top: 0, behavior }); const r = await p; r.start = start; return r;
          }, behavior);
        }
        await d.close();
      }
      // Build guide chips (dollywood.html)
      {
        const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
        await d.page.emulateMedia({ reducedMotion: rm });
        await d.page.goto(L.site + '/apps/dollywood.html', { waitUntil: 'load', timeout: 90000 });
        await d.page.waitForFunction(() => document.querySelectorAll('#chips [data-sec]').length > 3, null, { timeout: 60000 }).catch(() => {});
        await sleep(1500);
        await d.page.evaluate(SAMPLER);
        out[key].buildGuideChips = await d.page.evaluate(async () => {
          const chips = document.getElementById('chips'); const all = [...chips.querySelectorAll('[data-sec]')];
          if (!all.length) return { err: 'no chips' };
          if (typeof selectSection !== 'function') return { err: 'selectSection not global' };
          const overflow = chips.scrollWidth - chips.clientWidth; chips.scrollLeft = 0; await new Promise(r => setTimeout(r, 100));
          const last = all[all.length - 1].dataset.sec; const p = __sample(() => chips.scrollLeft, 900);
          selectSection(last, false); const r = await p; r.overflowPx = overflow; r.chipCount = all.length; return r;
        });
        await d.close();
      }
      console.log(key, JSON.stringify(out[key]));
    }
  } finally { await L.close(); }
}
// Static: dollywood-live's mapIntoView gate
const live = fs.readFileSync('apps/dollywood-live.html', 'utf8').split('\n');
out.static = {
  liveFlavorLine688: live[687].slice(0, 80),
  livePhoneLine689: live[688].slice(0, 120),
  note: "PHONE() is FLAVOR==='hub' && max-width:699px, so in dollywood-live mapIntoView (line 1140) always returns before its smooth scroll",
};
fs.writeFileSync(path.join(EV, 'verify-smooth-scroll-ignores-reduced-motion-2.json'), JSON.stringify(out, null, 1));
console.log('wrote', path.join(EV, 'verify-smooth-scroll-ignores-reduced-motion-2.json'));
