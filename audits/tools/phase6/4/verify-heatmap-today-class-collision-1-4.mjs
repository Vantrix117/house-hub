// Batch 4 copy of audits/tools/phase3/f260/verify-heatmap-today-class-collision-1.mjs: the heatmap's today cell is .is-today since batch 4 (P3-F260-08: a bare .today matched the Today card's rules), so the cell is found by that class; nothing else changed.
// Skeptic #1 for "heatmap-today-class-collision": does the heatmap's today cell (class "today") pick up the Today card's
// bare .today rules (apps/f260.html:117, 153, 156)? Independent measurement: every heatmap cell's box + grid position,
// the today cell's computed styles, and a control where the class is swapped for a neutral one (same cell, same data).
//   node "audits/tools/phase3/f260/verify-heatmap-today-class-collision-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'f260');
const P = 'verify-heatmap-today-class-collision-1';
const out = { devices: {} };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const dev of ['iphone-pwa', 'ipad-portrait', 'ipad-landscape', 'desktop']) {
    const d = await L.device({ device: dev, profile: 'eli', installClock: DEMO });
    // read-only: block writes so the demo DB stays as seeded
    await d.ctx.route(u => u.href.startsWith(L.api + '/api/') && !u.href.startsWith(L.api + '/api/media/'), r => r.request().method() === 'GET' ? r.fallback() : r.abort());
    const f = await d.openApp('f260');
    await f.waitForFunction(() => document.querySelectorAll('#heat span').length === 84 && document.querySelector('#heat span.is-today'), null, { timeout: 20000 });
    await sleep(400);
    const measure = () => f.evaluate(() => {
      const heat = document.getElementById('heat'), hb = heat.getBoundingClientRect();
      const cells = [...heat.querySelectorAll('span')];
      const ti = cells.findIndex(c => c.classList.contains('is-today'));
      const box = e => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left - hb.left), y: Math.round(b.top - hb.top), w: Math.round(b.width), h: Math.round(b.height) }; };
      const t = cells[ti], c = getComputedStyle(t);
      // distinct column x positions and row y positions across all cells: a clean 12x7 grid has 12 and 7
      const xs = new Set(cells.map(e => box(e).x)), ys = new Set(cells.map(e => box(e).y));
      const sizes = {}; cells.forEach((e, i) => { if (i === ti) return; const b = box(e); const k = b.w + 'x' + b.h; sizes[k] = (sizes[k] || 0) + 1; });
      return {
        vw: innerWidth, todayIndex: ti, todayTitle: t.title, todayClass: t.className,
        todayBox: box(t), otherSizes: sizes,
        todayStyle: { display: c.display, gridColumn: c.gridColumnStart + ' / ' + c.gridColumnEnd, padding: c.padding, border: c.borderTopWidth + ' ' + c.borderTopStyle, margin: c.margin, borderRadius: c.borderRadius, boxShadow: c.boxShadow.slice(0, 50), bgImage: c.backgroundImage.slice(0, 40) },
        neighbours: { before: box(cells[ti - 1]), after: box(cells[ti + 1]) },
        heatBox: { w: Math.round(hb.width), h: Math.round(hb.height) }, distinctX: xs.size, distinctY: ys.size,
      };
    });
    const m = await measure();
    await f.evaluate(() => document.querySelector('#heat span.is-today').scrollIntoView({ block: 'center' })); await sleep(250);
    const hb = await f.locator('#heat').boundingBox();
    const shotFile = path.join(EVID, `${P}-${dev}.png`);
    await d.page.screenshot({ path: shotFile, scale: 'css', animations: 'disabled', clip: { x: Math.max(0, hb.x - 16), y: Math.max(0, hb.y - 16), width: Math.min(hb.width + 32, 460), height: hb.height + 32 } });
    // control: same cell, class renamed to "tdy" with only the intended ring — isolates the bare .today rules as the cause
    await f.evaluate(() => { const s = document.createElement('style'); s.textContent = '.heat span.tdy{box-shadow:0 0 0 2px var(--gold)}'; document.head.appendChild(s); const t = document.querySelector('#heat span.is-today'); t.classList.replace('is-today', 'tdy'); t.classList.add('today-ctl'); });
    const ctl = await f.evaluate(() => { const heat = document.getElementById('heat'), hb = heat.getBoundingClientRect(); const t = heat.querySelector('.tdy'); const b = t.getBoundingClientRect(); const cells = [...heat.querySelectorAll('span')]; return { todayBox: { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.left - hb.left), y: Math.round(b.top - hb.top) }, heatH: Math.round(hb.height), distinctX: new Set(cells.map(e => Math.round(e.getBoundingClientRect().left))).size, distinctY: new Set(cells.map(e => Math.round(e.getBoundingClientRect().top))).size }; });
    m.control = ctl;
    out.devices[dev] = m;
    console.log(dev, 'vw', m.vw, '| today', JSON.stringify(m.todayBox), JSON.stringify(m.todayStyle), '| other', JSON.stringify(m.otherSizes), '| heat', JSON.stringify(m.heatBox), 'cols', m.distinctX, 'rows', m.distinctY, '| neighbours', JSON.stringify(m.neighbours), '| CONTROL', JSON.stringify(ctl));
    await d.ctx.close();
  }
} finally { await L.close(); }
out.script = 'audits/tools/phase3/f260/' + P + '.mjs';
fs.writeFileSync(path.join(EVID, P + '.json'), JSON.stringify(out, null, 1));
console.log('wrote', 'audits/evidence/p3/f260/' + P + '.json');
