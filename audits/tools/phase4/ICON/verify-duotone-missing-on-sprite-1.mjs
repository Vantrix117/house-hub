// Phase 4 ICON — skeptic #1 re-measure of "duotone-missing-on-sprite".
// Independent method (not the original duo-sprite.mjs test strip): for EVERY real `svg.icon` in the shell DOM on each
// surface, build three 48 px copies in an overlay that carries the original's computed `color`, `--tint` and a solid
// background:  A = a clone of the shipped element itself (keeps its <use> or inline paths);  B = control, the same
// geometry inline with every `.duo` element removed;  C = positive control, the same geometry inline WITH `.duo`.
// A duotone "renders" when A's pixels differ from B's; C vs B proves the recipe would render inline in that context.
// Read-only: only adds a DOM overlay and screenshots it.
//   node audits/tools/phase4/ICON/verify-duotone-missing-on-sprite-1.mjs [webkit|chromium]
// → audits/evidence/p4/ICON/verify-duotone-missing-on-sprite-1-<engine>.json (+ -<engine>.png of the Home batch, 1x CSS)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const engine = process.argv[2] || 'webkit';
const OUT = path.resolve('audits/evidence/p4/ICON');
fs.mkdirSync(OUT, { recursive: true });
const waitFn = (d, fn, t = 10000) => d.page.waitForFunction(fn, null, { timeout: t }).then(() => true, () => false);
async function settle(d) {
  await d.page.waitForSelector('#view-home .home-hero, #view-home #tv, #tv', { timeout: 15000 });
  await waitFn(d, () => !!(window.hub && hub.sync && hub.sync.lastPull));
  await sleep(1200);
}
const tab = async (d, t) => { await d.page.click(`#tabbar .tab[data-tab="${t}"]`); await sleep(900); };
const SURF = [
  ['home', 'ipad-portrait', 'eli', null, ['light', 'dark']],
  ['apps', 'ipad-portrait', 'eli', d => tab(d, 'apps'), ['light']],
  ['chat', 'ipad-portrait', 'eli', d => tab(d, 'chat'), ['light']],
  ['me', 'ipad-portrait', 'eli', d => tab(d, 'me'), ['light']],
  ['kid-home', 'ipad-portrait', 'ezra', null, ['light']],
  ['tv', 'tv', 'tv', null, ['light']],
];

