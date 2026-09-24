// Skeptic check: after Show, is "Read aloud" (#say) gone, so the verse text (apps/verses.html:272) is never spoken?
// Adult (Eli, who has F260 verse texts) and kid (Ezra), iPad portrait + iPhone PWA. speechSynthesis stubbed to record text.
import fs from 'node:fs'; import path from 'node:path';
import { local, DEMO, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/verses'); const P = 'verify-read-aloud-gone-after-show-1';
const L = await local({ variant: 'typical', clock: 'demo' });
const stub = ctx => ctx.addInitScript(() => {
  window.__said = []; window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 30); }, cancel() {}, getVoices() { return []; }, addEventListener() {} } });
});
const probe = f => f.evaluate(() => { const s = document.getElementById('say'); const r = s.getBoundingClientRect();
  return { sayHiddenAttr: s.hidden, actShowHidden: document.getElementById('act-show').hidden, sayDisplayParent: getComputedStyle(s.parentElement).display, sayRect: [r.width, r.height], textVisible: !document.getElementById('text').hidden && getComputedStyle(document.getElementById('text')).display !== 'none', ref: document.getElementById('ref').textContent, allButtons: [...document.querySelectorAll('#trainer button')].filter(b => b.offsetParent).map(b => b.textContent.trim()) }; });
const out = {};
try {
  for (const [who, dev] of [['eli', 'ipad-portrait'], ['eli', 'iphone-pwa'], ['ezra', 'ipad-portrait'], ['ezra', 'iphone-pwa']]) {
    await L.reset('typical');
    const nd = dev === 'iphone-pwa' ? await L.newDevice({ name: who + ' phone', profiles: [who] }) : null;
    const d = await L.device({ device: dev, profile: who, installClock: DEMO, ...(nd ? { as: nd } : {}) });
    await stub(d.ctx);
    const f = await d.openApp('verses');
    await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 12000 }); await sleep(400);
    const R = { who, dev, skipped: 0 };
    // adults: move through the queue until a card whose F260 text exists (so line 272's text branch would matter)
    for (let i = 0; i < 80 && who === 'eli'; i++) {
      const has = await f.evaluate(() => { const c = window.verses.current(); return !!(c && document.getElementById('text').textContent && !document.getElementById('text').hidden); });
      if (has) break;
      if (await f.locator('#trainer').isHidden()) break;
      await f.click('#show'); await f.click('[data-rate="almost"]'); await sleep(120); R.skipped++;
    }
    R.before = await probe(f);
    R.sayVisibleBefore = await f.locator('#say').isVisible();
    await f.click('#say'); await sleep(150);
    R.saidBefore = await f.evaluate(() => window.__said.slice());
    await f.click('#show'); await sleep(250);
    R.after = await probe(f);
    R.sayVisibleAfter = await f.locator('#say').isVisible();
    R.userClickAfter = await f.click('#say', { timeout: 1500 }).then(() => 'clicked', e => 'failed: ' + e.message.split('\n')[0]);
    await d.page.keyboard.press('r').catch(() => {}); await sleep(100);
    R.saidAfterUserAttempts = await f.evaluate(() => window.__said.slice());
    // control: a programmatic click on the hidden button reaches the revealed branch (proves the text branch exists but is unreachable from the UI)
    await f.evaluate(() => document.getElementById('say').click()); await sleep(150);
    R.saidForcedClick = await f.evaluate(() => window.__said.slice(-1)[0]);
    const shot = `audits/evidence/p3/verses/${P}-${who}-${dev}.png`;
    await d.page.screenshot({ path: shot, scale: 'css', animations: 'disabled' }); R.shot = shot;
    out[who + ':' + dev] = R;
    await d.close();
  }
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, P + '.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
