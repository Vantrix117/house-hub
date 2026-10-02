// Batch 5 copy of audits/tools/phase3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-1.mjs. WHY A COPY:
// stale tooling — on the pre-batch code it stops at the fourth case waiting for #trainer: every case rates on a fresh
// device but the rig is never reset, so the seed's due verses run out (the batch-write abort does not keep every write
// away), and its snapshot reads the old whole-map f260.recall that no app writes since batch 0e. This copy resets the
// household before every case and reads the recall:<id> rows; the cases, inputs, gaps and the third tap are the
// original's. Batch 5 (P3-VERSES-12): the rated card stays 400 ms and its rating row ignores taps.
// Original header:
// Skeptic #1 for "critic-double-tap-rating-reveals-next-card-iphone-2": does a quick second tap on a rating button
// (iPhone width, stacked buttons, apps/verses.html:48-49) land on the NEXT card's Show and reveal it?
// Uses real touch taps (page.touchscreen.tap, hasTouch) as well as mouse clicks, gaps of 90 and 250 ms, and a third tap
// to see whether an unrecited verse gets rated. Batch writes are aborted so the local server stays at the seed.
//   node "audits/tools/phase6/5/verify-critic-double-tap-rating-reveals-next-card-iphone-2-1-5.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p6/5'); fs.mkdirSync(EV, { recursive: true });
const NAME = 'verify-critic-double-tap-rating-reveals-next-card-iphone-2-1-5';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { runs: [] };
const snap = f => f.evaluate(() => {
  const q = s => document.querySelector(s);
  const rc = (() => { try { return hub.rowMap('recall:', 'f260.recall', { app: 'f260', scope: 'person' }); } catch { return null; } })();
  return { ref: q('#trainer').hidden ? null : q('#ref').textContent, showHidden: q('#act-show').hidden || q('#show').hidden, rateHidden: q('#act-rate').hidden,
    textHidden: q('#text').hidden, veiled: q('#text').classList.contains('veiled'), hint: q('#hint').textContent,
    recallKeys: rc ? Object.fromEntries(Object.entries(rc).map(([k, v]) => [k, v && v.box + '/' + v.last])) : null,
    reviews: hub.list('rev:').reduce((n, r) => n + (r.value || 0), 0) };
});
try {
  const cases = [];
  for (const device of ['iphone-pwa', 'ipad-portrait']) for (const input of ['touch', 'mouse']) for (const kind of ['got', 'almost', 'not']) cases.push({ device, input, kind, gap: 90 });
  cases.push({ device: 'iphone-pwa', input: 'touch', kind: 'got', gap: 250 });
  cases.push({ device: 'iphone-pwa', input: 'touch', kind: 'got', gap: 90, third: true });
  for (const c of cases) {
    await L.reset('typical');
    const d = await L.device({ device: c.device, profile: 'eli', installClock: DEMO });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    await d.goto('#home');
    const f = await d.openApp('verses');
    await f.waitForSelector('#trainer:not([hidden])', { timeout: 15000 });
    await sleep(400);
    await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])'); await sleep(200);
    const before = await snap(f);
    const b = await f.evaluate(k => { const r = document.querySelector(`[data-rate="${k}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, c.kind);
    const o = await d.page.evaluate(() => { const r = document.querySelector('iframe').getBoundingClientRect(); return { x: r.x, y: r.y }; });
    const tap = async () => c.input === 'touch' ? d.page.touchscreen.tap(o.x + b.x, o.y + b.y) : d.page.mouse.click(o.x + b.x, o.y + b.y);
    await tap();
    const mid = await snap(f);
    const under = await f.evaluate(p => { const e = document.elementFromPoint(p.x, p.y); const bt = e && e.closest('button'); return bt ? (bt.id || bt.dataset.rate) : e && (e.id || e.tagName); }, b);
    await sleep(c.gap);
    await tap();
    await sleep(900);
    const after = await snap(f);
    const run = { ...c, tapAt: b, before: { ref: before.ref }, afterFirst: { ref: mid.ref, showHidden: mid.showHidden }, underFingerAfterFirst: under,
      after: { ref: after.ref, nextCardRevealed: !after.rateHidden, textPresent: !after.textHidden, veiled: after.veiled, hint: after.hint }, ratingsCounted: after.reviews - before.reviews };
    if (c.device === 'iphone-pwa' && !after.rateHidden) run.underFingerAfterSecond = await f.evaluate(p => { const e = document.elementFromPoint(p.x, p.y); const bt = e && e.closest('button'); return bt ? (bt.id || bt.dataset.rate) : e && (e.id || e.tagName); }, b);
    if (c.third) { await tap(); await sleep(400); const t = await snap(f); run.afterThird = { ref: t.ref, recall: t.recallKeys, ratingsCounted: t.reviews - before.reviews }; run.recallBefore = before.recallKeys; }
    if (c.device === 'iphone-pwa' && c.input === 'touch' && c.kind === 'got' && c.gap === 90 && !c.third) run.shot = 'audits/evidence/p6/5/' + NAME + '-got-touch-iphone.png', await d.page.screenshot({ path: run.shot, scale: 'css' });
    out.runs.push(run);
    console.log(JSON.stringify(run));
    await d.close();
  }
  out.verdict = { anyNextCardRevealed: out.runs.some(r => r.after.nextCardRevealed), countedOnceExceptThird: out.runs.filter(r => !r.third).every(r => r.ratingsCounted === 1) };
  console.log(JSON.stringify(out.verdict));
  fs.writeFileSync(path.join(EV, NAME + '.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
