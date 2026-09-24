// The kid flow end to end, as Ezra on the Kitchen iPad (portrait) and on an iPhone: what he is asked, what "Read aloud"
// says (speechSynthesis is stubbed to record the utterance; the rig has no real voice), what Show reveals, the button sizes,
// where the buttons sit, what "Practise again" does to his rows, and whether his writes land in his own F260 scope
// (F260 itself is not visible to kids, apps.json:4).
import { local, DEMO, sleep } from '../../lib/local.mjs';
import { openVerses, state, serverRow, save, shot, waitQueueEmpty } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
const stubSpeech = ctx => ctx.addInitScript(() => {
  window.__said = [];
  class U { constructor(t) { this.text = t; } }
  window.SpeechSynthesisUtterance = U;
  const ss = { speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 50); }, cancel() {}, getVoices() { return []; }, addEventListener() {} };
  Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true });
});
const boxes = f => f.evaluate(() => [...document.querySelectorAll('#trainer button, #done button')].filter(b => !b.closest('[hidden]') && !b.hidden).map(b => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { label: b.textContent.trim(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundColor, fs: cs.fontSize }; }));
try {
  for (const dev of ['ipad-portrait', 'iphone-pwa']) {
    const R = { device: dev };
    await L.reset('typical');
    const kd = dev === 'iphone-pwa' ? await L.newDevice({ name: 'Ezra phone', profiles: ['ezra'] }) : null;
    const d = await L.device({ device: dev, profile: 'ezra', installClock: DEMO, ...(kd ? { as: kd } : {}) });
    await stubSpeech(d.ctx);
    const f = await openVerses(d);
    R.first = await state(f);
    R.buttonsBeforeShow = await boxes(f);
    await f.click('#say'); await sleep(200);
    R.said = await f.evaluate(() => window.__said);
    R.textShown = await f.evaluate(() => !document.getElementById('text').hidden);
    await f.click('#show'); await sleep(200);
    R.afterShow = { hint: (await state(f)).hint, textShown: await f.evaluate(() => !document.getElementById('text').hidden) };
    R.buttonsAfterShow = await boxes(f);
    R.shotRevealed = await shot(d.page, `kid-flow-revealed-${dev}.png`);
    R.readAloudVisibleAfterShow = await f.locator('#say').isVisible();   // #say sits in #act-show, hidden once revealed (apps/verses.html:108-111, 328)
    await f.click('[data-rate="got"]'); await sleep(300);
    await f.click('#show'); await f.click('[data-rate="got"]'); await sleep(300);
    R.done = await state(f);
    R.doneButtons = await boxes(f);
    R.shotDone = await shot(d.page, `kid-flow-done-${dev}.png`);
    if (dev === 'ipad-portrait') {
      await waitQueueEmpty(d);
      R.recallAfterTwo = (await serverRow(L, 'ezra', 'f260', 'f260.recall')).value;
      await f.click('#again'); await sleep(200);
      R.afterAgain = await state(f);
      await f.click('#show'); await f.click('[data-rate="got"]'); await sleep(200);
      await f.click('#show'); await f.click('[data-rate="got"]'); await sleep(300);
      await waitQueueEmpty(d);
      R.recallAfterAgain = (await serverRow(L, 'ezra', 'f260', 'f260.recall')).value;
      R.logAfterAgain = (await serverRow(L, 'ezra', 'verses', 'log')).value;
      R.summary = (await serverRow(L, 'ezra', 'verses', 'summary')).value;
      R.feed = (await L.apiAs('eli', '/api/activity?limit=5')).body;
    }
    out[dev] = R;
    await d.close();
  }
  console.log(JSON.stringify(out, null, 1));
  save('kid-flow.json', out);
} finally { await L.close(); }
