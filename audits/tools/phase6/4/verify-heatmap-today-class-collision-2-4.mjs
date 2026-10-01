// Batch 4 copy of audits/tools/phase3/f260/verify-heatmap-today-class-collision-2.mjs: the heatmap's today cell is .is-today since batch 4 (P3-F260-08: a bare .today matched the Today card's rules), so the cell is found by that class; nothing else changed.
// Skeptic #2: does the heatmap's "today" cell pick up the Today card's .today rules (apps/f260.html:117-157)?
// Measures the today cell vs the other cells on iphone-pwa, ipad-portrait, ipad-landscape and desktop, where every
// cell lands (row/column) relative to its Mon-Sun slot, then a counterfactual: the same cell with the card's
// selector neutralised (class renamed to heat-only styling) to prove the cause is the class collision.
import { local, sleep, save, shot, ready, EVID } from '../../phase3/f260/_lib.mjs';
const PFX = 'verify-heatmap-today-class-collision-2';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  for (const dev of ['iphone-pwa', 'ipad-portrait', 'ipad-landscape', 'desktop']) {
    const d = await L.device({ device: dev, profile: 'eli' });
    await d.goto('#home'); const f = await d.openApp('f260'); await ready(f);
    const m = await f.evaluate(() => {
      const heat = document.getElementById('heat'), hb = heat.getBoundingClientRect();
      const cells = [...heat.querySelectorAll('span')];
      const ti = cells.findIndex(c => c.classList.contains('is-today'));
      const box = c => { const r = c.getBoundingClientRect(), s = getComputedStyle(c);
        return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left - hb.left), y: Math.round(r.top - hb.top),
          display: s.display, gridColumn: s.gridColumnStart + '/' + s.gridColumnEnd, padding: s.paddingTop + ' ' + s.paddingLeft,
          border: s.borderTopWidth + ' ' + s.borderTopStyle, margin: s.marginTop + ' ' + s.marginBottom, cls: c.className }; };
      const todayRules = [...document.styleSheets].flatMap(ss => { try { return [...ss.cssRules]; } catch { return []; } })
        .flatMap(r => r.cssRules ? [...r.cssRules].map(x => ({ x, mq: r.conditionText || r.media?.mediaText })) : [{ x: r }])
        .filter(({ x }) => x.selectorText && cells[ti].matches(x.selectorText)).map(({ x, mq }) => (mq ? '@' + mq + ' ' : '') + x.selectorText);
      // Row slot check: in a Mon-Sun column grid, cell i (from Monday of week 1) belongs at column floor(i/7), row i%7.
      const colW = hb.width; // for reporting only
      const pos = cells.map(c => { const r = c.getBoundingClientRect(); return [Math.round(r.left - hb.left), Math.round(r.top - hb.top)]; });
      const rowsY = [...new Set(cells.filter((_, i) => i !== ti).map((_, i) => pos[i][1]))].sort((a, b) => a - b);
      const misplaced = cells.map((c, i) => { const exp = pos[(Math.floor(i / 7)) * 7]; return { i, x: pos[i][0], y: pos[i][1] }; });
      const heatSize = { w: Math.round(hb.width), h: Math.round(hb.height) };
      return { vw: innerWidth, todayIndex: ti, dow: (new Date().getDay() + 6) % 7, today: box(cells[ti]), other: box(cells[ti === 0 ? 1 : 0]),
        before: box(cells[ti - 1]), after: ti + 1 < cells.length ? box(cells[ti + 1]) : null, last: box(cells[cells.length - 1]),
        heatSize, matchingRules: todayRules, cardTitle: document.getElementById('todayTitle').textContent.trim().slice(0, 40) };
    });
    await f.evaluate(() => document.querySelector('#heat span.is-today').scrollIntoView({ block: 'center' })); await sleep(250);
    const heatEl = await f.$('#heat'); const pngA = `${PFX}-${dev}.png`;
    await heatEl.screenshot({ path: EVID + '/' + pngA, scale: 'css', animations: 'disabled' });
    // counterfactual: scope the card rules away from the cell by swapping the class for an inline equivalent of .heat span.today
    const cf = await f.evaluate(() => { const t = document.querySelector('#heat span.is-today'); t.classList.remove('is-today'); t.style.boxShadow = '0 0 0 2px var(--gold)';
      const r = t.getBoundingClientRect(), hb = document.getElementById('heat').getBoundingClientRect(), s = getComputedStyle(t);
      const out = { w: Math.round(r.width), h: Math.round(r.height), gridColumn: s.gridColumnStart + '/' + s.gridColumnEnd, heatH: Math.round(hb.height) };
      return out; });
    const pngB = `${PFX}-${dev}-counterfactual.png`;
    await heatEl.screenshot({ path: EVID + '/' + pngB, scale: 'css', animations: 'disabled' });
    out[dev] = { ...m, counterfactualWithoutTodayClass: cf, shots: [pngA, pngB] };
    console.log(dev, 'vw', m.vw, 'dow', m.dow, 'today', JSON.stringify(m.today), '| other', JSON.stringify(m.other));
    console.log('   after-today', JSON.stringify(m.after), '| last', JSON.stringify(m.last), '| heat', JSON.stringify(m.heatSize));
    console.log('   rules matching today cell:', m.matchingRules.join(' ; '));
    console.log('   counterfactual (class removed):', JSON.stringify(cf));
    await d.ctx.close();
  }
  console.log('saved', save(`${PFX}.json`, out));
} finally { await L.close(); }
