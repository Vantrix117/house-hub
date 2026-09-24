// Rendered contrast of every Tally text in every palette for every household colour, plus the fill of − and + against
// the wash beside them (is − visibly a button, and does it look disabled next to +?). Tally opened standalone
// (apps/tally.html) on the iPad portrait, signed in; the theme comes from the device mirror hub.theme (the standalone
// page syncs only the tally channel, so hub.js adoptTheme() cannot override it: hub.js:85-94).
// Themes: system on a light OS (Hearth), system on a dark OS (Midnight), parchment, frost, midnight, forest, and
// hearth chosen on a dark OS (the P2-VIS-03 path). Also records --accent and the data-scheme per case.
// Run: node "audits/tools/phase3/tally/themes.mjs"  -> audits/evidence/p3/tally/themes.json (+ PNG per theme for eli)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
import { contrastSweep } from '../../phase2/VIS/lib-vis.mjs';
const OUT = 'audits/evidence/p3/tally';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const CASES = [['system', 'light'], ['system', 'dark'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'light'], ['forest', 'light'], ['hearth', 'dark']];
const PROFILES = (process.argv[2] || 'eli,christian,mom,dad,niece,ezra,kiara').split(',');
const rows = [];
try {
  for (const [theme, mode] of CASES) {
    for (const profile of PROFILES) {
      const d = await L.device({ device: 'ipad-portrait', profile, mode, localStorage: theme === 'system' ? null : { 'hub.theme': JSON.stringify(theme) } });
      await d.page.goto(L.site + '/apps/tally.html', { waitUntil: 'load' });
      await d.page.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
      await sleep(300);
      const { measured } = await contrastSweep(d.page, null);
      const pick = s => { const m = measured.find(x => x.sel.includes(s)); return m ? { p10: m.p10, med: m.med, fs: m.fs } : null; };
      // non-text: centre of − / + vs the wash just outside the row
      const png = await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
      const fill = await d.page.evaluate(async b64 => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const px = (x, y) => [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3);
        const mi = document.getElementById('minus').getBoundingClientRect(), pl = document.getElementById('plus').getBoundingClientRect();
        const minus = px(mi.x + mi.width * 0.5, mi.y + mi.height * 0.78), plus = px(pl.x + pl.width * 0.5, pl.y + pl.height * 0.78), wash = px(mi.x - 30, mi.y + mi.height / 2);
        return { minus, plus, wash, minusVsWash: +__vis.ratio(minus, wash).toFixed(2), plusVsWash: +__vis.ratio(plus, wash).toFixed(2), minusVsPlus: +__vis.ratio(minus, plus).toFixed(2) };
      }, png.toString('base64'));
      const meta = await d.page.evaluate(() => ({ dataTheme: document.documentElement.dataset.theme || null, scheme: document.documentElement.dataset.scheme, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), bodyBg: getComputedStyle(document.body).backgroundColor, bodyColor: getComputedStyle(document.body).color }));
      const row = { theme, os: mode, profile, ...meta, count: pick('#n'), who: pick('#who'), reset: pick('#reset'), plus: pick('#plus'), minus: pick('#minus'), fill };
      rows.push(row);
      console.log(theme, mode, profile, meta.scheme, meta.accent, 'count', row.count && row.count.p10, 'who', row.who && row.who.p10, 'reset', row.reset && row.reset.p10, '+', row.plus && row.plus.p10, '−', row.minus && row.minus.p10, '| −/wash', fill.minusVsWash, '+/wash', fill.plusVsWash);
      if (profile === 'eli' || (profile === 'ezra' && theme === 'system')) fs.writeFileSync(`${OUT}/theme-${theme}-${mode}os-${profile}.png`, png);
      await d.close();
    }
  }
} finally {
  fs.writeFileSync(`${OUT}/themes.json`, JSON.stringify(rows, null, 1));
  await L.close();
}
