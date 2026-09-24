// Prayer inside the shell viewer: type scale, tap targets, where the primary controls sit, the + button overlap,
// the Add button under the nav, Pray-now chrome, and glanceability (cap height -> reading distance) on the iPad.
// Devices: iphone-pwa, ipad-portrait, ipad-landscape, desktop; profiles eli (adult, typical) and kiara (kid).
// Glanceability heuristic: a character is comfortably legible when its cap height >= distance / 200
// (so readable distance = cap height x 200); on an 11-inch iPad Air 1 CSS px = 2 device px at 264 ppi = 0.192 mm.
// Cap height is measured from the rendered font with canvas measureText('H').actualBoundingBoxAscent.
// Run: node "audits/tools/phase3/prayer/layout.mjs" -> audits/evidence/p3/prayer/layout.json + PNGs
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const MM = 0.192;
const rows = [];
const measure = f => f.evaluate(() => {
  const R = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom) }; };
  const q = s => document.querySelector(s);
  const cv = document.createElement('canvas').getContext('2d');
  const type = s => { const e = q(s); if (!e) return null; const c = getComputedStyle(e); cv.font = `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`; const cap = cv.measureText('H').actualBoundingBoxAscent;
    return { fs: parseFloat(c.fontSize), fw: c.fontWeight, ff: c.fontFamily.split(',')[0].replace(/"/g, ''), cap: +cap.toFixed(1), ls: c.letterSpacing }; };
  const T = {};
  for (const [k, s] of Object.entries({ h1: '#todayLine', date: '#todayDate', strip: '#todayStrip span', stripNum: '#todayStrip b', title: '#todayList .title', meta: '#todayList .meta', upd: '#todayList .upd', switchBtn: '#listSwitch button', prayNow: '#startPray', nav: 'nav button', cheer: '#cheer', ledger: '.ledger', ledgerB: '.ledger b', kidTitle: '.kid .kt', kidBy: '.kid .kby span:not(.avatar)', kidBtn: '.kid .prayed', kidWho: '.kid .kwho' })) T[k] = type(s);
  const targets = {};
  for (const [k, s] of Object.entries({ mark: '#todayList .mark', switchBtn: '#listSwitch button', prayNow: '#startPray', more: '#moreBtn', fab: '#fab', navBtn: 'nav button', kidPrayed: '.kid .prayed', reviewBtn: '#reviewPrompt button' })) targets[k] = R(q(s));
  return { vw: innerWidth, vh: innerHeight, kind: document.documentElement.dataset.kind || null, type: T, targets, navTop: R(q('nav')) && R(q('nav')).y, wrap: R(q('.wrap')) };
});
try {
  for (const device of ['iphone-pwa', 'ipad-portrait', 'ipad-landscape', 'desktop']) {
    for (const profile of ['eli', 'kiara']) {
      const d = await L.device({ device, profile });
      const f = await d.openApp('prayer', { wait: '#todayLine' });
      await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(700);
      const m = await measure(f);
      const row = { device, profile, ...m };
      if (profile === 'eli') {
        // lead 7: scroll Today to the end; does the + button sit over the last content?
        await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
        row.fabOverLast = await f.evaluate(() => { const fab = document.getElementById('fab').getBoundingClientRect(); const els = [...document.querySelectorAll('#todayAnswered .ledger, #todayList li.row, #anniv .recall')];
          const hit = els.filter(e => { const r = e.getBoundingClientRect(); return r.bottom > fab.top && r.top < fab.bottom && r.right > fab.left && r.left < fab.right; }); return hit.map(e => e.className + ': ' + e.textContent.trim().slice(0, 40)); });
        if (device === 'iphone-pwa') await d.shot(`${OUT}/layout-today-bottom-iphone.png`);
        // lead 8: Add form's main button vs the nav when the form opens
        await f.click('nav [data-go="add"]'); await sleep(400);
        row.add = await f.evaluate(() => { const b = document.getElementById('f-save').getBoundingClientRect(), n = document.querySelector('nav').getBoundingClientRect(); return { saveTop: Math.round(b.top), saveBottom: Math.round(b.bottom), navTop: Math.round(n.top), hiddenUnderNav: b.top >= n.top }; });
        if (device === 'iphone-pwa') await d.shot(`${OUT}/layout-add-iphone.png`);
        // small targets on other screens
        await f.click('nav [data-go="more"]'); await sleep(300);
        row.smallTargets = await f.evaluate(() => { const R = e => { const r = e.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); };
          return { catRename: R(document.querySelector('.catrow button')), catRemove: R(document.querySelectorAll('.catrow button')[1]) }; });
        await f.click('nav [data-go="all"]'); await sleep(300);
        row.smallTargets.copybtn = await f.evaluate(() => { const r = document.querySelector('.copybtn').getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); });
        await f.click('nav [data-go="today"]'); await sleep(300);
        await f.click('#startPray'); await sleep(400);
        row.pray = await f.evaluate(() => { const R = e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
          const big = document.getElementById('prayBig'), c = getComputedStyle(big); return { overlay: R(document.getElementById('pray')), close: R(document.getElementById('prayShut')), next: R(document.getElementById('prayNext')), back: R(document.getElementById('prayBack')), bigFs: parseFloat(c.fontSize), frameTopInPage: null }; });
        row.pray.frameOffsetTop = await d.page.evaluate(() => { const fr = document.querySelector('iframe'); return fr ? Math.round(fr.getBoundingClientRect().top) : null; });
        if (device === 'iphone-pwa') await d.shot(`${OUT}/layout-pray-iphone.png`);
        await f.click('#prayShut'); await sleep(200);
        // kitchen view type
        await f.click('#moreBtn'); await sleep(300); await f.click('[data-more="kitchen"]'); await sleep(400);
        row.kitchen = await f.evaluate(() => { const cv = document.createElement('canvas').getContext('2d'); const t = s => { const e = document.querySelector(s); const c = getComputedStyle(e); cv.font = `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`; return { fs: parseFloat(c.fontSize), cap: +cv.measureText('H').actualBoundingBoxAscent.toFixed(1) }; }; return { h1: t('#kitchen h1'), item: t('#kitchen .k-item'), cat: t('#kitchen .k-cat'), close: (r => Math.round(r.width) + 'x' + Math.round(r.height))(document.getElementById('kitchenShut').getBoundingClientRect()) }; });
        if (device === 'ipad-landscape') await d.shot(`${OUT}/layout-kitchen-ipad-landscape.png`);
      } else if (device === 'ipad-portrait') await d.shot(`${OUT}/layout-kid-ipad.png`);
      if (device.startsWith('ipad')) {
        const dist = t => t && t.cap ? +(t.cap * MM * 200 / 1000).toFixed(2) : null;   // metres
        row.readableAtMetres = Object.fromEntries(Object.entries(m.type).filter(([, t]) => t).map(([k, t]) => [k, dist(t)]));
        if (row.kitchen) { row.readableAtMetres.kitchenItem = dist(row.kitchen.item); row.readableAtMetres.kitchenH1 = dist(row.kitchen.h1); }
      }
      rows.push(row);
      console.log(device, profile, 'vw', m.vw, 'h1', m.type.h1 && m.type.h1.fs, 'title', m.type.title && m.type.title.fs, 'meta', m.type.meta && m.type.meta.fs, 'nav', m.type.nav && m.type.nav.fs,
        '| prayNow', JSON.stringify(m.targets.prayNow), 'fab', JSON.stringify(m.targets.fab), 'navTop', m.navTop, '| fabOver', JSON.stringify(row.fabOverLast), '| add', JSON.stringify(row.add), '| small', JSON.stringify(row.smallTargets), '| pray', JSON.stringify(row.pray), '| kitchen', JSON.stringify(row.kitchen), '| readable m', JSON.stringify(row.readableAtMetres), '| kid', JSON.stringify(m.type.kidTitle), JSON.stringify(m.targets.kidPrayed));
      await d.close();
    }
  }
} catch (e) { console.error(e); rows.push({ error: String(e.stack || e) }); }
finally { fs.writeFileSync(`${OUT}/layout.json`, JSON.stringify(rows, null, 1)); await L.close(); }
