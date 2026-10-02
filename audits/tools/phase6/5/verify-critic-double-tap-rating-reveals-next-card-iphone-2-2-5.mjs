// Batch 5 copy of audits/tools/phase3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-2.mjs. WHY A COPY: stale tooling — its four cases share one
// rig household that is never reset, and ratings reach the server despite the batch-write abort, so Eli's three due
// verses run out and the fourth case waits for a card that is not there (on the batch 5 code, whose double-tap guard
// changes nothing here). This copy resets the household before each case, reads the recall:<id> rows (not the old whole
// map f260.recall) and writes evidence under p6/5. The taps, gaps and timings are the original's.
//   node "audits/tools/phase6/5/verify-critic-double-tap-rating-reveals-next-card-iphone-2-2-5.mjs"
// Skeptic #2: does a double tap on a rating button at phone width reveal the next card?
// Uses real touch taps (page.touchscreen.tap; design.css:303,312 set touch-action: manipulation, so iOS sends one click per tap),
// iphone-pwa and iphone-safari (both 430 px wide), tap gaps 120 ms and 250 ms. Batch writes aborted so each run starts from the seed.
// Also a third tap (the "rates an unrecited verse" consequence) and the element geometry under the Got it centre.
// Run: node "audits/tools/phase3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-2.mjs"
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const P = 'audits/evidence/p6/5/verify-critic-double-tap-rating-reveals-next-card-iphone-2-2-5'; fs.mkdirSync('audits/evidence/p6/5', { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = { runs: [] };
const S = f => f.evaluate(() => ({ ref: document.querySelector('#ref').textContent, trainer: !document.querySelector('#trainer').hidden,
  rateShown: !document.querySelector('#act-rate').hidden, veiled: document.querySelector('#text').classList.contains('veiled'),
  textHidden: document.querySelector('#text').hidden, who: document.querySelector('#who').textContent.trim() }));
try {
  for (const [device, gap, third] of [['iphone-pwa', 120, false], ['iphone-pwa', 250, true], ['iphone-safari', 120, false], ['ipad-portrait', 120, false]]) {
    await L.reset('typical');
    const d = await L.device({ device, profile: 'eli', installClock: DEMO });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    const f = await d.openApp('verses');
    await f.waitForSelector('#trainer:not([hidden])', { timeout: 12000 }); await sleep(400);
    const off = await d.page.evaluate(() => { const r = document.querySelector('iframe').getBoundingClientRect(); return { x: r.x, y: r.y }; });
    const at = async sel => f.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
    const tap = p => d.page.touchscreen.tap(off.x + p.x, off.y + p.y);
    await tap(await at('#show')); await sleep(250);
    const s0 = await S(f);
    const got = await at('[data-rate="got"]');
    await tap(got); await sleep(gap);
    const under = await f.evaluate(p => { const e = document.elementFromPoint(p.x, p.y); const b = e && e.closest('button'); return b ? (b.id || b.dataset.rate) : e && e.tagName; }, got);
    const s1 = await S(f);
    await tap(got); await sleep(400);
    const s2 = await S(f);
    const run = { device, gapMs: gap, before: s0, afterFirstTap: s1, elementUnderFingerBeforeSecondTap: under, afterSecondTap: s2 };
    if (s2.rateShown) { run.shot = P + '-' + device + '-' + gap + '.png'; await d.page.screenshot({ path: run.shot, scale: 'css' }); }
    if (third) {
      const under3 = await f.evaluate(p => { const e = document.elementFromPoint(p.x, p.y); const b = e && e.closest('button'); return b ? (b.id || b.dataset.rate) : e && e.tagName; }, got);
      await tap(got); await sleep(400);
      run.elementUnderFingerBeforeThirdTap = under3; run.afterThirdTap = await S(f);
      run.toast = await d.page.evaluate(() => { const t = [...document.querySelectorAll('.toast, [class*=toast]')].map(e => e.textContent.trim()).filter(Boolean); return t; }).catch(() => null);
      run.recallInCache = await f.evaluate(() => { const k = Object.keys(localStorage).filter(k => k.includes('f260') && k.includes('person')); return k.map(x => { try { const c = JSON.parse(localStorage.getItem(x)); const r = c.items ? { v: Object.fromEntries(Object.entries(c.items).filter(([k3, it]) => k3.startsWith('recall:') && it && it.v).map(([k3, it]) => [k3.slice(7), it.v])) } : null; return r ? Object.fromEntries(Object.entries(r.v).filter(([, v]) => v && v.last === '2026-09-22').map(([k2, v]) => [k2, { s: v.s, box: v.box }])) : null; } catch { return null; } }); });
    }
    out.runs.push(run);
    console.log(JSON.stringify(run));
    await d.close();
  }
  fs.writeFileSync(P + '.json', JSON.stringify(out, null, 1));
} finally { await L.close(); }
