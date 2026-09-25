// TELL / verify-ds-btn-keyboard-focus-invisible-cross-area-2 (skeptic 2): independent re-measure of "no visible keyboard
// focus on .ds buttons". For each target, in WebKit and Chromium, light and dark (System theme), desktop 1440x900 (TV on
// the 1920x1080 TV, profile tv): Tab until the target is document.activeElement (fallback: script focus), record
// :focus-visible + computed box-shadow/outline, crop its box + 12 px focused vs blurred, count changed pixels (sum |dRGB|>24).
// Counterfactual (Chromium light only): inject `.ds .btn:focus-visible{box-shadow:var(--focus)}` into the document and
// re-diff, to show the ring is lost in the cascade rather than a transparent --focus token.
//   node audits/tools/phase4/TELL/verify-ds-btn-keyboard-focus-invisible-cross-area-2.mjs [chromium|webkit|chromium,webkit]
//   → audits/evidence/p4/TELL/verify-ds-btn-keyboard-focus-invisible-cross-area-2-<engine>.json (+ 2 PNGs: focused above blurred)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { openArea, profileFor, deviceFor } from './areas.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const NAME = 'verify-ds-btn-keyboard-focus-invisible-cross-area-2';
const TARGETS = [['shell', '.gcard .btn'], ['tv', '#kiosk-switch'], ['tally', '#reset'], ['timer', '#go'], ['kidverse', '#done'], ['verses', '#show'], ['tally', '#plus']];
const ENGINES = (process.argv[2] || 'chromium,webkit').split(',');
const MODES = ['light', 'dark'];
const out = { note: 'See the header of audits/tools/phase4/TELL/' + NAME + '.mjs', results: [] };
const keepPng = new Set(['webkit|light|timer|#go', 'chromium|light|kidverse|#done|cf']);
async function diffPair(dec, a, b) {
  return dec.evaluate(async ([a, b]) => {
    const load = async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); return im; };
    const A = await load(a), B = await load(b); const c = document.createElement('canvas'); c.width = A.width; c.height = A.height * 2 + 4; const g = c.getContext('2d');
    g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, A.width, A.height).data; g.drawImage(B, 0, A.height + 4); const db = g.getImageData(0, A.height + 4, A.width, A.height).data;
    let n = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) n++;
    return { changed: n, total: da.length / 4, png: c.toDataURL('image/png').split(',')[1] };
  }, [a.toString('base64'), b.toString('base64')]);
}
async function tabTo(d, doc, frameEl, sel) {
  if (frameEl) await doc.evaluate(() => window.focus());
  let hit = false, presses = 0;
  for (; presses < 60 && !hit; presses++) { await d.page.keyboard.press('Tab'); await sleep(50); hit = await doc.evaluate(s => { const e = document.querySelector(s); return !!e && document.activeElement === e; }, sel).catch(() => false); }
  if (!hit) await doc.evaluate(s => document.querySelector(s).focus(), sel);
  await sleep(400);
  return { hit, presses };
}
for (const engine of ENGINES) {
  const L = await local({ variant: 'typical', engine });
  try {
    const dec = await L.browser.newPage();
    for (const mode of MODES) for (const [area, sel] of TARGETS) {
      const R = { engine, mode, area, sel };
      try {
        const d = await L.device({ device: deviceFor(area, 'desktop'), mode, profile: profileFor(area) });
        const { doc, frameEl } = await openArea(d, area, { settle: 1500 });
        const t = await tabTo(d, doc, frameEl, sel);
        R.reachedByTab = t.hit; R.presses = t.presses;
        const probe = () => doc.evaluate(s => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { active: document.activeElement === e, fv: e.matches(':focus-visible'), cls: String(e.className), rect: [r.x, r.y, r.width, r.height], shadow: c.boxShadow.slice(0, 160), outline: c.outlineStyle + ' ' + c.outlineWidth, focusToken: getComputedStyle(document.documentElement).getPropertyValue('--focus').trim() }; }, sel);
        const info = await probe();
        Object.assign(R, { active: info.active, focusVisible: info.fv, cls: info.cls, shadowFocused: info.shadow, outlineFocused: info.outline, focusToken: info.focusToken });
        const off = frameEl ? await frameEl.boundingBox() : { x: 0, y: 0 };
        const clip = { x: Math.max(0, off.x + info.rect[0] - 12), y: Math.max(0, off.y + info.rect[1] - 12), width: info.rect[2] + 24, height: info.rect[3] + 24 };
        const a = await d.page.screenshot({ clip, scale: 'css' });
        await doc.evaluate(s => document.querySelector(s).blur(), sel); await sleep(400);
        R.shadowBlurred = await doc.evaluate(s => getComputedStyle(document.querySelector(s)).boxShadow.slice(0, 160), sel);
        const b = await d.page.screenshot({ clip, scale: 'css' });
        const df = await diffPair(dec, a, b);
        R.changedPx = df.changed; R.totalPx = df.total;
        const k = `${engine}|${mode}|${area}|${sel}`;
        if (keepPng.has(k)) { const f = path.join(EV, `${NAME}-${engine}-${mode}-${area}.png`); fs.writeFileSync(f, Buffer.from(df.png, 'base64')); R.shot = path.relative(ROOT, f).replace(/\\/g, '/'); }
        if (engine === 'chromium' && mode === 'light' && sel !== '#plus') {
          await doc.evaluate(() => { const s = document.createElement('style'); s.id = 'cf'; s.textContent = '.ds .btn:focus-visible{box-shadow:var(--focus) !important}'; document.head.appendChild(s); });
          const t2 = await tabTo(d, doc, frameEl, sel);
          const i2 = await probe();
          const a2 = await d.page.screenshot({ clip, scale: 'css' });
          await doc.evaluate(s => document.querySelector(s).blur(), sel); await sleep(400);
          const b2 = await d.page.screenshot({ clip, scale: 'css' });
          const df2 = await diffPair(dec, a2, b2);
          R.counterfactual = { reachedByTab: t2.hit, fv: i2.fv, shadow: i2.shadow, changedPx: df2.changed };
          if (keepPng.has(k + '|cf')) { const f = path.join(EV, `${NAME}-${engine}-${mode}-${area}-counterfactual.png`); fs.writeFileSync(f, Buffer.from(df2.png, 'base64')); R.counterfactual.shot = path.relative(ROOT, f).replace(/\\/g, '/'); }
        }
        await d.close();
      } catch (e) { R.error = String(e.message || e).split('\n')[0]; }
      out.results.push(R);
      console.log(engine, mode, area, sel, JSON.stringify({ tab: R.reachedByTab, n: R.presses, fv: R.focusVisible, changed: R.changedPx, of: R.totalPx, cf: R.counterfactual && R.counterfactual.changedPx, err: R.error }));
    }
  } finally { await L.close(); }
}
const f = path.join(EV, NAME + (ENGINES.length === 1 ? '-' + ENGINES[0] : '') + '.json');
fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log('wrote', path.relative(ROOT, f));
