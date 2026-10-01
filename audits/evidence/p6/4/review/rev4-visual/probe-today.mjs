// rev4-visual: F260 Today/header at 390/820/1180/1440, light+dark, default + XXL; catch-up line; after Done; sprite icons render
import { local, sleep, rows, put, ready } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
import fs from 'node:fs';
const OUT = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev4-visual/probe4/';
fs.mkdirSync(OUT, { recursive: true });
const ENGINE = process.argv[2] || 'webkit';
const L = await local({ variant: 'typical', clock: 'demo', engine: ENGINE });
const W = { 390: ['iphone-pwa', 844], 820: ['ipad-portrait', 1180], 1180: ['ipad-landscape', 820], 1440: ['desktop', 900] };
const measure = f => f.evaluate(() => {
  const r = s => { const e = document.querySelector(s); if (!e || e.hidden || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
  const syms = [...document.querySelectorAll('svg.sym')].filter(s => s.getClientRects().length && s.getBoundingClientRect().width > 0);
  const symInfo = syms.map(s => { const u = s.querySelector('use'); let bb = null; try { const g = u.getBBox(); bb = [g.width, g.height]; } catch (e) { bb = 'err'; } const cs = getComputedStyle(s); return { id: (u.getAttribute('href') || '').split('#')[1], w: Math.round(s.getBoundingClientRect().width), sw: cs.strokeWidth, stroke: cs.stroke, bb }; });
  return {
    ts: document.documentElement.dataset.textSize || '', hscroll: document.documentElement.scrollWidth > innerWidth + 1,
    sub: r('.hdr .sub') || r('.sub'), sw: r('.switch'), gear: r('#hdrSettings'), today: r('.today'), done: r('#todayDone'), undo: r('#todayUndo'), journal: r('#todayJournal'), catchLine: r('#todayCatch'),
    doneTxt: (document.getElementById('todayDone') || {}).textContent, icons: Object.fromEntries([['gear','#hdrSettings .sym'],['flame','.today .sym'],['done','#todayDone .sym'],['pen','#todayJournal .sym']].map(([n,s]) => { const e = document.querySelector(s); return [n, e && e.getClientRects().length ? Math.round(e.getBoundingClientRect().width) : null]; })), metaLines: (() => { const e = document.getElementById('todayMeta'); return e ? Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight || 20)) : null; })(), metaTxt: (document.getElementById('todayMeta')||{}).textContent, catchTxt: (document.getElementById('todayCatch') || {}).textContent,
    syms: symInfo.length, symsBlank: symInfo.filter(x => !Array.isArray(x.bb) || !x.bb[0]).map(x => x.id), strokeWidths: [...new Set(symInfo.map(x => x.sw))], strokes: [...new Set(symInfo.map(x => x.stroke))],
  };
});
try {
  const r0 = await rows(L, 'eli'); const done = { ...r0['f260.done'] }; delete done['30-2']; await put(L, 'eli', 'f260.done', done);
  for (const w of (process.env.WS ? process.env.WS.split(',').map(Number) : [390, 820, 1180, 1440])) for (const mode of ['light', 'dark']) for (const size of (process.argv[3] ? process.argv[3].split(',') : ['', 'xxl'])) {
    if (size && mode === 'dark' && w > 820) continue;
    const [dev, h] = W[w];
    await put(L, 'eli', 'textSize', size || null, { app: 'hub' }); const d = await L.device({ device: dev, mode, profile: 'eli' });
    await d.page.setViewportSize({ width: w, height: h });
    const f = await d.openApp('f260'); await ready(f); await sleep(800);
    const tag = `${ENGINE}-${w}-${mode}${size ? '-' + size : ''}`;
    const m = await measure(f);
    console.log(tag, JSON.stringify(m));
    await d.page.screenshot({ path: OUT + tag + '.png', scale: 'css' });
    if (mode === 'light') {
      await f.locator('#todayDone').click(); await sleep(1200);
      const m2 = await measure(f); console.log(tag + '-afterDone', JSON.stringify({ icons: m2.icons, done: m2.done, undo: m2.undo, journal: m2.journal, catchLine: m2.catchLine, doneTxt: m2.doneTxt, catchTxt: m2.catchTxt, hscroll: m2.hscroll }));
      await d.page.screenshot({ path: OUT + tag + '-afterDone.png', scale: 'css' });
      await f.locator('#todayUndo').click().catch(() => {}); await sleep(800);
    }
    await d.close();
  }
} finally { await L.close(); }
