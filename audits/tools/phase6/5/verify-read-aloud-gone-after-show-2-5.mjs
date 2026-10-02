// Batch 5 copy of audits/tools/phase3/verses/verify-read-aloud-gone-after-show-2.mjs. WHY A COPY: the script steps through
// Eli's queue with Show + Almost and only 250 ms before it looks again; batch 5's double-tap guard (P3-VERSES-12) keeps
// the rated card on screen for 400 ms on purpose, so the original reads the rated card as the next one (and its 'with
// text' case lands on a card mid-change). This copy waits 650 ms there and writes its evidence under p6/5; nothing
// else changed.
//   node "audits/tools/phase6/5/verify-read-aloud-gone-after-show-2-5.mjs"
// Skeptic #2 for "read-aloud-gone-after-show": is Read aloud (#say) reachable once the card is revealed, and does the
// verse text (f260.verses, apps/verses.html:272) ever get spoken? Adult (Eli, who has pasted texts) and kid (Ezra),
// iPad portrait + iPhone PWA, WebKit. speechSynthesis is stubbed to record utterances (the rig has no real voice).
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p6/5'); fs.mkdirSync(EVID, { recursive: true });
const P = 'verify-read-aloud-gone-after-show-2-5';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const stub = ctx => ctx.addInitScript(() => {
  window.__said = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 30); }, cancel() {}, getVoices() { return []; }, addEventListener() {} } });
});
const probe = f => f.evaluate(() => {
  const say = document.getElementById('say'), r = say.getBoundingClientRect();
  const hiddenAncestor = say.closest('[hidden]');
  return { sayAttrHidden: say.hidden, hiddenAncestor: hiddenAncestor && hiddenAncestor.id, sayRect: [Math.round(r.width), Math.round(r.height)],
    actShowHidden: document.getElementById('act-show').hidden, actRateHidden: document.getElementById('act-rate').hidden,
    ref: document.getElementById('ref').textContent, textHidden: document.getElementById('text').hidden,
    textVeiled: document.getElementById('text').classList.contains('veiled'), textLen: document.getElementById('text').textContent.length,
    visibleButtons: [...document.querySelectorAll('#trainer button')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.textContent.trim()) };
});
try {
  for (const [profile, dev] of [['eli', 'ipad-portrait'], ['eli', 'iphone-pwa'], ['ezra', 'iphone-pwa']]) {
    await L.reset('typical');
    const nd = dev === 'iphone-pwa' ? await L.newDevice({ name: profile + ' phone', profiles: [profile] }) : null;
    const d = await L.device({ device: dev, profile, installClock: DEMO, ...(nd ? { as: nd } : {}) });
    await stub(d.ctx);
    await d.goto('#home');
    const f = await d.openApp('verses');
    await f.waitForSelector('#trainer:not([hidden])', { timeout: 12000 });
    await sleep(300);
    const R = { profile, device: dev };
    R.before = await probe(f);
    await f.click('#say'); await sleep(150);
    R.saidBeforeShow = await f.evaluate(() => window.__said.slice());
    await f.click('#show'); await sleep(200);
    R.after = await probe(f);
    R.sayIsVisibleAfterShow = await f.locator('#say').isVisible();
    // keyboard: is there any key that reads aloud once revealed? (apps/verses.html:373-378 handles Escape/Enter/Space/1-3 only)
    // Force the hidden button's handler to show what the unreachable branch would say (not a user path).
    await f.evaluate(() => document.getElementById('say').click()); await sleep(150);
    R.saidIfForced = await f.evaluate(() => window.__said.slice(-1));
    const png = `${P}-${profile}-${dev}-revealed.png`;
    await d.page.screenshot({ path: path.join(EVID, png), scale: 'css', animations: 'disabled' });
    R.shot = 'audits/evidence/p6/5/' + png;
    out[profile + '@' + dev] = R;
    console.log(JSON.stringify(R));
    await d.close();
  }
  // A card that HAS a pasted text (the case line 272 was written for): rate through Eli's queue until one shows text.
  {
    await L.reset('typical');
    const nd = await L.newDevice({ name: 'eli phone 2', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: nd });
    await stub(d.ctx);
    await d.goto('#home');
    const f = await d.openApp('verses');
    await f.waitForSelector('#trainer:not([hidden])', { timeout: 12000 }); await sleep(300);
    const T = { tried: [] };
    for (let n = 0; n < 25; n++) {
      if (!(await f.locator('#trainer').isVisible())) break;
      const b = await probe(f);
      T.tried.push(b.ref + (b.textHidden ? '' : ' [text]'));
      if (!b.textHidden) {
        T.before = b;
        await f.click('#say'); await sleep(150);
        T.saidBeforeShow = await f.evaluate(() => window.__said.slice(-1));
        await f.click('#show'); await sleep(200);
        T.after = await probe(f);
        T.sayIsVisibleAfterShow = await f.locator('#say').isVisible();
        const png = `${P}-eli-with-text-iphone-pwa-revealed.png`;
        await d.page.screenshot({ path: path.join(EVID, png), scale: 'css', animations: 'disabled' });
        T.shot = 'audits/evidence/p6/5/' + png;
        await f.evaluate(() => document.getElementById('say').click()); await sleep(150);
        T.saidIfForced = await f.evaluate(() => window.__said.slice(-1));
        break;
      }
      await f.click('#show'); await f.click('[data-rate="almost"]'); await sleep(650);
    }
    out['eli-with-text@iphone-pwa'] = T;
    console.log(JSON.stringify(T));
    await d.close();
  }
  fs.writeFileSync(path.join(EVID, P + '.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
