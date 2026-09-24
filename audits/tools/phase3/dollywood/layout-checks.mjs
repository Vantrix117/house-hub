// Phase 3 / dollywood: runtime checks of the layout and flow leads (01-leads.md "Dollywood build guide" build-guide items),
// inside the hub shell's viewer on the rig's devices, as Eli with the typical seed. Rerunnable; prints one line per check
// and writes audits/evidence/p3/dollywood/layout-checks.json (+ a few 1x PNGs it cites).
//   node "audits/tools/phase3/dollywood/layout-checks.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const shot = async (d, name) => { const f = path.join(EV, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };
async function open(L, device, extra = {}) {
  const d = await L.device({ device, profile: 'eli', fixedTime: false, ...extra });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
  await sleep(400);
  return { d, f };
}
const rect = (f, sel) => f.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom), vw: innerWidth, vh: innerHeight }; }, sel);
const clickIn = async (d, f, x, y) => { const fr = await (await f.frameElement()).boundingBox(); await d.page.mouse.click(fr.x + x, fr.y + y); };

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  // ---------- iPhone PWA ----------
  {
    const { d, f } = await open(L, 'iphone-pwa');
    // first screen: where the map starts, where the built park sits relative to the peeking sheet
    log('phone.firstScreen', await f.evaluate(() => {
      const mb = document.querySelector('.mapbox').getBoundingClientRect(), b = document.getElementById('build').getBoundingClientRect();
      const park = [...document.querySelectorAll('#official .mk')].map(m => m.getBoundingClientRect()).filter(r => r.width);
      const under = park.filter(r => r.top + r.height / 2 > b.top).length;
      const visible = park.filter(r => r.top >= mb.top && r.bottom <= b.top && r.left >= 0 && r.right <= innerWidth).length;
      const chips = [...document.querySelectorAll('#chips button')].map(c => c.getBoundingClientRect());
      return { mapTop: Math.round(mb.top), sheetTop: Math.round(b.top), vh: innerHeight, markers: park.length, markersUnderSheet: under, markersVisibleBetweenMapTopAndSheet: visible,
        chipRows: new Set(chips.map(c => Math.round(c.top))).size, chipsFullyVisible: chips.filter(c => c.left >= 0 && c.right <= innerWidth).length, chipsTotal: chips.length };
    }));
    log('phone.firstScreen.png', await shot(d, 'phone-first-screen.png'));
    // the build card's "..." menu inside the fixed sheet (overflow:hidden)
    await f.click('#b-menu'); await sleep(300);
    log('phone.progressMenu', await f.evaluate(() => {
      const m = document.getElementById('bmenu').getBoundingClientRect(), b = document.getElementById('build').getBoundingClientRect();
      const vis = Math.max(0, Math.min(m.bottom, b.bottom) - Math.max(m.top, b.top));
      const r = document.getElementById('b-reset').getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { menuTop: Math.round(m.top), menuBottom: Math.round(m.bottom), menuH: Math.round(m.height), sheetTop: Math.round(b.top), visiblePx: Math.round(vis),
        resetCentreHits: hit ? (hit.id || String(hit.className) || hit.tagName) : null, buildOverflow: getComputedStyle(document.getElementById('build')).overflow };
    }));
    log('phone.progressMenu.png', await shot(d, 'phone-progress-menu-clipped.png'));
    await f.evaluate(() => document.body.click()); await sleep(200);
    // "?" help popover
    await f.evaluate(() => document.getElementById('help-btn').scrollIntoView({ block: 'center' })); await sleep(300);
    await f.evaluate(() => document.getElementById('help-btn').click()); await sleep(300);
    log('phone.helpPopover', await rect(f, '#help-pop'));
    log('phone.helpPopover.png', await shot(d, 'phone-help-popover.png'));
    await f.evaluate(() => { document.getElementById('help-btn').click(); window.scrollTo(0, 0); }); await sleep(300);
    // "Next unfinished" from the peeking sheet
    const st0 = await f.evaluate(() => ({ state: document.getElementById('build').dataset.state, title: (document.querySelector('#b-now h3') || {}).textContent }));
    await f.evaluate(() => document.getElementById('b-nextun').click()); await sleep(800);
    const st1 = await f.evaluate(() => { const h = document.querySelector('#b-now h3'), b = document.getElementById('build').getBoundingClientRect(), r = h && h.getBoundingClientRect();
      return { state: document.getElementById('build').dataset.state, title: h && h.textContent, titleTop: r && Math.round(r.top), sheetBottom: Math.round(b.bottom), sheetTop: Math.round(b.top),
        titleVisible: !!r && r.top >= b.top && r.bottom <= b.bottom && r.bottom <= innerHeight, head: document.getElementById('b-sec').textContent + ' · ' + document.getElementById('b-count').textContent }; });
    log('phone.nextUnfinishedAtPeek', { before: st0, after: st1 });
    // Upright then Fit on the phone
    await f.evaluate(() => { const u = document.getElementById('l-upright'); u.checked = true; u.dispatchEvent(new Event('change')); }); await sleep(900);
    await f.evaluate(() => document.getElementById('z-fit').click()); await sleep(900);
    log('phone.uprightFit', await f.evaluate(() => { const s = document.querySelector('svg#map').getBoundingClientRect(); const ms = [...document.querySelectorAll('#official .mk')].map(m => m.getBoundingClientRect()).filter(r => r.width);
      return { ROT: window.ROT, markers: ms.length, offRight: ms.filter(r => r.left > s.right).length, offLeft: ms.filter(r => r.right < s.left).length, markersRightmost: Math.round(Math.max(...ms.map(r => r.right))), mapRight: Math.round(s.right), markersLeftmost: Math.round(Math.min(...ms.map(r => r.left))), mapLeft: Math.round(s.left) }; }));
    log('phone.uprightFit.png', await shot(d, 'phone-upright-fit.png'));
    await f.evaluate(() => { const u = document.getElementById('l-upright'); u.checked = false; u.dispatchEvent(new Event('change')); }); await sleep(600);
    // 3D hint readout on a phone; the readout after leaving 3D on a touch device
    await f.evaluate(() => { window.scrollTo(0, 0); document.getElementById('m-3d').click(); });
    await f.waitForFunction(() => (typeof three !== 'undefined' && three) || /failed/.test(document.getElementById('view3d').textContent), null, { timeout: 90000 }); await sleep(1500);
    log('phone.3dReadout', await f.evaluate(() => { const r = document.getElementById('readout'); return { text: r.textContent, scrollW: r.scrollWidth, clientW: r.clientWidth, truncated: r.scrollWidth > r.clientWidth + 1, coarse: matchMedia('(pointer:coarse)').matches }; }));
    log('phone.3d.png', await shot(d, 'phone-3d.png'));
    // on phones the 2D button is hidden (CSS 333); the 3D button is the only way back
    await f.evaluate(() => document.getElementById('m-3d').click()); await sleep(400);
    log('phone.leave3d', await f.evaluate(() => ({ mode, readout: document.getElementById('readout').textContent, m2dDisplay: getComputedStyle(document.getElementById('m-2d')).display, m3dPressed: document.getElementById('m-3d').getAttribute('aria-pressed') })));
    await f.evaluate(() => setMode('2d')); await sleep(300);
    log('phone.after2d', await f.evaluate(() => ({ mode, readout: document.getElementById('readout').textContent, coarse: matchMedia('(pointer:coarse)').matches })));
    // profile axis labels rendered size
    log('phone.profileAxisLabels', await f.evaluate(() => { const t = [...document.querySelectorAll('#prof text')].map(x => x.getBoundingClientRect().height); return { n: t.length, renderedHeightsPx: [...new Set(t.map(v => +v.toFixed(1)))], svgWidth: Math.round(document.getElementById('prof').getBoundingClientRect().width), fontSizeAttr: (document.querySelector('#prof text') || { getAttribute: () => null }).getAttribute('font-size') }; }));
    await d.close();
  }
  // ---------- iPad portrait ----------
  {
    const { d, f } = await open(L, 'ipad-portrait');
    await f.evaluate(() => document.getElementById('view-btn').click()); await sleep(300);
    log('ipad.viewMenu', await rect(f, '#vmenu'));
    log('ipad.viewMenu.contents', await f.evaluate(() => [...document.querySelectorAll('#vmenu .vrow')].map(r => r.textContent.trim()).concat(document.getElementById('theme-row') ? ['theme-row PRESENT'] : ['theme-row removed'])));
    log('ipad.viewMenu.png', await shot(d, 'ipad-view-menu.png'));
    await f.evaluate(() => document.getElementById('view-btn').click()); await sleep(200);
    // dead north button
    const n0 = await f.evaluate(() => { const b = document.getElementById('lv-north'), r = b.getBoundingClientRect(); return { shown: getComputedStyle(b.parentElement).display !== 'none' && r.width > 0, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), ROT: window.ROT, pressed: b.getAttribute('aria-pressed'), onclick: typeof b.onclick }; });
    await f.click('#lv-north'); await sleep(500);
    const n1 = await f.evaluate(() => ({ ROT: window.ROT, pressed: document.getElementById('lv-north').getAttribute('aria-pressed'), upright: document.getElementById('l-upright').checked }));
    log('ipad.northButton', { before: n0, afterTap: n1 });
    // Upright while "Whole park" is the selected chip
    const u0 = await f.evaluate(() => ({ pressedChip: (document.querySelector('#chips button[aria-pressed=true] .cl') || {}).textContent, curSec, view: view.map(Math.round) }));
    await f.evaluate(() => { const u = document.getElementById('l-upright'); u.checked = true; u.dispatchEvent(new Event('change')); }); await sleep(900);
    const u1 = await f.evaluate(() => ({ view: view.map(Math.round), entranceBox: SEC.entrance.box, allbox: D.layers.allbox, viewWidthOverWholeParkWidth: +(view[2] / FITW).toFixed(2) }));
    log('ipad.uprightWholePark', { before: u0, after: u1 });
    log('ipad.uprightWholePark.png', await shot(d, 'ipad-upright-whole-park.png'));
    await f.evaluate(() => { const u = document.getElementById('l-upright'); u.checked = false; u.dispatchEvent(new Event('change')); }); await sleep(600);
    // Next from the card: does the map come into view?
    await f.evaluate(() => document.getElementById('b-now').scrollIntoView({ block: 'center' })); await sleep(400);
    const s0 = await f.evaluate(() => ({ scrollY: Math.round(scrollY), mapBottom: Math.round(document.querySelector('.mapbox').getBoundingClientRect().bottom), view: view.map(Math.round), step: document.querySelector('#b-now h3').textContent }));
    await f.evaluate(() => document.getElementById('b-next').click()); await sleep(900);
    const s1 = await f.evaluate(() => ({ scrollY: Math.round(scrollY), mapBottom: Math.round(document.querySelector('.mapbox').getBoundingClientRect().bottom), view: view.map(Math.round), step: document.querySelector('#b-now h3').textContent }));
    log('ipad.nextFromCard', { before: s0, after: s1, mapOnScreenAfter: s1.mapBottom > 0, viewChanged: JSON.stringify(s0.view) !== JSON.stringify(s1.view) });
    await f.evaluate(() => document.getElementById('b-prev').click()); await sleep(300);
    // search: a no-match search, then a one-match search
    await f.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
    await f.fill('#q', 'zipline'); await sleep(500);
    log('ipad.searchNoMatch', await f.evaluate(() => { const l = document.getElementById('tab-list'), r = l.getBoundingClientRect(), q = document.getElementById('q').getBoundingClientRect(); return { resultsTop: Math.round(r.top), searchBoxBottom: Math.round(q.bottom), vh: innerHeight, countText: (l.textContent.match(/\d+ of \d+/) || [])[0], emptyMessage: /no (match|result)/i.test(l.textContent) }; }));
    log('ipad.searchNoMatch.png', await shot(d, 'ipad-search-no-match.png'));
    await f.fill('#q', 'thunder'); await sleep(900);
    log('ipad.searchOneMatch', await f.evaluate(() => ({ popOpen: document.getElementById('pop').classList.contains('show'), popTitle: (document.querySelector('#pop h2') || {}).textContent, countText: (document.getElementById('tab-list').textContent.match(/\d+ of \d+/) || [])[0] })));
    await f.evaluate(() => { closePop(); document.getElementById('q').value = ''; document.getElementById('q').dispatchEvent(new Event('input')); }); await sleep(300);
    // height filter
    log('ipad.heightFilter', await f.evaluate(() => { const r = {}; for (const v of ['any', 'none', '36', '42', '48']) { const s = document.getElementById('hf'); s.value = v; s.onchange(); r[v] = (document.getElementById('tab-list').textContent.match(/(\d+) of \d+/) || [])[1]; }
      const s = document.getElementById('hf'); s.value = 'any'; s.onchange(); return { counts: r, listingsWithNoRequirement: OFF.filter(o => !o.height_in).length, listingsWithReqUpTo36: OFF.filter(o => o.height_in && o.height_in <= 36).length }; }));
    // listing card on a marker low in the visible map: does it run off-screen?
    await f.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
    const mk = await f.evaluate(() => { const ms = [...document.querySelectorAll('#official .mk')].map(m => ({ n: m.dataset.pick, r: m.getBoundingClientRect() })).filter(x => x.r.width && x.r.bottom < innerHeight - 10 && x.r.left > 40 && x.r.right < innerWidth - 200); ms.sort((a, b) => b.r.top - a.r.top); const m = ms[0]; return { n: m.n, x: Math.round(m.r.left + m.r.width / 2), y: Math.round(m.r.top + m.r.height / 2) }; });
    await clickIn(d, f, mk.x, mk.y); await sleep(700);
    log('ipad.listingCardLowMarker', { marker: mk, pop: await rect(f, '#pop'), mapbox: await rect(f, '.mapbox'), popScrollH: await f.evaluate(() => document.getElementById('pop').scrollHeight) });
    log('ipad.listingCard.png', await shot(d, 'ipad-listing-card-low-marker.png'));
    await f.evaluate(() => closePop());
    // cross-section: two taps, where is the result?
    await f.evaluate(() => { window.scrollTo(0, 0); document.getElementById('t-sec').click(); }); await sleep(300);
    const mr = await rect(f, 'svg#map');
    await clickIn(d, f, mr.x + mr.w * 0.3, Math.min(mr.y + mr.h * 0.5, 1000)); await sleep(300);
    await clickIn(d, f, mr.x + mr.w * 0.7, Math.min(mr.y + mr.h * 0.55, 1020)); await sleep(700);
    log('ipad.crossSectionResult', await f.evaluate(() => ({ title: document.getElementById('ptitle').textContent, profileTop: Math.round(document.getElementById('prof').getBoundingClientRect().top), vh: innerHeight, hint: document.getElementById('maphint').hidden ? null : document.getElementById('maphint').textContent, readout: document.getElementById('readout').textContent })));
    log('ipad.crossSection.png', await shot(d, 'ipad-cross-section-cut.png'));
    await f.evaluate(() => document.getElementById('t-pan').click());
    // unlisted building card
    log('ipad.unlistedBuilding', await f.evaluate(() => { const b = D.layers.buildings.find(b => !OFF.find(o => o.bld === b.id) && !(b.tags && b.tags.name)); lastPt = [100, 100]; showBuilding(b); const q = document.getElementById('pop-q'); const r = { title: document.querySelector('#pop h2').textContent, searchValue: q ? q.value : null, buttons: [...document.querySelectorAll('#pop .btns a, #pop .btns button')].map(a => a.textContent) }; closePop(); return r; }));
    await d.close();
  }
  // ---------- desktop ----------
  {
    const { d, f } = await open(L, 'desktop');
    log('desktop.buildCard', await rect(f, '#build'));
    log('desktop.coasterCard', await f.evaluate(() => { lastPt = [200, 100]; showCoaster(COAST[0]); const p = document.getElementById('pop').getBoundingClientRect(); return { popH: Math.round(p.height), popTop: Math.round(p.top), popBottom: Math.round(p.bottom), vh: innerHeight, scrollH: document.getElementById('pop').scrollHeight }; }));
    await d.close();
  }
  // ---------- iPad landscape: header ----------
  {
    const { d, f } = await open(L, 'ipad-landscape');
    log('ipadL.header', await f.evaluate(() => { const h = document.querySelector('header').getBoundingClientRect(), a = document.querySelector('header .hero-art').getBoundingClientRect(), t = document.querySelector('header h1').getBoundingClientRect(), s = document.querySelector('header .stats').getBoundingClientRect(); return { headerH: Math.round(h.height), artRight: Math.round(a.right), titleLeft: Math.round(t.left), gapArtToTitle: Math.round(t.left - a.right), statsTop: Math.round(s.top), titleTop: Math.round(t.top) }; }));
    log('ipadL.header.png', await shot(d, 'ipad-landscape-header.png'));
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'layout-checks.json'), JSON.stringify(out, null, 1));
  await L.close();
}
