// Phase 4 ICON skeptic #1 — independent check of "in the .ds apps every icon's own stroke-width/fill attribute is dead".
// For Kid Verse (as ezra, kid, and eli, adult) and Verses (as eli), on the local instance:
//   1. Every <svg class="icon"> that carries a stroke-width or fill presentation attribute: attribute vs the computed
//      stroke-width / fill of the svg and of its first shape, plus which author rules match.
//   2. Pixel oracle: screenshot each such icon as shipped, then copy its presentation attributes into an inline style
//      (so they win over `.ds .icon`) and screenshot again. Changed pixels = the attribute was NOT honoured as shipped.
// Read-only: only mutates the live DOM of a local page (and taps Verses' Show, a view toggle).
//   node audits/tools/phase4/ICON/verify-ds-icon-overrides-attributes-1.mjs [webkit|chromium]
// → audits/evidence/p4/ICON/verify-ds-icon-overrides-attributes-1-<engine>.json (+ badge-row PNG pair, webkit only)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const engine = process.argv[2] || 'webkit';
const OUT = path.resolve('audits/evidence/p4/ICON');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine });
const res = { engine, runs: [] };

const collect = () => [...document.querySelectorAll('svg.icon')].filter(s => s.hasAttribute('stroke-width') || s.hasAttribute('fill')).map((s, i) => {
  s.setAttribute('data-vx', i);
  const shape = s.querySelector('path, circle, rect, line, polyline');
  const cs = getComputedStyle(s), ps = shape ? getComputedStyle(shape) : null;
  const b = s.getBoundingClientRect();
  const host = s.closest('button, li, [id]');
  const label = host ? (host.id || host.getAttribute('data-badge') || host.getAttribute('data-rate') || host.textContent.trim().slice(0, 24)) : '?';
  let vis = !!(b.width && b.height); for (let e = s; e; e = e.parentElement) if (getComputedStyle(e).display === 'none' || e.hidden) vis = false;
  return { i, label, cls: s.getAttribute('class'), attrStrokeWidth: s.getAttribute('stroke-width'), attrFill: s.getAttribute('fill'),
    svgComputed: { strokeWidth: cs.strokeWidth, fill: cs.fill, stroke: cs.stroke },
    shapeComputed: ps && { strokeWidth: ps.strokeWidth, fill: ps.fill, stroke: ps.stroke },
    visible: vis, box: { x: b.x, y: b.y, w: b.width, h: b.height } };
});

async function shotBox(frame, page, i) {
  const el = await frame.$(`svg[data-vx="${i}"]`);
  if (!el) return null;
  try { return (await el.screenshot({ scale: 'css', animations: 'disabled' })).toString('base64'); } catch { return null; }
}
async function diff(page, a, b) {
  return page.evaluate(async ([a, b]) => {
    const dec = async s => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
    const [A, B] = [await dec(a), await dec(b)]; if (A.width !== B.width || A.height !== B.height) return { sizeMismatch: true };
    let n = 0, max = 0;
    for (let o = 0; o < A.data.length; o += 4) { const d = Math.max(Math.abs(A.data[o] - B.data[o]), Math.abs(A.data[o + 1] - B.data[o + 1]), Math.abs(A.data[o + 2] - B.data[o + 2])); if (d > 12) n++; if (d > max) max = d; }
    return { changedPx: n, totalPx: A.width * A.height, maxDelta: max };
  }, [a, b]);
}

async function run(who, dev, app, prep) {
  const d = await L.device({ device: dev, profile: who });
  const f = await d.openApp(app); await sleep(3000);
  if (prep) await prep(f);
  // unhide hidden buttons (e.g. story-heard) so they can be pixel-tested; do not change styles otherwise
  const icons = await f.evaluate(collect);
  const pixel = [];
  for (const ic of icons.filter(x => x.visible)) {
    const a1 = await shotBox(f, d.page, ic.i); await sleep(150); const a2 = await shotBox(f, d.page, ic.i);
    await f.evaluate(i => { const s = document.querySelector(`svg[data-vx="${i}"]`); const sw = s.getAttribute('stroke-width'), fl = s.getAttribute('fill'); if (sw) s.style.strokeWidth = sw; if (fl) s.style.fill = fl; }, ic.i);
    await sleep(200);
    const b = await shotBox(f, d.page, ic.i);
    await f.evaluate(i => { const s = document.querySelector(`svg[data-vx="${i}"]`); s.style.strokeWidth = ''; s.style.fill = ''; }, ic.i);
    if (!a1 || !b) { pixel.push({ i: ic.i, label: ic.label, note: 'no screenshot' }); continue; }
    pixel.push({ i: ic.i, label: ic.label, noise: await diff(d.page, a1, a2), honoured: await diff(d.page, a1, b) });
  }
  let badgePng = null;
  if (app === 'kidverse' && engine === 'webkit') {
    const row = await f.$('#rw-badges');
    if (row) {
      await row.scrollIntoViewIfNeeded().catch(() => {}); await sleep(300);
      const shipped = await row.screenshot({ scale: 'css', animations: 'disabled' });
      await f.evaluate(() => { const s = document.querySelector('[data-badge="prayer"] .bicon svg'); if (s) s.style.fill = 'currentColor'; });
      await sleep(200);
      const intended = await row.screenshot({ scale: 'css', animations: 'disabled' });
      await f.evaluate(() => { const s = document.querySelector('[data-badge="prayer"] .bicon svg'); if (s) s.style.fill = ''; });
      const base = `verify-ds-icon-overrides-attributes-1-badges-${who}`;
      fs.writeFileSync(path.join(OUT, base + '-shipped.png'), shipped);
      fs.writeFileSync(path.join(OUT, base + '-attr-honoured.png'), intended);
      badgePng = [base + '-shipped.png', base + '-attr-honoured.png'];
    }
  }
  const rules = await f.evaluate(() => {
    const out = []; for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch { continue; } for (const r of rs) if (r.selectorText && /\.icon\b/.test(r.selectorText) && /(fill|stroke-width)/.test(r.cssText)) out.push((sh.href || 'inline').split('/').pop() + ' :: ' + r.cssText.slice(0, 200)); } return out; });
  res.runs.push({ who, dev, app, bodyClass: await f.evaluate(() => document.body.className), icons, pixel, badgePng, iconRules: rules });
  await d.close();
}

try {
  await run('ezra', 'iphone-pwa', 'kidverse');
  await run('eli', 'ipad-portrait', 'kidverse');
  await run('eli', 'ipad-portrait', 'verses', async f => { const s = await f.$('#show'); if (s && await s.isVisible()) { await s.click(); await sleep(800); } });
} catch (e) { res.error = String(e && e.stack || e); }
finally { await L.close(); }
fs.writeFileSync(path.join(OUT, `verify-ds-icon-overrides-attributes-1-${engine}.json`), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, (k, v) => k === 'box' ? undefined : v, 1).slice(0, 12000));
