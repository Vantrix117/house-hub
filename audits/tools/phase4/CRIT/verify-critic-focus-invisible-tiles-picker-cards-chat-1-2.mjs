// Skeptic 2 for critic finding "focus invisible on Apps tiles, picker cards and the chat composer".
// Independent of CRITIC/focus-other-components.mjs: real Tab presses, both engines, a tolerant pixel count (channel delta > 8)
// decoded in a blank page, a noise baseline, and a counterfactual pass that forces `box-shadow: var(--focus) !important`
// on the same stops (proves the crop would show a ring if the cascade let it through).
// Usage: node audits/tools/phase4/CRIT/verify-critic-focus-invisible-tiles-picker-cards-chat-1-2.mjs [webkit|chromium] [light|dark]
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const engine = process.argv[2] || 'chromium';
const mode = process.argv[3] || 'light';
const EV = path.join(ROOT, 'audits/evidence/p4/CRIT');
const TAG = 'verify-critic-focus-invisible-tiles-picker-cards-chat-1-2';
const TARGET = '.tile, .pcard, #chat-in, .switch, .seg button';
const FORCE = '.tile:focus-visible, .pcard:focus-visible, .switch:focus-visible, .seg button:focus-visible, .chat-form .input:focus { box-shadow: var(--focus) !important; }';
const L = await local({ variant: 'typical', engine });
const res = { engine, mode, screens: {} };
let differ;
async function countDiff(a, b) {
  return differ.evaluate(async ([A, B]) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(A), load(B)]);
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const x = c.getContext('2d');
    x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data;
    x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > 8 || Math.abs(da[i + 1] - db[i + 1]) > 8 || Math.abs(da[i + 2] - db[i + 2]) > 8) n++;
    return { changed: n, total: c.width * c.height };
  }, [a.toString('base64'), b.toString('base64')]);
}
async function walk(d, force, screen, save) {
  const page = d.page;
  if (force) await page.addStyleTag({ content: FORCE });
  const rows = []; const seen = new Set();
  for (let i = 0; i < 70; i++) {
    await page.keyboard.press('Tab'); await sleep(140);
    const info = await page.evaluate(sel => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return { key: e.tagName + '#' + e.id + '.' + (typeof e.className === 'string' ? e.className : '') + '[' + (e.dataset.id || '') + ']', match: e.matches(sel),
        label: (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 30),
        fv: e.matches(':focus-visible'), shadow: cs.boxShadow, outline: cs.outlineStyle + ' ' + cs.outlineWidth, caret: cs.caretColor, r: { x: r.x, y: r.y, w: r.width, h: r.height } };
    }, TARGET);
    if (!info) continue;
    if (seen.has(info.key)) break;
    seen.add(info.key);
    if (!info.match) continue;
    const vp = page.viewportSize();
    if (info.r.y < 0 || info.r.y + info.r.h > vp.height) {
      await page.evaluate(() => document.activeElement.scrollIntoView({ block: 'center' })); await sleep(250);
      Object.assign(info.r, await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    }
    const x0 = Math.max(0, Math.floor(info.r.x - 10)), y0 = Math.max(0, Math.floor(info.r.y - 10));
    const clip = { x: x0, y: y0, width: Math.min(vp.width - x0, Math.ceil(info.r.w + 20)), height: Math.min(vp.height - y0, Math.ceil(info.r.h + 20)) };
    const a = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
    const bl = await page.evaluate(() => { const e = document.activeElement; window.__last = e; e.blur(); const c = getComputedStyle(e); return { shadow: c.boxShadow, outline: c.outlineStyle + ' ' + c.outlineWidth }; });
    await sleep(400);
    const b = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
    await sleep(100);
    const b2 = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
    const diff = await countDiff(a, b); const noise = await countDiff(b, b2);
    if (save && !save.done && info.key.includes(save.match)) {
      save.done = true;
      const base = `${TAG}-${engine}-${mode}-${screen}${force ? '-forced' : ''}`;
      fs.writeFileSync(path.join(EV, base + '-focused.png'), a);
      fs.writeFileSync(path.join(EV, base + '-blurred.png'), b);
    }
    rows.push({ key: info.key, label: info.label, fv: info.fv, caret: info.caret, styleChanged: info.shadow !== bl.shadow || info.outline !== bl.outline,
      shadowFocused: info.shadow.slice(0, 80), shadowBlurred: bl.shadow.slice(0, 80), changed: diff.changed, of: diff.total, noise: noise.changed });
    // restore focus to the element (keyboard modality kept) so the next Tab continues from it
    await page.evaluate(() => window.__last.focus()); await sleep(80);
  }
  return rows;
}
try {
  const d0 = await L.device({ device: 'desktop', profile: 'eli', mode });
  differ = await d0.ctx.newPage(); await differ.goto('about:blank');
  for (const [screen, hash, profile, save] of [['picker', '', null, 'last'], ['apps', '#apps', 'eli', 'tile'], ['chat', '#chat', 'eli', 'chat-in'], ['me', '#me', 'eli', 'switch']]) {
    for (const force of [false, true]) {
      const d = await L.device({ device: 'desktop', profile, mode });
      await d.goto(hash); await sleep(2800);
      let initial = null;
      if (screen === 'picker') initial = await d.page.evaluate(() => { const e = document.activeElement; return { active: e.tagName + '.' + e.className + '[' + (e.dataset.id || '') + ']', fv: e.matches(':focus-visible'), shadow: getComputedStyle(e).boxShadow.slice(0, 90) }; });
      if (screen === 'picker' && !force) {
        const r = await d.page.evaluate(() => { const e = document.activeElement; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
        if (r.w) { const clip = { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 10), width: r.w + 20, height: r.h + 20 };
          const a = await d.page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
          await d.page.evaluate(() => document.activeElement.blur()); await sleep(400);
          const b = await d.page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
          initial.loadFocusChanged = (await countDiff(a, b)).changed;
          await d.page.evaluate(() => document.querySelector('#profiles .pcard.last')?.focus()); }
      }
      // start the walk from the top of the document
      await d.page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
      const rows = await walk(d, force, screen, { match: save });
      const k = screen + (force ? ':forced' : '');
      res.screens[k] = { initial, stops: rows.length, zeroChange: rows.filter(r => r.changed === 0).length, rows };
      console.log(k, JSON.stringify(initial || ''), 'stops', rows.length, 'zeroChange', rows.filter(r => r.changed === 0).length);
      for (const r of rows) console.log('  ', JSON.stringify({ k: r.key.slice(0, 55), fv: r.fv, sc: r.styleChanged, ch: r.changed, of: r.of, noise: r.noise, caret: r.caret }));
      await d.close();
    }
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, `${TAG}-${engine}-${mode}.json`), JSON.stringify(res, null, 1));