const L = await local({ variant: 'typical', clock: 'demo', engine });
const res = { engine, method: 'fill region = pixels where C (inline with .duo) differs from B (inline, .duo removed) by >12; shipped copy A renders the duotone when, in that region, more pixels are closer to C than to B. AvsB alone is confounded: an unstyled .duo path reached through <use> is stroked a second time, so edges differ', surfaces: {} };
try {
  for (const [name, device, profile, go, modes] of SURF) {
    for (const mode of modes) {
      const d = await L.device({ device, mode, profile });
      await d.goto('#home'); await settle(d); if (go) await go(d);
      const vw = await d.page.evaluate(() => innerWidth);
      const icons = await d.page.evaluate(() => {
        const all = [...document.querySelectorAll('svg.icon')].filter(s => !s.closest('#vrf-ovl'));
        window.__vrf = all;
        return all.map((s, i) => {
          const u = s.querySelector('use');
          const href = u ? (u.getAttribute('href') || u.getAttribute('xlink:href')) : null;
          const src = href ? document.querySelector(href) : s;
          const declared = !!(src && src.querySelector('.duo'));
          const h = s.closest('h2, button, .tab, .ficon, [id]');
          const r = s.getBoundingClientRect();
          return { i, via: href ? 'use' : 'inline', href, declared, where: h ? (h.id ? '#' + h.id : h.tagName.toLowerCase() + (h.className && typeof h.className === 'string' ? '.' + h.className.split(' ')[0] : '')) + ' ' + (h.textContent || '').trim().slice(0, 28) : '', displayed: r.width > 0 && r.height > 0 };
        });
      });
      const idx = icons.map(x => x.i);
      const results = [];
      for (let b = 0; b < idx.length; b += 36) {
        const batch = idx.slice(b, b + 36);
        const boxes = await d.page.evaluate(async ([batch, vw]) => {
          document.getElementById('vrf-ovl')?.remove();
          const ov = document.createElement('div'); ov.id = 'vrf-ovl';
          ov.style.cssText = `position:fixed;left:0;top:0;width:${vw}px;z-index:2147483647;display:flex;flex-wrap:wrap;gap:8px;padding:8px;background:#808080`;
          document.body.appendChild(ov);
          const out = [];
          for (const i of batch) {
            const s = window.__vrf[i]; const cs = getComputedStyle(s);
            const u = s.querySelector('use'); const href = u ? (u.getAttribute('href') || u.getAttribute('xlink:href')) : null;
            const src = href ? document.querySelector(href) : s;
            const vb = (src && src.getAttribute('viewBox')) || s.getAttribute('viewBox') || '0 0 24 24';
            const w = document.createElement('div');
            w.style.cssText = `display:flex;gap:6px;padding:4px;background:#ffffff;color:${cs.color};--tint:${cs.getPropertyValue('--tint') || 'var(--accent)'}`;
            const A = s.cloneNode(true); A.removeAttribute('id'); A.style.cssText = 'width:48px;height:48px;flex:none';
            const mk = keep => { const n = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); n.setAttribute('class', 'icon'); n.setAttribute('viewBox', vb); n.style.cssText = 'width:48px;height:48px;flex:none'; n.innerHTML = src ? src.innerHTML : ''; if (!keep) n.querySelectorAll('.duo').forEach(e => e.remove()); return n; };
            const B = mk(false), C = mk(true);
            w.append(A, B, C); ov.appendChild(w);
            out.push({ i, A, B, C });
          }
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const rb = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
          return out.map(o => ({ i: o.i, A: rb(o.A), B: rb(o.B), C: rb(o.C) }));
        }, [batch, vw]);
        const png = await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
        if (name === 'home' && mode === 'light' && b === 0) fs.writeFileSync(path.join(OUT, `verify-duotone-missing-on-sprite-1-${engine}.png`), await d.page.screenshot({ scale: 'css', clip: { x: 0, y: 0, width: vw, height: 420 } }));
        const diffs = await d.page.evaluate(async ([b64, boxes]) => {
          const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
          const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
          const get = r => cx.getImageData(Math.round(r.x), Math.round(r.y), 48, 48).data;
          const diff = (p, q) => { let n = 0, m = 0; for (let k = 0; k < p.length; k += 4) { const dd = Math.abs(p[k] - q[k]) + Math.abs(p[k + 1] - q[k + 1]) + Math.abs(p[k + 2] - q[k + 2]); if (dd > 6) n++; m = Math.max(m, dd); } return { px: n, maxDelta: m }; };
          const d3 = (p, q, k) => Math.abs(p[k] - q[k]) + Math.abs(p[k + 1] - q[k + 1]) + Math.abs(p[k + 2] - q[k + 2]);
          // fill region = pixels where the inline WITH-duo copy (C) differs from the no-duo control (B) by > 12;
          // in that region, does the shipped copy (A) look like C (tinted) or like B (untinted)?
          const fillRegion = (A, B, C) => { let n = 0, likeC = 0, likeB = 0; for (let k = 0; k < C.length; k += 4) { if (d3(C, B, k) > 12) { n++; const a = d3(A, C, k), b = d3(A, B, k); if (a < b) likeC++; else likeB++; } } return { px: n, likeTinted: likeC, likeUntinted: likeB }; };
          return boxes.map(bx => { const A = get(bx.A), B = get(bx.B), C = get(bx.C); return { i: bx.i, AvsB: diff(A, B), CvsB: diff(C, B), AvsC: diff(A, C), fill: fillRegion(A, B, C) }; });
        }, [png.toString('base64'), boxes]);
        results.push(...diffs);
        await d.page.evaluate(() => document.getElementById('vrf-ovl')?.remove());
      }
      const items = icons.map(x => { const r = results.find(y => y.i === x.i); return { ...x, AvsB: r.AvsB, CvsB: r.CvsB, AvsC: r.AvsC, fill: r.fill, rendersDuo: r.fill.px > 20 && r.fill.likeTinted > r.fill.likeUntinted, inlineWouldRender: r.fill.px > 20 }; });
      const decl = items.filter(x => x.declared);
      res.surfaces[`${name}-${mode}`] = {
        device, profile, icons: items.length,
        declared: decl.length, declaredUse: decl.filter(x => x.via === 'use').length, declaredInline: decl.filter(x => x.via === 'inline').length,
        rendered: decl.filter(x => x.rendersDuo).length,
        renderedUse: decl.filter(x => x.via === 'use' && x.rendersDuo).length,
        renderedInline: decl.filter(x => x.via === 'inline' && x.rendersDuo).length,
        positiveControlOkForUse: decl.filter(x => x.via === 'use' && x.inlineWouldRender).length,
        falseRenderWithoutDuo: items.filter(x => !x.declared && x.rendersDuo).length,
        items,
      };
      const s = res.surfaces[`${name}-${mode}`];
      console.log(`${name}-${mode}: icons ${s.icons} declared ${s.declared} (use ${s.declaredUse}, inline ${s.declaredInline}) rendered ${s.rendered} (use ${s.renderedUse}, inline ${s.renderedInline}); use positive control ${s.positiveControlOkForUse}; nondeclared diff ${s.falseRenderWithoutDuo}`);
      await d.close();
    }
  }
} catch (e) { res.error = String(e && e.stack || e); console.log(res.error); }
finally { await L.close(); }
fs.writeFileSync(path.join(OUT, `verify-duotone-missing-on-sprite-1-${engine}.json`), JSON.stringify(res, null, 1));
