// Phase 4 ICON — does the 20 % duotone fill (design.css `.ds .icon .duo`) reach sprite icons drawn with <use>?
// The shell's tab bar, Home card heads, feed, TV heads and buttons draw `<svg class="icon"><use href="#i-…"/></svg>`
// from the sprite at index.html:416-438, whose `.duo` paths live inside <symbol>, not inside `.icon`. The tile icons are
// inline SVG (icons/*.svg injected into the DOM with class="icon"), so `.ds .icon .duo` matches them.
// This script opens adult Home, adds a test strip with the same symbol drawn both ways at 192 px (and the real tab-bar
// icon as it ships), then samples the pixel at the centre of the shape's interior (inside the duo path, away from strokes).
// Read-only: it only adds a DOM node to the page and screenshots it.
//
//   node audits/tools/phase4/ICON/duo-sprite.mjs [webkit|chromium]
// → audits/evidence/p4/ICON/duo-sprite-<engine>.json and duo-sprite-<engine>.png (1x CSS)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const engine = process.argv[2] || 'webkit';
const OUT = path.resolve('audits/evidence/p4/ICON');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine });
const res = { engine, cases: [] };
try {
  for (const mode of ['light', 'dark']) {
    const d = await L.device({ device: 'ipad-portrait', mode, profile: 'eli' });
    await d.goto('#home');
    await d.page.waitForSelector('#view-home .home-hero', { timeout: 15000 });
    await sleep(1500);
    const cases = await d.page.evaluate(async () => {
      const sym = document.getElementById('i-home');
      const inner = sym.innerHTML;
      const box = document.createElement('div');
      box.id = 'duo-test';
      box.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;display:flex;gap:16px;padding:16px;background:var(--surface);--tint:var(--accent);color:var(--accent)';
      box.innerHTML = `<svg class="icon" id="t-use" style="width:192px;height:192px" viewBox="0 0 24 24"><use href="#i-home"/></svg>`
        + `<svg class="icon" id="t-inline" style="width:192px;height:192px" viewBox="0 0 24 24">${inner}</svg>`;
      document.body.appendChild(box);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      const duoInline = document.querySelector('#t-inline .duo');
      const cs = getComputedStyle(duoInline);
      // the real tab-bar Home icon, as shipped
      const tab = document.querySelector('#tabbar .tab[data-tab="home"] svg');
      return { use: r('t-use'), inline: r('t-inline'), inlineDuoComputed: { fill: cs.fill, fillOpacity: cs.fillOpacity, stroke: cs.stroke }, tab: tab ? { ...(b => ({ x: b.x, y: b.y, w: b.width, h: b.height }))(tab.getBoundingClientRect()), cls: tab.getAttribute('class') } : null,
        surface: getComputedStyle(box).backgroundColor, accent: getComputedStyle(box).color };
    });
    const png = await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
    if (mode === 'light') fs.writeFileSync(path.join(OUT, `duo-sprite-${engine}.png`), await d.page.screenshot({ scale: 'css', clip: { x: 0, y: 0, width: 440, height: 230 } }));
    // sample in page: the house interior at viewBox (12, 13.5) — inside the duo path, 3+ units from any stroke
    const px = await d.page.evaluate(async ([b64, c]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
      const at = (b, ux, uy) => { const x = Math.round(b.x + b.w * ux / 24), y = Math.round(b.y + b.h * uy / 24); return [...cx.getImageData(x, y, 1, 1).data].slice(0, 3); };
      const out = { useInterior: at(c.use, 7, 13.5), inlineInterior: at(c.inline, 7, 13.5), useOutside: at(c.use, 1, 1), inlineOutside: at(c.inline, 1, 1) };
      if (c.tab) { out.tabInterior = at(c.tab, 7, 13.5); out.tabOutside = at(c.tab, 1, 1); }
      return out;
    }, [png.toString('base64'), cases]);
    res.cases.push({ mode, ...cases, px, duoRendersViaUse: JSON.stringify(px.useInterior) !== JSON.stringify(px.useOutside), duoRendersInline: JSON.stringify(px.inlineInterior) !== JSON.stringify(px.inlineOutside) });
    await d.close();
  }
} catch (e) { res.error = String(e && e.stack || e); }
finally { await L.close(); }
fs.writeFileSync(path.join(OUT, `duo-sprite-${engine}.json`), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
