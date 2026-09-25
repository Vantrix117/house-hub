// Phase 4 ICON skeptic #2 — independent check of "the 20 % duotone never renders on sprite icons (<use>)".
// Unlike duo-sprite.mjs (a synthetic 192 px strip), this measures the icons AS SHIPPED on real surfaces:
//   1. Screenshot the page as it ships (twice, to measure paint noise).
//   2. For every visible svg.icon on the surface, record whether it draws via <use> or inline and whether its geometry
//      declares a .duo path, plus the computed fill of the .duo node where one is reachable in the DOM.
//   3. Oracle A: replace each <use> in place with an inline copy of its <symbol> content (so `.ds .icon .duo` can match)
//      and screenshot again. A <use> icon whose pixels change was NOT showing the duotone as shipped.
//   4. Oracle B: strip class="duo" from inline icons (they then draw as plain outlines) and screenshot. An inline icon
//      whose pixels change WAS showing the duotone as shipped.
// Read-only against the app: it mutates the live DOM of a local page only.
//   node audits/tools/phase4/ICON/verify-duotone-missing-on-sprite-2.mjs [webkit|chromium]
// → audits/evidence/p4/ICON/verify-duotone-missing-on-sprite-2-<engine>.json (+ one PNG pair, webkit light only)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const engine = process.argv[2] || 'webkit';
const OUT = path.resolve('audits/evidence/p4/ICON');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine });
const res = { engine, runs: [] };

const snap = async page => (await page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' })).toString('base64');

async function diff(page, a, b, boxes) {
  return page.evaluate(async ([a, b, boxes]) => {
    const dec = async s => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
    const [A, B] = [await dec(a), await dec(b)];
    return boxes.map(bx => {
      let n = 0, max = 0;
      const x0 = Math.max(0, Math.floor(bx.x)), y0 = Math.max(0, Math.floor(bx.y)), x1 = Math.min(A.width, Math.ceil(bx.x + bx.w)), y1 = Math.min(A.height, Math.ceil(bx.y + bx.h));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const o = (y * A.width + x) * 4; const d = Math.max(Math.abs(A.data[o] - B.data[o]), Math.abs(A.data[o + 1] - B.data[o + 1]), Math.abs(A.data[o + 2] - B.data[o + 2]));
        if (d > 6) n++; if (d > max) max = d;
      }
      return { changedPx: n, maxDelta: max };
    });
  }, [a, b, boxes]);
}

const SURFACES = [
  { name: 'home-adult', device: 'ipad-portrait', profile: 'eli', hash: '#home', wait: '#view-home .home-hero' },
  { name: 'me-adult', device: 'ipad-portrait', profile: 'eli', hash: '#me', wait: '#view-me .me-hero' },
  { name: 'tv', device: 'tv', profile: 'tv', hash: '#home', wait: null },
];

