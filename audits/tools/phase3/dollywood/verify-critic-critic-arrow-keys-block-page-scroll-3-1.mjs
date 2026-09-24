// Phase 3 / dollywood — skeptic #1 for "Arrow keys never scroll the page" (critic-critic-arrow-keys-block-page-scroll-3).
//   node "audits/tools/phase3/dollywood/verify-critic-critic-arrow-keys-block-page-scroll-3-1.mjs"
// Independent reproduction: desktop 1440x900, Eli, guide in the shell viewer, WebKit and Chromium.
// Scroll the frame so the build card is at y=200 (window.scrollTo), click plain text in the card,
// press ArrowDown x5; record frame scrollY, map view and whether the keydown was defaultPrevented (window bubble listener).
// Also: focus on a <button> inside the card (buttons are not excluded by the handler); control: Space/PageDown;
// causal control: a window capture listener stops propagation of arrows, so the app's document handler never runs.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const NAME = 'verify-critic-critic-arrow-keys-block-page-scroll-3-1';
const out = {};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  const r = out[engine] = {};
  try {
    const d = await L.device({ device: 'desktop', profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 30000 }); await sleep(800);
    await f.evaluate(() => { window.__prev = []; window.addEventListener('keydown', e => { if (e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'PageDown') window.__prev.push(e.key + ':' + e.defaultPrevented); }); });
    const st = () => f.evaluate(() => { const m = document.getElementById('map').getBoundingClientRect(), c = document.getElementById('b-now').getBoundingClientRect();
      return { scrollY: Math.round(scrollY), maxScroll: document.documentElement.scrollHeight - innerHeight, viewY: Math.round(view[1]), viewX: Math.round(view[0]), mapTop: Math.round(m.top), mapBottom: Math.round(m.bottom), cardTop: Math.round(c.top), vh: innerHeight, active: document.activeElement && (document.activeElement.tagName + '#' + document.activeElement.id + '.' + document.activeElement.className).slice(0, 80), prev: window.__prev.splice(0) }; });
    r.initial = await st();
    // wheel-scroll over the frame until the card is on screen
    const fb = await (await d.page.$('iframe')).boundingBox();
    // (the whole first screen is the map, which takes the wheel, so wheel scrolling does not reach the card: position with scrollTo)
    await d.page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height * 0.8); await d.page.mouse.wheel(0, 600); await sleep(300); r.afterWheelOverMap = await st();
    await f.evaluate(() => { const c = document.getElementById("b-now"); window.scrollTo(0, scrollY + c.getBoundingClientRect().top - 200); });
    await sleep(400);
    const h = await f.$('#b-now h3'); const b = await h.boundingBox(); await d.page.mouse.click(b.x + 4, b.y + b.height / 2); await sleep(200);
    r.textFocus_before = await st();
    for (let i = 0; i < 5; i++) { await d.page.keyboard.press('ArrowDown'); await sleep(150); }
    r.textFocus_after5Down = await st();
    await d.shot(path.join(EV, `${NAME}-${engine}-after-arrowdown.png`));
    // control: Space scrolls (not bound)
    await d.page.keyboard.press('Space'); await sleep(500);
    r.control_space = await st();
    // focus a button in the card, if any
    const btn = await f.$('#b-now button');
    if (btn) { await btn.focus(); await sleep(100); const before = await st(); await f.evaluate(() => window.scrollTo(0, Math.max(0, scrollY - 300))); await sleep(300); const b2 = await st();
      for (let i = 0; i < 3; i++) { await d.page.keyboard.press('ArrowDown'); await sleep(150); }
      r.buttonFocus = { before: b2, after3Down: await st() }; }
    // causal control: block propagation to document for arrows, then ArrowDown should scroll
    await f.evaluate(() => { window.addEventListener('keydown', e => { if (e.key.startsWith('Arrow')) e.stopPropagation(); }, true); document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.scrollTo(0, 400); });
    await sleep(300);
    const h2 = await f.$('#b-now h3'); const b3 = await h2.boundingBox(); if (b3 && b3.y > 0 && b3.y < 850) await d.page.mouse.click(b3.x + 4, b3.y + b3.height / 2); else await f.evaluate(() => document.body.focus());
    const c0 = await st();
    for (let i = 0; i < 5; i++) { await d.page.keyboard.press('ArrowDown'); await sleep(150); }
    r.causal_handlerBypassed = { before: c0, after5Down: await st() };
    await d.close();
  } catch (e) { r.error = String(e && e.stack || e); }
  finally { await L.close(); }
  const s = r;
  console.log(engine, 'wheel over map: scrollY', s.afterWheelOverMap?.scrollY, '| text focus: active', s.textFocus_before?.active, 'scrollY', s.textFocus_before?.scrollY, '->', s.textFocus_after5Down?.scrollY, '| viewY', s.textFocus_before?.viewY, '->', s.textFocus_after5Down?.viewY,
    '| mapBottom', s.textFocus_before?.mapBottom, 'cardTop', s.textFocus_before?.cardTop, '| prevented', JSON.stringify(s.textFocus_after5Down?.prev),
    '| space ->', s.control_space?.scrollY, '| button focus', JSON.stringify(s.buttonFocus && { active: s.buttonFocus.before.active, y0: s.buttonFocus.before.scrollY, y1: s.buttonFocus.after3Down.scrollY, v0: s.buttonFocus.before.viewY, v1: s.buttonFocus.after3Down.viewY }),
    '| bypass', s.causal_handlerBypassed?.before.scrollY, '->', s.causal_handlerBypassed?.after5Down.scrollY, s.error || '');
}
fs.writeFileSync(path.join(EV, `${NAME}.json`), JSON.stringify(out, null, 1));
