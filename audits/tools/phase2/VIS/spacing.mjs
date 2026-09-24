// VIS spacing rhythm: every computed padding / margin / gap on the visible shell elements of Home, Apps and Me
// (iPhone + iPad, adult) — how many sit on the 4 px grid, which values are off it, and the page side margins.
//   node "audits/tools/phase2/VIS/spacing.mjs"      → audits/evidence/p2/VIS/spacing.json
import { local } from '../../lib/local.mjs';
import { SURFACES, save } from './lib-vis.mjs';

const out = {};
const L = await local({ variant: 'typical' });
try {
  for (const device of ['iphone-pwa', 'ipad-portrait', 'ipad-landscape']) {
    for (const s of ['home', 'apps', 'me']) {
      const { d } = await SURFACES[s](L, { device, mode: 'light' });
      const r = await d.page.evaluate(() => {
        const vals = {}; let n = 0, on = 0;
        const props = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap'];
        for (const el of document.querySelectorAll('#views *')) {
          if (el.closest('svg') || !el.getClientRects().length) continue;
          const cs = getComputedStyle(el);
          for (const p of props) { const v = parseFloat(cs[p]); if (!v || isNaN(v)) continue; n++; if (Math.abs(v / 4 - Math.round(v / 4)) < 0.01) on++; else { const k = v + 'px'; (vals[k] ||= new Set()).add(el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName.toLowerCase()); } }
        }
        const view = document.querySelector('.view.on').getBoundingClientRect();
        return { values: n, onGrid4: on, share: +(on / n).toFixed(3), offGrid: Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, [...v].slice(0, 6)])), sideMargins: [Math.round(view.left), Math.round(innerWidth - view.right)] };
      });
      out[`${s}-${device}`] = r;
      console.log(`${s}-${device}: ${r.onGrid4}/${r.values} spacing values on the 4 px grid (${Math.round(r.share * 100)}%); side margins ${r.sideMargins.join('/')} px; off-grid: ${JSON.stringify(r.offGrid)}`);
      await d.close();
    }
  }
} finally { await L.close(); }
console.log('wrote', save('spacing.json', out));
