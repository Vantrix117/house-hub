// rev4-visual: Prayer Today + kid at 390, XXL and default, light/dark: the actions row, the switch, no horizontal scroll
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
import { put } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
const OUT = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev4-visual/probe2/';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const who of ['eli', 'ezra']) for (const size of ['', 'xxl']) for (const mode of ['light', 'dark']) {
    await put(L, who, 'textSize', size || null, { app: 'hub' });
    const d = await L.device({ device: 'iphone-pwa', mode, profile: who });
    await d.page.setViewportSize({ width: 390, height: 844 });
    const f = await d.openApp('prayer'); await sleep(3500);
    const m = await f.evaluate(() => {
      const r = s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      return { ts: document.documentElement.dataset.textSize || '', hscroll: document.documentElement.scrollWidth > innerWidth + 1, sw: r('#listSwitch'), pray: r('#todayActions .lead') || r('.act.lead'), more: r('#moreBtn'), kidBtn: r('.kid .prayed'), ksay: r('.kid .ksay'), swItem: (() => { const b = document.querySelector('#listSwitch [aria-pressed=true]'); if (!b) return null; const c = getComputedStyle(b), t = getComputedStyle(b.parentElement); return { r: c.borderRadius, h: Math.round(b.getBoundingClientRect().height), track: t.backgroundColor, trackBorder: t.borderTopColor + ' ' + t.borderTopWidth, page: getComputedStyle(document.body).backgroundColor, rows: Math.round(b.parentElement.getBoundingClientRect().height) }; })(), kidIcon: (() => { const s = document.querySelector('.kid .sym'); if (!s) return null; const c = getComputedStyle(s); return { w: Math.round(s.getBoundingClientRect().width), sw: c.strokeWidth }; })() };
    });
    const tag = `prayer-${who}-${size || 'm'}-${mode}`; console.log(tag, JSON.stringify(m));
    await d.page.screenshot({ path: OUT + tag + '.png', scale: 'css' });
    await d.close();
  }
} finally { await L.close(); }
