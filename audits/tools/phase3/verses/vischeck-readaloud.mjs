// Visual-score checker: is the verse TEXT ever read aloud? speak() (apps/verses.html:272) adds the text only when
// `revealed`, but #say lives inside #act-show (apps/verses.html:108-109), which render() hides once revealed (:328).
// Eli on iPhone, standalone, demo clock; ratings are kept on the device (batch requests aborted). speechSynthesis is stubbed
// so the utterance text is recorded. Output: audits/evidence/p3/verses/vischeck-readaloud.json (+ one PNG).
import fs from 'node:fs';
import { local, DEMO, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/verses/';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
  await d.ctx.addInitScript(() => {
    window.__said = [];
    const fake = { speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 50); }, cancel() {}, getVoices() { return []; }, addEventListener() {}, speaking: false };
    try { Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true }); } catch {}
    if (!window.SpeechSynthesisUtterance) window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  });
  await d.page.goto(L.site + '/apps/verses.html', { waitUntil: 'load' });
  await d.page.waitForSelector('#trainer:not([hidden])', { timeout: 10000 }); await sleep(600);
  // Luke 14:26-27 has no text: rate it to reach John 17:3, which has text
  await d.page.click('#show'); await d.page.click('[data-rate="got"]'); await sleep(2600);
  const vis = () => d.page.evaluate(() => { const e = document.querySelector('#say'); const r = e.getBoundingClientRect(); return { ref: document.querySelector('#ref').textContent, textShown: !document.querySelector('#text').hidden, sayVisible: !!(r.width && r.height), actShowHidden: document.querySelector('#act-show').hidden }; });
  out.beforeShow = await vis();
  await d.page.click('#say'); await sleep(300);
  out.saidBeforeShow = await d.page.evaluate(() => window.__said.slice());
  await d.page.click('#show'); await sleep(400);
  out.afterShow = await vis();
  out.anyReadAloudControlAfterShow = await d.page.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && r.height && /read|aloud|listen/i.test(b.textContent + (b.getAttribute('aria-label') || '')); }).map(b => b.textContent.trim()));
  await d.page.screenshot({ path: OUT + 'vischeck-readaloud-after-show.png', scale: 'css', animations: 'disabled' });
  out.shot = OUT + 'vischeck-readaloud-after-show.png';
  fs.writeFileSync(OUT + 'vischeck-readaloud.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
} finally { await L.close(); }
