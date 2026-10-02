// Batch 5 copy of audits/tools/phase3/verses/critic-doubletap.mjs. WHY A COPY: the Phase 3 script is stale tooling — on
// the pre-batch code it already times out waiting for #show (the card it expects is not on screen: ratings from one case
// reach the next case's server, and the frame is read before the trainer is up). This copy resets the rig's household
// before every case, opens the hub at #home first and waits for the trainer card, as the skeptic script -2-1 does; the
// measurement is the original one: two real mouse clicks 90 ms apart at the centre of a rating button, iPhone PWA
// (stacked buttons) and iPad portrait, each rating; batch writes aborted so each case starts from the seed.
// Batch 5's fix (P3-VERSES-12): for 400 ms after a rating the rated card stays and its rating row ignores taps, so the
// second tap lands on the rated card's own button and does nothing; the next card then comes in unrevealed.
//   node "audits/tools/phase6/5/critic-doubletap-5.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO } from '../../lib/local.mjs';
import { state } from '../../phase3/verses/_lib.mjs';
const EV = path.resolve('audits/evidence/p6/5'); fs.mkdirSync(EV, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { runs: [] };
try {
  for (const device of ['iphone-pwa', 'ipad-portrait']) for (const kind of ['not', 'almost', 'got']) {
    await L.reset('typical');
    const d = await L.device({ device, profile: 'eli', installClock: DEMO });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    await d.goto('#home');
    const f = await d.openApp('verses');
    await f.waitForSelector('#trainer:not([hidden]) #show:not([hidden])', { timeout: 15000 }); await sleep(300);
    await f.evaluate(() => { window.__spoke = []; try { speechSynthesis.speak = u => { window.__spoke.push(u.text); }; } catch {} });
    await f.click('#show'); await sleep(200);
    const before = await state(f);
    const box = await f.evaluate(k => { const r = document.querySelector(`[data-rate="${k}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, kind);
    const off = await d.page.evaluate(() => { const r = document.querySelector('iframe').getBoundingClientRect(); return { x: r.x, y: r.y }; });
    const revBefore = await f.evaluate(() => hub.list('rev:').reduce((n, r) => n + (r.value || 0), 0));
    await d.page.mouse.click(off.x + box.x, off.y + box.y);
    await sleep(90);
    const hit = await f.evaluate(p => { const e = document.elementFromPoint(p.x, p.y); const b = e && e.closest('button'); return b ? (b.id || b.dataset.rate) : (e && e.tagName); }, box);
    await d.page.mouse.click(off.x + box.x, off.y + box.y);
    await sleep(700);
    const after = await state(f);
    const run = { device, kind, firstCard: before.ref, tapAt: box, secondTapLandedOn: hit, nowOnCard: after.ref,
      nextCardRevealed: await f.evaluate(() => !document.getElementById('act-rate').hidden), spoke: await f.evaluate(() => window.__spoke),
      ratingsCounted: (await f.evaluate(() => hub.list('rev:').reduce((n, r) => n + (r.value || 0), 0))) - revBefore };
    if (device === 'iphone-pwa') run.shot = 'audits/evidence/p6/5/critic-doubletap-5-' + kind + '-iphone.png', await d.page.screenshot({ path: run.shot, scale: 'css' });
    out.runs.push(run);
    console.log(JSON.stringify(run));
    await d.close();
  }
  out.verdict = { anyNextCardRevealed: out.runs.some(r => r.nextCardRevealed), everyDoubleTapCountedOnce: out.runs.every(r => r.ratingsCounted === 1) };
  console.log(JSON.stringify(out.verdict));
  fs.writeFileSync(path.join(EV, 'critic-doubletap-5.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
