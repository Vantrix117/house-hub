// Phase 3 / dollywood — skeptic #2 for "help-popover-offscreen-phone": does the "?" popover open off the left edge on phones?
// Opens the build guide inside the shell as Eli (typical seed), TAPS the "?" with a real pointer click (not el.click()),
// measures #help-pop and .helpwrap, and repeats on WebKit + Chromium (to rule out an engine artefact) and on the iPad (control).
//   node "audits/tools/phase3/dollywood/verify-help-popover-offscreen-phone-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const PFX = 'verify-help-popover-offscreen-phone-2';
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };

async function probe(L, engineTag, device, shotName) {
  const d = await L.device({ device, profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
  await sleep(400);
  await f.evaluate(() => document.getElementById('help-btn').scrollIntoView({ block: 'center' }));
  await sleep(400);
  const btn = await f.$('#help-btn');
  const bb = await btn.boundingBox();                    // page coords
  await d.page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);   // a real tap position
  await sleep(400);
  const m = await f.evaluate(() => {
    const R = e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), r: Math.round(r.right), y: Math.round(r.y), b: Math.round(r.bottom) }; };
    const pop = document.getElementById('help-pop'), wrap = document.querySelector('.helpwrap'), b = document.getElementById('help-btn');
    const cs = getComputedStyle(pop);
    const pr = pop.getBoundingClientRect();
    const visW = Math.max(0, Math.min(pr.right, innerWidth) - Math.max(pr.left, 0));
    // can the user scroll left to reach it?
    const se = document.scrollingElement; se.scrollLeft = -1000; const minScroll = se.scrollLeft;
    return { vw: innerWidth, flavor: document.documentElement.dataset.flavor || document.body.dataset.flavor || null,
      hidden: pop.hidden, ariaExpanded: b.getAttribute('aria-expanded'), left: cs.left, right: cs.right,
      pop: R(pop), wrap: R(wrap), btn: R(b), visibleWidthPx: Math.round(visW), visibleFraction: +(visW / pr.width).toFixed(2),
      scrollLeftAfterTryingLeft: minScroll, firstLine: pop.querySelector('b').textContent,
      pointerCoarse: matchMedia('(pointer:coarse)').matches, hoverNone: matchMedia('(hover:none)').matches };
  });
  log(`${engineTag}.${device}`, m);
  if (shotName) { const p = path.join(EV, `${PFX}-${shotName}.png`); await d.page.screenshot({ path: p, scale: 'css', animations: 'disabled', caret: 'hide' }); log(`${engineTag}.${device}.png`, path.relative(process.cwd(), p).replace(/\\/g, '/')); }
  await d.ctx.close().catch(() => {});
}

for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  try {
    await probe(L, engine, 'iphone-pwa', engine === 'webkit' ? 'iphone-pwa-webkit' : 'iphone-pwa-chromium');
    if (engine === 'webkit') { await probe(L, engine, 'iphone-safari', null); await probe(L, engine, 'ipad-portrait', 'ipad-control'); }
  } catch (e) { log(`${engine}.error`, String(e && e.stack || e)); }
  finally { await L.close(); }
}
fs.writeFileSync(path.join(EV, `${PFX}.json`), JSON.stringify(out, null, 1));
console.log('wrote', `audits/evidence/p3/dollywood/${PFX}.json`);