try {
  for (const s of SURFACES) for (const mode of ['light', 'dark']) {
    const d = await L.device({ device: s.device, mode, profile: s.profile });
    await d.goto(s.hash);
    if (s.wait) await d.page.waitForSelector(s.wait, { timeout: 15000 }).catch(() => {});
    await sleep(2500);
    const icons = await d.page.evaluate(() => {
      const out = [];
      document.querySelectorAll('svg.icon').forEach((svg, i) => {
        const b = svg.getBoundingClientRect(); const st = getComputedStyle(svg);
        if (!b.width || !b.height || st.visibility === 'hidden' || b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) return;
        let hidden = false; for (let e = svg; e; e = e.parentElement) if (getComputedStyle(e).display === 'none') hidden = true; if (hidden) return;
        svg.setAttribute('data-vd', i);
        const use = svg.querySelector('use');
        const ref = use ? (use.getAttribute('href') || use.getAttribute('xlink:href')) : null;
        const sym = ref ? document.querySelector(ref) : null;
        const duoNode = use ? (sym && sym.querySelector('.duo')) : svg.querySelector('.duo');
        const cs = duoNode ? getComputedStyle(duoNode) : null;   // for <use>, this is the symbol's node, not the instance
        const where = svg.closest('h2') ? 'head:' + svg.closest('h2').textContent.trim().slice(0, 28) : (svg.closest('#tabbar') ? 'tabbar' : (svg.closest('.feed') ? 'feed' : (svg.closest('button') ? 'button:' + (svg.closest('button').getAttribute('aria-label') || svg.closest('button').textContent.trim()).slice(0, 24) : (svg.closest('[class]') || svg).className.toString().slice(0, 30))));
        out.push({ i, where, via: use ? 'use' : 'inline', ref, hasDuo: !!duoNode, duoFill: cs && cs.fill, duoFillOpacity: cs && cs.fillOpacity, tint: getComputedStyle(svg).getPropertyValue('--tint').trim(), box: { x: b.x, y: b.y, w: b.width, h: b.height } });
      });
      return out;
    });
    const boxes = icons.map(c => c.box);
    const a1 = await snap(d.page); await sleep(300); const a2 = await snap(d.page);
    const noise = await diff(d.page, a1, a2, boxes);
    // Oracle A: inline every <use>
    await d.page.evaluate(() => { document.querySelectorAll('svg.icon[data-vd] use').forEach(u => { const sym = document.querySelector(u.getAttribute('href')); const svg = u.parentNode; if (!svg.getAttribute('viewBox') && sym) svg.setAttribute('viewBox', sym.getAttribute('viewBox')); const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('data-vd-inlined', ''); g.innerHTML = sym ? sym.innerHTML : ''; svg.replaceChild(g, u); }); });
    await sleep(300);
    const b = await snap(d.page);
    const inl = await diff(d.page, a1, b, boxes);
    if (engine === 'webkit' && mode === 'light' && s.name === 'home-adult') {
      const clip = { x: 0, y: 0, width: 820, height: 1180 };
      fs.writeFileSync(path.join(OUT, 'verify-duotone-missing-on-sprite-2-shipped.png'), Buffer.from(a1, 'base64'));
      fs.writeFileSync(path.join(OUT, 'verify-duotone-missing-on-sprite-2-inlined.png'), Buffer.from(b, 'base64'));
    }
    // Oracle B: from the inlined state, strip .duo on the icons that were inline originally
    const origInline = icons.filter(c => c.via === 'inline').map(c => c.i);
    await d.page.evaluate(ids => { ids.forEach(i => document.querySelectorAll(`svg.icon[data-vd="${i}"] .duo`).forEach(p => p.remove())); }, origInline);
    await sleep(300);
    const c = await snap(d.page);
    const strip = await diff(d.page, b, c, boxes);
    const rows = icons.map((ic, k) => ({ ...ic, noise: noise[k], inlineVsShipped: inl[k], stripDuoFromInline: ic.via === 'inline' ? strip[k] : null,
      rendersDuoAsShipped: !ic.hasDuo ? null : (ic.via === 'use' ? !(inl[k].changedPx > Math.max(4, noise[k].changedPx * 2)) : strip[k].changedPx > Math.max(4, noise[k].changedPx * 2)) }));
    const withDuo = rows.filter(r => r.hasDuo);
    res.runs.push({ surface: s.name, device: s.device, mode, total: rows.length, declareDuo: withDuo.length, renderDuo: withDuo.filter(r => r.rendersDuoAsShipped).length,
      useDeclare: withDuo.filter(r => r.via === 'use').length, useRender: withDuo.filter(r => r.via === 'use' && r.rendersDuoAsShipped).length,
      inlineDeclare: withDuo.filter(r => r.via === 'inline').length, inlineRender: withDuo.filter(r => r.via === 'inline' && r.rendersDuoAsShipped).length, rows });
    await d.close();
  }
} catch (e) { res.error = String(e && e.stack || e); }
finally { await L.close(); }
fs.writeFileSync(path.join(OUT, `verify-duotone-missing-on-sprite-2-${engine}.json`), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res.runs.map(r => ({ s: r.surface, mode: r.mode, total: r.total, declareDuo: r.declareDuo, renderDuo: r.renderDuo, use: `${r.useRender}/${r.useDeclare}`, inline: `${r.inlineRender}/${r.inlineDeclare}`, heads: r.rows.filter(x => x.hasDuo).map(x => `${x.where}|${x.via}|${x.rendersDuoAsShipped ? 'DUO' : 'plain'}|inl${x.inlineVsShipped.changedPx}|n${x.noise.changedPx}`) })), null, 1));
if (res.error) console.log(res.error);
