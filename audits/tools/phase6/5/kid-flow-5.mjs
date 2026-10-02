// Batch 5 copy of audits/tools/phase3/verses/kid-flow.mjs. WHY A COPY: the Phase 3 script is stale tooling — it reads
// Ezra's ratings from the old whole-map row f260.recall (and the old verses 'log'), which no app has written since batch
// 0e (one recall:<id> row per verse, one rev:<date>:<id>:<device> count per day), so it crashes on a null row even on the
// pre-batch code. This copy reads the rows the app writes, merged over the old base exactly as hub.rowMap does. It also
// waits out batch 5's 400 ms guard after a rating (P3-VERSES-12) before it reads the screen, and records what batch 5
// added for a kid (UX-VERSES-1): the paraphrase on the card, what Read aloud says, and the picture buttons.
// Everything else is the original: Ezra on the Kitchen iPad (portrait) and an iPhone, speech stubbed. Since the UX-VERSES-1
// follow-up a kid practises one verse a week (the one Kid Verse teaches), so the flow rates one card, not two.
//   node "audits/tools/phase6/5/kid-flow-5.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO } from '../../lib/local.mjs';
import { openVerses, state, shot as shot3 } from '../../phase3/verses/_lib.mjs';
const EV = path.resolve('audits/evidence/p6/5'); fs.mkdirSync(EV, { recursive: true });
const save = (n, o) => fs.writeFileSync(path.join(EV, n), JSON.stringify(o, null, 1));
const shot = (page, n) => page.screenshot({ path: path.join(EV, n), scale: 'css', animations: 'disabled', caret: 'hide' }).then(() => 'audits/evidence/p6/5/' + n);
void shot3;
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
const stubSpeech = ctx => ctx.addInitScript(() => {
  window.__said = [];
  class U { constructor(t) { this.text = t; } }
  window.SpeechSynthesisUtterance = U;
  const ss = { speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 50); }, cancel() {}, getVoices() { return []; }, addEventListener() {} };
  Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true });
});
const boxes = f => f.evaluate(() => [...document.querySelectorAll('#trainer button, #done button')].filter(b => !b.closest('[hidden]') && !b.hidden && b.offsetParent !== null).map(b => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { label: b.textContent.trim(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundColor, fs: cs.fontSize }; }));
// the server's rows for a profile, merged as the app reads them (old whole map as the base, one row per entry over it)
const items = async (who, app) => ((await L.apiAs(who, `/api/data/${app}?scope=person`)).body.items || []);
const merged = (its, prefix, legacy) => { const base = its.find(r => r.key === legacy); const m = base && base.value && typeof base.value === 'object' ? { ...base.value } : {}; for (const r of its) if (r.key.startsWith(prefix)) { if (r.value === false || r.value == null) delete m[r.key.slice(prefix.length)]; else m[r.key.slice(prefix.length)] = r.value; } return m; };
const reviews = its => { const old = its.find(r => r.key === 'log'); const m = old && old.value ? { ...old.value } : {}; for (const r of its) if (r.key.startsWith('rev:') && r.value != null) { const d = r.key.slice(4, 14); m[d] = (m[d] || 0) + r.value; } return m; };
const flushed = f => f.evaluate(async () => { for (let i = 0; i < 80; i++) { try { await hub.flush(); } catch (e) {} if (!hub.sync.pending) return true; await new Promise(r => setTimeout(r, 250)); } return false; });
const COOL = 650;   // the 400 ms guard after a rating, and the next card's paint
try {
  for (const dev of ['ipad-portrait', 'iphone-pwa']) {
    const R = { device: dev };
    await L.reset('typical');
    const kd = dev === 'iphone-pwa' ? await L.newDevice({ name: 'Ezra phone', profiles: ['ezra'] }) : null;
    const d = await L.device({ device: dev, profile: 'ezra', installClock: DEMO, ...(kd ? { as: kd } : {}) });
    await stubSpeech(d.ctx);
    const f = await openVerses(d);
    R.first = await state(f);
    R.paraphrase = await f.evaluate(() => { const p = document.getElementById('para'); return p && !p.hidden ? p.textContent.replace(/\s+/g, ' ').trim() : null; });
    R.buttonsBeforeShow = await boxes(f);
    await f.click('#say'); await sleep(200);
    R.said = await f.evaluate(() => window.__said);
    R.textShown = await f.evaluate(() => !document.getElementById('text').hidden);
    await f.click('#show'); await sleep(200);
    R.afterShow = { hint: (await state(f)).hint, textShown: await f.evaluate(() => !document.getElementById('text').hidden) };
    R.buttonsAfterShow = await boxes(f);
    R.pictures = await f.evaluate(() => [...document.querySelectorAll('#act-rate [data-rate]')].map(b => { const p = b.querySelector('.pic'); const u = p && p.querySelector('use'); const r = p && p.getBoundingClientRect(); return { rate: b.dataset.rate, word: b.querySelector('span').textContent, picture: u ? u.getAttribute('href') : null, shown: !!p && getComputedStyle(p).display !== 'none', w: r ? Math.round(r.width) : 0 }; }));
    R.shotRevealed = await shot(d.page, `kid-flow-5-revealed-${dev}.png`);
    R.readAloudVisibleAfterShow = await f.locator('#say').isVisible();
    await f.click('#say'); await sleep(200);
    R.saidAfterShow = await f.evaluate(() => window.__said.slice(-1)[0]);
    // since the UX-VERSES-1 follow-up a kid practises only the verse Kid Verse teaches that week: one card, then done
    await f.click('[data-rate="got"]'); await sleep(COOL);
    R.trained = await f.evaluate(() => window.verses.trained());
    R.done = await state(f);
    R.doneButtons = await boxes(f);
    R.shotDone = await shot(d.page, `kid-flow-5-done-${dev}.png`);
    if (dev === 'ipad-portrait') {
      await flushed(f);
      R.recallAfterOne = merged(await items('ezra', 'f260'), 'recall:', 'f260.recall');
      await f.click('#again'); await sleep(200);
      R.afterAgain = await state(f);
      await f.click('#show'); await f.click('[data-rate="got"]'); await sleep(COOL);
      await flushed(f);
      R.recallAfterAgain = merged(await items('ezra', 'f260'), 'recall:', 'f260.recall');
      R.reviewsAfterAgain = reviews(await items('ezra', 'verses'));
      R.summary = ((await items('ezra', 'verses')).find(r => r.key === 'summary') || {}).value || null;
      R.feed = (await L.apiAs('eli', '/api/activity?limit=5')).body;
    }
    out[dev] = R;
    await d.close();
  }
  console.log(JSON.stringify(out, null, 1));
  save('kid-flow-5.json', out);
} finally { await L.close(); }
