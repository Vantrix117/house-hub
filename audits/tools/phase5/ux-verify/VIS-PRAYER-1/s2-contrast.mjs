// Skeptic s2, VIS-PRAYER-1: rerun Prayer's rendered contrast on Today (Mine + Family) and Record in Hearth, Midnight and Forest,
// and for every failing item record the line rects, the background at p10, and what element sits at that pixel
// (to tell a real fail from a sample that caught the FAB / nav / a neighbouring control).
// Run: node audits/tools/phase5/ux-verify/VIS-PRAYER-1/s2-contrast.mjs
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
import { contrastSweep } from '../../../phase2/VIS/lib-vis.mjs';
const OUT = 'audits/evidence/p5/ux-verify/VIS-PRAYER-1/s2';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const THEMES = [['hearth', 'light'], ['midnight', 'dark'], ['forest', 'dark']];
const out = [];
try {
  for (const [theme, mode] of THEMES) {
    for (const screen of ['today', 'family', 'record']) {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', mode, localStorage: { 'hub.theme': JSON.stringify(theme) } });
      await d.page.goto(L.site + '/apps/prayer.html', { waitUntil: 'load' });
      await d.page.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 });
      await sleep(500);
      if (screen === 'family') { await d.page.click('#listSwitch [data-list="shared"]'); await sleep(500); }
      if (screen === 'record') { await d.page.click('nav [data-go="answered"]'); await sleep(500); }
      const r = await contrastSweep(d.page, 'html');
      const fails = r.measured.filter(m => m.p10 < (m.large ? 3 : 4.5));
      const detail = [];
      for (const f of fails) {
        const info = await d.page.evaluate(id => {
          const el = document.querySelector('[data-vis-id="' + id + '"]'); if (!el) return null;
          const rects = []; for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) { const rg = document.createRange(); rg.selectNodeContents(n); rects.push(...[...rg.getClientRects()].map(q => ({ x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.width), h: Math.round(q.height) }))); }
          const hits = rects.map(q => { const pts = [[q.x + 4, q.y + q.h / 2], [q.x + q.w / 2, q.y + q.h / 2], [q.x + q.w - 4, q.y + q.h / 2]];
            return pts.map(([x, y]) => { const h = document.elementFromPoint(x, y); return h ? (h.id ? '#' + h.id : h.tagName.toLowerCase() + '.' + [...h.classList].join('.')) + (h === el || el.contains(h) ? '(self)' : '') : null; }); });
          const fab = document.getElementById('fab'), nav = document.querySelector('nav');
          const R = e => e ? (b => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }))(e.getBoundingClientRect()) : null;
          return { color: getComputedStyle(el).color, rects, hits, fab: R(fab), nav: R(nav), vh: innerHeight, scrollY: scrollY };
        }, f.id);
        detail.push({ text: f.text, sel: f.sel, fs: f.fs, fw: f.fw, p10: f.p10, med: f.med, bgAtP10: f.bgAtP10, bgMed: f.bgMed, ...info });
      }
      await d.page.screenshot({ path: `${OUT}/${theme}-${screen}.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
      out.push({ theme, mode, screen, measured: r.measured.length, fails: detail });
      console.log(theme, screen, fails.length, detail.map(x => `"${x.text.slice(0, 26)}" ${x.fs}px p10 ${x.p10} med ${x.med} bgP10 ${x.bgAtP10} bgMed ${x.bgMed} rects ${JSON.stringify(x.rects)} hits ${JSON.stringify(x.hits)}`).join('\n   '));
      await d.close();
    }
  }
} catch (e) { console.error(e); out.push({ error: String(e.stack || e) }); }
finally { fs.writeFileSync(`${OUT}/contrast.json`, JSON.stringify(out, null, 1)); await L.close(); }
