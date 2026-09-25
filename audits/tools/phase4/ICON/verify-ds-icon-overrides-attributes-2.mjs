// Phase 4 ICON skeptic #2 — independent check of "in the .ds apps every icon's own stroke-width/fill attribute is dead".
// For Kid Verse (as ezra, kid; and as eli, adult) and Verses (as eli, rating row revealed via Show — a view toggle):
//   1. Every svg.icon carrying a stroke-width or fill attribute: attribute vs computed (on the svg and its first shape),
//      plus which rule wins (the matched `.ds .icon` rule is inferred by toggling body.ds off: computed then = attribute?).
//   2. Pixel oracle: screenshot each such icon as shipped, then force the attribute's value inline (style wins over
//      the stylesheet) and screenshot again. changedPx > noise => the attribute's intent is not what ships.
//   3. The Prayer-warrior heart and the badge star: filled-pixel ratio of the glyph box (outline vs solid).
// Runs on WebKit and Chromium to rule out an engine artefact. Local rig only; no writes.
//   node audits/tools/phase4/ICON/verify-ds-icon-overrides-attributes-2.mjs
// -> audits/evidence/p4/ICON/verify-ds-icon-overrides-attributes-2.json (+ -badges-shipped.png / -badges-intended.png)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const OUT = path.resolve('audits/evidence/p4/ICON');
fs.mkdirSync(OUT, { recursive: true });
const res = {};

const PREFIX = 'verify-ds-icon-overrides-attributes-2';

async function measure(frame, shotName) {
  // tag icons
  const icons = await frame.evaluate(() => {
    const out = [];
    document.querySelectorAll('svg.icon').forEach((s, i) => {
      const sw = s.getAttribute('stroke-width'), fl = s.getAttribute('fill');
      if (!sw && !fl) return;
      const shape = s.querySelector('path, circle, rect, line, polyline');
      const cs = getComputedStyle(shape || s), css = getComputedStyle(s);
      const b = s.getBoundingClientRect();
      s.setAttribute('data-v2', i);
      const ctx = s.closest('button, li, h2, section');
      out.push({ i, where: ctx ? (ctx.id || ctx.getAttribute('data-badge') || ctx.getAttribute('data-rate') || ctx.className || ctx.tagName) + ' ' + (ctx.innerText || '').trim().slice(0, 20) : '?',
        attrStrokeWidth: sw, attrFill: fl, svgComputed: { strokeWidth: css.strokeWidth, fill: css.fill },
        shapeComputed: { strokeWidth: cs.strokeWidth, fill: cs.fill, stroke: cs.stroke },
        visible: !!(b.width && b.height && s.getClientRects().length), box: { x: b.x, y: b.y, w: b.width, h: b.height } });
    });
    // control: without body.ds, does the attribute apply?
    document.body.classList.remove('ds');
    for (const o of out) { const s = document.querySelector(`[data-v2="${o.i}"]`); const sh = s.querySelector('path, circle, rect, line, polyline') || s; const c = getComputedStyle(sh); o.withoutDs = { strokeWidth: c.strokeWidth, fill: c.fill }; }
    document.body.classList.add('ds');
    return out;
  });
  // pixel oracle per visible icon
  for (const o of icons) {
    if (!o.visible) continue;
    const loc = frame.locator(`[data-v2="${o.i}"]`);
    try {
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 });
      await sleep(200);
      const a1 = await loc.screenshot({ animations: 'disabled', scale: 'css' });
      await sleep(150);
      const a2 = await loc.screenshot({ animations: 'disabled', scale: 'css' });
      await frame.evaluate(([i]) => { const s = document.querySelector(`[data-v2="${i}"]`); const sw = s.getAttribute('stroke-width'), fl = s.getAttribute('fill'); if (sw) s.style.strokeWidth = sw; if (fl) { s.style.fill = fl; if (fl !== 'none') s.style.stroke = s.getAttribute('stroke') || 'none'; } }, [o.i]);
      await sleep(150);
      const b = await loc.screenshot({ animations: 'disabled', scale: 'css' });
      await frame.evaluate(([i]) => { const s = document.querySelector(`[data-v2="${i}"]`); s.removeAttribute('style'); }, [o.i]);
      const d = await frame.evaluate(async ([a1, a2, b]) => {
        const dec = async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
        const [A, A2, B] = [await dec(a1), await dec(a2), await dec(b)];
        const cmp = (P, Q) => { let n = 0; for (let k = 0; k < P.data.length; k += 4) if (Math.max(Math.abs(P.data[k] - Q.data[k]), Math.abs(P.data[k + 1] - Q.data[k + 1]), Math.abs(P.data[k + 2] - Q.data[k + 2])) > 6) n++; return n; };
        // "ink" ratio: pixels differing from the corner colour
        const ink = P => { const c0 = [P.data[0], P.data[1], P.data[2]]; let n = 0; for (let k = 0; k < P.data.length; k += 4) if (Math.max(Math.abs(P.data[k] - c0[0]), Math.abs(P.data[k + 1] - c0[1]), Math.abs(P.data[k + 2] - c0[2])) > 30) n++; return +(n / (P.width * P.height)).toFixed(3); };
        return { size: A.width + 'x' + A.height, noisePx: cmp(A, A2), changedPx: cmp(A, B), inkShipped: ink(A), inkIntended: ink(B) };
      }, [a1.toString('base64'), a2.toString('base64'), b.toString('base64')]);
      o.oracle = d;
    } catch (e) { o.oracle = 'error: ' + String(e).slice(0, 120); }
  }
  // badges row shots (kid, webkit only)
  if (shotName) {
    const row = frame.locator('#rw-badges');
    if (await row.count()) {
      await row.scrollIntoViewIfNeeded(); await sleep(300);
      fs.writeFileSync(path.join(OUT, `${PREFIX}-badges-shipped.png`), await row.screenshot({ animations: 'disabled', scale: 'css' }));
      await frame.evaluate(() => { const s = document.querySelector('[data-badge="prayer"] .bicon svg'); if (s) { s.style.fill = 'currentColor'; s.style.stroke = 'none'; } });
      await sleep(200);
      fs.writeFileSync(path.join(OUT, `${PREFIX}-badges-intended.png`), await row.screenshot({ animations: 'disabled', scale: 'css' }));
      await frame.evaluate(() => { const s = document.querySelector('[data-badge="prayer"] .bicon svg'); if (s) s.removeAttribute('style'); });
    }
  }
  // badge glyph facts
  const badges = await frame.evaluate(() => ['first', 'prayer', 'story'].map(id => { const li = document.querySelector(`[data-badge="${id}"]`); if (!li) return { id, present: false }; const s = li.querySelector('.bicon svg'); if (!s) return { id, present: true, svg: false, text: li.querySelector('.bicon').textContent }; const sh = s.querySelector('path'); const c = getComputedStyle(sh); return { id, earned: li.classList.contains('on'), svgClass: s.getAttribute('class'), attrFill: s.getAttribute('fill'), fill: c.fill, stroke: c.stroke, strokeWidth: c.strokeWidth }; }));
  return { icons, badges };
}

