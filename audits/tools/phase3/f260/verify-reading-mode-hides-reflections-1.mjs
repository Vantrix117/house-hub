// Skeptic #1 for "reading-mode-hides-reflections": does F260's reading mode hide the "This week" (#reflect) card
// that apps/f260.html:184-186 mean to keep? Independent of the investigator's journal.mjs: no journal unlock (the card
// renders in every journal state — locked, open, none), just toggle reading mode and measure, on iPhone and desktop.
// Run: node "audits/tools/phase3/f260/verify-reading-mode-hides-reflections-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p3/f260');
const P = 'verify-reading-mode-hides-reflections-1';
const measure = f => f.evaluate(() => {
  const r = document.getElementById('reflect'), side = r.closest('.side'), pv = document.getElementById('planView');
  let hider = null; for (let e = r; e; e = e.parentElement) if (getComputedStyle(e).display === 'none') { hider = (e.id ? '#' + e.id : '.' + [...e.classList].join('.')); break; }
  // every stylesheet rule whose selector mentions .readmode and .side or #reflect, in source order, and whether it matches
  const rules = [];
  for (const ss of document.styleSheets) { let list; try { list = ss.cssRules; } catch { continue; }
    const walk = rs => { for (const x of rs) { if (x.cssRules && !x.selectorText) { if (!x.media || matchMedia(x.media.mediaText).matches) walk(x.cssRules); continue; }
      if (x.selectorText && /readmode/.test(x.selectorText) && /\.side|#reflect/.test(x.selectorText)) rules.push({ sel: x.selectorText, display: x.style.display || null, matchesSide: side.matches(x.selectorText.split(',').find(s => /\.side\b(?!\s*>)/.test(s)) || ':not(*)'), matchesReflect: r.matches(x.selectorText) }); } };
    walk(list); }
  const rect = r.getBoundingClientRect();
  return { planViewReadmode: pv.classList.contains('readmode'), sideDisplay: getComputedStyle(side).display, reflectDisplay: getComputedStyle(r).display,
    reflectBox: [Math.round(rect.width), Math.round(rect.height)], reflectVisible: rect.width > 0 && rect.height > 0, hiddenBy: hider,
    reflectText: r.innerText.replace(/\s+/g, ' ').slice(0, 80), rules, vw: innerWidth };
});

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const result = {};
try {
  for (const device of ['iphone-pwa', 'desktop']) {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    await d.goto('#home');
    const f = await d.openApp('f260'); await sleep(1500);
    // make sure we are on the plan view (phones have a Today/Plan switch)
    await f.evaluate(() => { const b = [...document.querySelectorAll('.switch button')].find(x => /plan/i.test(x.textContent)); if (b) b.click(); }); await sleep(500);
    // reading mode is a saved (synced) preference; start from "off" so before/after is a clean toggle
    const wasOn = await f.evaluate(() => document.getElementById("planView").classList.contains("readmode"));
    if (wasOn) { await f.evaluate(() => document.getElementById("readBtn").click()); await sleep(900); }
    const before = await measure(f); before.startedInReadmode = wasOn;
    await f.evaluate(() => document.getElementById('readBtn').click()); await sleep(900);
    const after = await measure(f);
    await d.page.screenshot({ path: path.join(OUT, `${P}-${device}.png`), scale: "css" });   // 1x CSS scale
    result[device] = { before, after };
    console.log(device, 'BEFORE', JSON.stringify({ side: before.sideDisplay, reflect: before.reflectDisplay, box: before.reflectBox, hiddenBy: before.hiddenBy, text: before.reflectText }));
    console.log(device, 'AFTER ', JSON.stringify({ readmode: after.planViewReadmode, side: after.sideDisplay, reflect: after.reflectDisplay, box: after.reflectBox, visible: after.reflectVisible, hiddenBy: after.hiddenBy }));
    console.log(device, 'RULES ', JSON.stringify(after.rules));
    // leave reading mode so the saved preference does not leak into the next device (separate contexts anyway)
    await f.evaluate(() => document.getElementById('readExit')?.click()); await sleep(900);
    await d.ctx.close();
  }
  fs.writeFileSync(path.join(OUT, `${P}.json`), JSON.stringify(result, null, 1));
} finally { await L.close(); }
