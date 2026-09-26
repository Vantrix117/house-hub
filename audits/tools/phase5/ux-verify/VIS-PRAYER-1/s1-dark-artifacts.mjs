// Skeptic s1 for VIS-PRAYER-1: are the dark-palette failures (done row title 3.24-3.27, nav "Record" 3.40-3.56) caused
// by the text colours, or by what sits inside the sampled box? Opens Prayer standalone at iPhone PWA as Eli in
// Midnight/Forest, runs the same Phase 2 sampler (contrastSweep) as-is, then again with the + (FAB) hidden, and reads the
// nav's own paint under each label. Also reruns Hearth to reproduce the light-palette numbers.
// Run: node audits/tools/phase5/ux-verify/VIS-PRAYER-1/s1-dark-artifacts.mjs -> audits/evidence/p5/ux-verify/VIS-PRAYER-1/s1/dark-artifacts.json
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
import { contrastSweep } from '../../../phase2/VIS/lib-vis.mjs';
const OUT = 'audits/evidence/p5/ux-verify/VIS-PRAYER-1/s1';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const pick = r => r.measured.filter(m => /job interview|Ezra and Kiara|^Record$|^Today$|^List$|^Add$|^More$|Answered recently|September 19|shared|not prayed|^Mine$|^Family$/.test(m.text))
  .map(m => ({ text: m.text.slice(0, 40), sel: m.sel, fs: m.fs, p10: m.p10, med: m.med }));
try {
  for (const [theme, mode] of [['midnight', 'dark'], ['forest', 'dark'], ['hearth', 'light']]) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', mode, localStorage: { 'hub.theme': JSON.stringify(theme) } });
    await d.page.goto(L.site + '/apps/prayer.html', { waitUntil: 'load' });
    await d.page.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 });
    await sleep(600);
    const geo = await d.page.evaluate(() => {
      const r = e => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
      const t = [...document.querySelectorAll('li.row.done .title')].map(e => {
        const range = document.createRange(); range.selectNodeContents(e); const rr = range.getBoundingClientRect();
        return { text: e.textContent.slice(0, 40), box: r(e), glyphs: [Math.round(rr.left), Math.round(rr.top), Math.round(rr.right), Math.round(rr.bottom)] };
      });
      return { fab: r(document.getElementById('fab')), doneTitles: t, sheenX: getComputedStyle(document.querySelector('nav')).getPropertyValue('--sheen-x'),
        navLabels: [...document.querySelectorAll('nav button')].map(b => ({ t: b.textContent.trim(), box: r(b), color: getComputedStyle(b).color })) };
    });
    const withFab = pick(await contrastSweep(d.page, 'html'));
    await d.page.addStyleTag({ content: '#fab{visibility:hidden!important}' }); await sleep(200);
    const noFab = pick(await contrastSweep(d.page, 'html'));
    // nav alone: hide the page content under it, keep the nav's own layers
    await d.page.addStyleTag({ content: '.wrap{visibility:hidden!important}' }); await sleep(200);
    const navOnly = pick(await contrastSweep(d.page, 'html')).filter(x => x.sel.startsWith('nav'));
    await d.page.screenshot({ path: `${OUT}/${theme}-today.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    res[theme] = { geo, withFab, noFab, navOnly };
    console.log(theme, JSON.stringify(res[theme]).slice(0, 3000));
    await d.close();
  }
} catch (e) { res.error = String(e.stack || e); console.error(e); }
finally { fs.writeFileSync(`${OUT}/dark-artifacts.json`, JSON.stringify(res, null, 1)); await L.close(); }
