// Phase 3 / dollywood — skeptic #2 for "progress-menu-clipped-phone": is the build card's "…" menu (Export / Import /
// Reset) usable on a phone in ANY sheet state (peek / half / full), on both phone profiles of the rig?
// For each state: open the menu, measure how much of it lies inside the sheet (#build, overflow:hidden), what a tap at
// each item's centre hits, and whether a real mouse tap at Reset's centre raises its confirm() (dismissed: no data change).
//   node "audits/tools/phase3/dollywood/verify-progress-menu-clipped-phone-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const device of ['iphone-pwa', 'iphone-safari']) {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    const dialogs = [];
    d.page.on('dialog', async dl => { dialogs.push(dl.message()); await dl.dismiss(); });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
    await sleep(400);
    const fr = await (await f.frameElement()).boundingBox();
    for (const st of ['peek', 'half', 'full']) {
      await f.evaluate(s => { document.getElementById('build').dataset.state = s; }, st); await sleep(500);
      await f.evaluate(() => document.getElementById('b-menu').click()); await sleep(300);
      const m = await f.evaluate(() => {
        const R = e => { const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }; };
        const b = document.getElementById('build'), menu = document.getElementById('bmenu');
        const br = b.getBoundingClientRect(), mr = menu.getBoundingClientRect();
        const items = ['b-export', 'b-import', 'b-reset'].map(id => { const r = document.getElementById(id).getBoundingClientRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const h = document.elementFromPoint(cx, cy);
          return { id, centreY: Math.round(cy), insideSheet: cy >= br.top && cy <= br.bottom, centreHits: h ? (h.id || h.tagName + '.' + (typeof h.className === 'string' ? h.className : h.className.baseVal)) : null }; });
        return { vw: innerWidth, vh: innerHeight, mediaPhone: matchMedia('(max-width:699px)').matches, sheet: R(b), sheetOverflow: getComputedStyle(b).overflow, menuBtn: R(document.getElementById('b-menu')),
          menu: R(menu), menuH: Math.round(mr.height), visiblePx: Math.round(Math.max(0, Math.min(mr.bottom, br.bottom) - Math.max(mr.top, br.top))), items };
      });
      // real tap at Reset's computed centre (page coords)
      const before = dialogs.length;
      const rc = m.items.find(i => i.id === 'b-reset');
      const rx = await f.evaluate(() => { const r = document.getElementById('b-reset').getBoundingClientRect(); return r.left + r.width / 2; });
      await d.page.mouse.click(fr.x + rx, fr.y + rc.centreY); await sleep(400);
      m.resetTapRaisedConfirm = dialogs.length > before;
      m.menuStillOpenAfterTap = await f.evaluate(() => !document.getElementById('bmenu').hidden);
      out[`${device}.${st}`] = m;
      console.log(device, st, JSON.stringify({ sheetTop: m.sheet.t, menuTop: m.menu.t, menuBottom: m.menu.b, menuH: m.menuH, visiblePx: m.visiblePx, items: m.items.map(i => `${i.id}:${i.insideSheet ? 'in' : 'OUT'}->${i.centreHits}`), resetTapRaisedConfirm: m.resetTapRaisedConfirm }));
      if (device === 'iphone-pwa' && st !== 'peek') {
        if (m.menuStillOpenAfterTap === false) { await f.evaluate(() => document.getElementById('b-menu').click()); await sleep(300); }
        await d.page.screenshot({ path: path.join(EV, `verify-progress-menu-clipped-phone-2-${st}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
      }
      await f.evaluate(() => { const mm = document.getElementById('bmenu'); if (!mm.hidden) document.body.click(); }); await sleep(200);
    }
    out[`${device}.dialogs`] = dialogs;
  }
  fs.writeFileSync(path.join(EV, 'verify-progress-menu-clipped-phone-2.json'), JSON.stringify(out, null, 1));
  console.log('wrote audits/evidence/p3/dollywood/verify-progress-menu-clipped-phone-2.json');
} finally { await L.close(); }
