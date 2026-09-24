// Visual measurements of Verses in all five palettes (Hearth, Parchment, Frost, Midnight, Forest), iPhone 430 wide,
// opened standalone (site/apps/verses.html) so the whole document can be measured. State: Eli's second due card
// (John 17:3, which has verse text) revealed, with the stats and queues below. Ratings stay on the device (batch aborted).
// Per theme: every visible text item's computed size/weight/family and its rendered contrast (p10 of the pixels under it,
// text hidden — audits/tools/phase2/VIS/lib-vis.mjs contrastSweep, imported read-only), tap targets, nested radii, glass.
// Themes are applied by setting <html data-theme/data-scheme> the way hub.js does (apps/hub.js:55-61).
import { local, DEMO, sleep } from '../../lib/local.mjs';
import { contrastSweep, install, nearestDT } from '../../phase2/VIS/lib-vis.mjs';
import { save, shot } from './_lib.mjs';
const THEMES = [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['forest', 'dark']];
const L = await local({ variant: 'typical', clock: 'demo' });
const out = { themes: {} };
try {
  for (const [th, scheme] of THEMES) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, mode: scheme });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    await d.page.goto(L.site + '/apps/verses.html', { waitUntil: 'load' });
    await d.page.waitForSelector('#trainer:not([hidden])', { timeout: 10000 });
    await sleep(800);
    const setTheme = () => d.page.evaluate(([t, s]) => { const r = document.documentElement; if (t === 'hearth') delete r.dataset.theme; else r.dataset.theme = t; r.dataset.scheme = s; }, [th, scheme]);
    await setTheme();
    await d.page.click('#show'); await d.page.click('[data-rate="got"]'); await sleep(2600);   // Luke → next card John 17:3 (text), toast gone
    await d.page.click('#show'); await sleep(400);
    await setTheme();
    const shotFile = await shot(d.page, `visual-${th}-iphone.png`);
    const H = await d.page.evaluate(() => document.documentElement.scrollHeight);
    await d.page.setViewportSize({ width: 430, height: Math.min(H, 3000) }); await sleep(300);
    const sweep = await contrastSweep(d.page, null);
    const items = sweep.measured.map(m => ({ text: m.text.slice(0, 40), sel: m.sel.split(' > ').slice(-1)[0], fs: m.fs, fw: m.fw, ff: m.ff, dt: nearestDT(m.fs)[0], p10: m.p10, large: m.large, fail: m.p10 < (m.large ? 3 : 4.5) }));
    await install(d.page);
    const extra = await d.page.evaluate(() => ({
      targets: __vis.targets().filter(t => t.h < 44 || t.w < 44),
      radii: __vis.radii(),
      glass: __vis.glass(),
      accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      showBg: getComputedStyle(document.querySelector('.btn.got')).backgroundColor,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      fonts: [...new Set(['#ref', '#text', '#kick', '.stats b', '.boxes .n', '.queue .rf', '#who'].map(s => { const e = document.querySelector(s); return e ? s + ' → ' + getComputedStyle(e).fontFamily.slice(0, 60) + ' ' + getComputedStyle(e).fontSize + '/' + getComputedStyle(e).fontWeight : s + ' → none'; }))],
    }));
    out.themes[th] = { scheme, shot: shotFile, fails: items.filter(i => i.fail), items, ...extra };
    await d.close();
  }
  const brief = Object.fromEntries(Object.entries(out.themes).map(([k, v]) => [k, { shot: v.shot, n: v.items.length, fails: v.fails.map(f => `${f.text} [${f.sel}] ${f.fs}px p10=${f.p10}`), minP10: Math.min(...v.items.map(i => i.p10)), smallTargets: v.targets, glass: v.glass.map(g => g.sel + ' ' + (g.backdrop || 'no backdrop') + ' ' + g.position), radiiOff: v.radii.filter(r => !r.ok), accent: v.accent, bodyBg: v.bodyBg }]));
  console.log(JSON.stringify(brief, null, 1));
  console.log(JSON.stringify(out.themes.hearth.fonts, null, 1));
  console.log(JSON.stringify(out.themes.hearth.items.map(i => `${i.fs}/${i.fw} ${i.ff} ${i.dt} :: ${i.text}`), null, 1));
  save('visual.json', out);
} finally { await L.close(); }
