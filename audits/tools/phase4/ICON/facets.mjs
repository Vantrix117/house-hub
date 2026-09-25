// Phase 4 ICON — targeted checks of what the icon markup asks for against what the browser computes.
//   A. In the `.ds` apps (Kid Verse, Verses) an icon's own presentation attributes (stroke-width="2.25", fill="currentColor")
//      lose to design.css `.ds .icon { fill:none; stroke-width:1.75 }` (a CSS rule beats an SVG presentation attribute).
//      For every <svg class="icon"> with a stroke-width or fill attribute: attribute vs computed.
//   B. The Kid Verse "Prayer warrior" badge heart (GLYPH.heart, fill="currentColor"): computed fill/stroke of its path.
//   C. The Verses rating row (Not yet / Almost / Got it), revealed with Show: the three glyphs and their meaning.
// Read-only except C, which taps Show (a view toggle, no write).
//   node audits/tools/phase4/ICON/facets.mjs → audits/evidence/p4/ICON/facets.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const OUT = path.resolve('audits/evidence/p4/ICON');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const attrVsComputed = () => [...document.querySelectorAll('svg.icon')].filter(s => s.getAttribute('stroke-width') || s.getAttribute('fill')).map(s => {
  const p = s.querySelector('path, circle, rect, line'); const cs = p ? getComputedStyle(p) : getComputedStyle(s);
  const b = s.closest('button, h2, li, div'); return { where: (b && (b.id || b.className || b.tagName)) + '', attrStrokeWidth: s.getAttribute('stroke-width'), attrFill: s.getAttribute('fill'), computedStrokeWidth: cs.strokeWidth, computedFill: cs.fill, computedStroke: cs.stroke };
});
try {
  for (const [who, dev] of [['eli', 'ipad-portrait'], ['ezra', 'iphone-pwa']]) {
    const d = await L.device({ device: dev, profile: who });
    const kv = await d.openApp('kidverse'); await sleep(3000);
    res['kidverse-' + who] = await kv.evaluate(attrVsComputed);
    res['kidverse-' + who + '-heart'] = await kv.evaluate(() => { const s = document.querySelector('[data-badge="prayer"] .bicon svg'); if (!s) return 'no badge row on this view'; const p = s.querySelector('path'); const cs = getComputedStyle(p); return { svgFillAttr: s.getAttribute('fill'), fill: cs.fill, stroke: cs.stroke, strokeWidth: cs.strokeWidth, badgeEarned: s.closest('li').classList.contains('on') }; });
    const vs = await d.openApp('verses'); await sleep(3000);
    const show = await vs.$('#show'); if (show && await show.isVisible()) { await show.click(); await sleep(800); }
    res['verses-' + who] = await vs.evaluate(attrVsComputed);
    res['verses-' + who + '-rate'] = await vs.evaluate(() => [...document.querySelectorAll('#act-rate button')].map(b => ({ label: b.innerText.trim(), path: b.querySelector('path') && b.querySelector('path').getAttribute('d'), visible: !!b.offsetParent })));
    await d.close();
  }
} catch (e) { res.error = String(e && e.stack || e); }
finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'facets.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
