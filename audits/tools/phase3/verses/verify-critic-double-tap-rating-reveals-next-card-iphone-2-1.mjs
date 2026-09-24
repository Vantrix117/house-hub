// Skeptic #1 for "critic-double-tap-rating-reveals-next-card-iphone-2": does a quick second tap on a rating button
// (iPhone width, stacked buttons, apps/verses.html:48-49) land on the NEXT card's Show and reveal it?
// Independent of the investigator's helpers: own open/state code. Uses real touch taps (page.touchscreen.tap, hasTouch)
// as well as mouse clicks, gaps of 90 and 250 ms, and a third tap to see whether an unrecited verse gets rated.
// Batch writes are aborted so the local server stays at the seed. Run: node "audits/tools/phase3/verses/verify-critic-double-tap-rating-reveals-next-card-iphone-2-1.mjs"
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const EV = 'audits/evidence/p3/verses/';
const NAME = 'verify-critic-double-tap-rating-reveals-next-card-iphone-2-1';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { runs: [] };
const snap = f => f.evaluate(() => {
  const q = s => document.querySelector(s);
  const rc = (() => { try { const k = Object.keys(localStorage).find(k => k.startsWith('hub.cache.f260.person')); const c = JSON.parse(localStorage.getItem(k) || '{}'); return c.items && c.items['f260.recall'] && c.items['f260.recall'].v; } catch { return null; } })();
  return { ref: q('#trainer').hidden ? null : q('#ref').textContent, showHidden: q('#act-show').hidden, rateHidden: q('#act-rate').hidden,
    textHidden: q('#text').hidden, veiled: q('#text').classList.contains('veiled'), hint: q('#hint').textContent,
    recallKeys: rc ? Object.fromEntries(Object.entries(rc).map(([k, v]) => [k, v && v.box + '/' + v.last])) : null };
});
try {
  const cases = [];
  for (const device of ['iphone-pwa', 'ipad-portrait']) for (const input of ['touch', 'mouse']) for (const kind of ['got', 'almost', 'not']) cases.push({ device, input, kind, gap: 90 });
  cases.push({ device: 'iphone-pwa', input: 'touch', kind: 'got', gap: 250 });
  cases.push({ device: 'iphone-pwa', input: 'touch', kind: 'got', gap: 90, third: true });
  for (const c of cases) {
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
      after: { ref: after.ref, nextCardRevealed: !after.rateHidden, textPresent: !after.textHidden, veiled: after.veiled, hint: after.hint } };
    if (c.device === 'iphone-pwa' && !after.rateHidden) run.underFingerAfterSecond = await f.evaluate(p => { const e = document.elementFromPoint(p.x, p.y); const bt = e && e.closest('button'); return bt ? (bt.id || bt.dataset.rate) : e && (e.id || e.tagName); }, b);
    if (c.third) { await tap(); await sleep(400); const t = await snap(f); run.afterThird = { ref: t.ref, recall: t.recallKeys }; run.recallBefore = before.recallKeys; }
    if (c.device === 'iphone-pwa' && c.input === 'touch' && c.kind === 'got' && c.gap === 90 && !c.third) run.shot = EV + NAME + '-got-touch-iphone.png', await d.page.screenshot({ path: run.shot, scale: 'css' });
    out.runs.push(run);
    console.log(JSON.stringify(run));
    await d.close();
  }
  fs.writeFileSync(EV + NAME + '.json', JSON.stringify(out, null, 1));
} finally { await L.close(); }