for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  const R = res[engine] = {};
  try {
    for (const [who, dev] of [['ezra', 'iphone-pwa'], ['eli', 'ipad-portrait']]) {
      const d = await L.device({ device: dev, profile: who, mode: 'light' });
      const kv = await d.openApp('kidverse'); await sleep(3000);
      R['kidverse-' + who] = await measure(kv, engine === 'webkit' && who === 'ezra');
      const vs = await d.openApp('verses'); await sleep(3000);
      const show = await vs.$('#show'); if (show && await show.isVisible()) { await show.click(); await sleep(900); }
      R['verses-' + who] = await measure(vs, false);
      await d.close();
    }
  } catch (e) { R.error = String(e && e.stack || e); }
  finally { await L.close(); }
}
fs.writeFileSync(path.join(OUT, `${PREFIX}.json`), JSON.stringify(res, null, 1));
// compact summary to stdout
for (const [eng, R] of Object.entries(res)) for (const [k, v] of Object.entries(R)) {
  if (!v || !v.icons) { console.log(eng, k, v); continue; }
  console.log(`== ${eng} ${k}`);
  for (const o of v.icons) console.log(' ', o.where.padEnd(34).slice(0, 34), 'attr sw', o.attrStrokeWidth, 'fill', o.attrFill, '| computed sw', o.shapeComputed.strokeWidth, 'fill', o.shapeComputed.fill, '| no-.ds sw', o.withoutDs.strokeWidth, 'fill', o.withoutDs.fill, '| vis', o.visible, o.oracle ? JSON.stringify(o.oracle) : '');
  console.log('  badges', JSON.stringify(v.badges));
}
