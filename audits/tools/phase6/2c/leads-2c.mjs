// PATCHED COPY (batch 2c): the TV's Switch now opens a menu (Switch profile / Screen look); this copy taps "Switch profile" after it. Run from the repo root.
// VIS leads: re-checks the visual leads from audits/01-leads.md (Shell + TV) at runtime on the local rig (WebKit).
// Only navigates and taps; the two PIN digits typed on the pad are never submitted. Prints one block per lead and
// writes audits/evidence/p2/VIS/leads.json plus 1× PNG evidence (leads-*.png).
//   node "audits/tools/phase2/VIS/leads.mjs"
import { local, sleep } from '../../lib/local.mjs';
import { SURFACES, save, shotCss } from '../../phase2/VIS/lib-vis.mjs';

const out = {};
const log = (k, v) => { out[k] = v; console.log(`\n## ${k}\n` + JSON.stringify(v)); };
const pxAt = (page, png, pts) => page.evaluate(async ([b64, pts]) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return pts.map(([x, y]) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3)); }, [png.toString('base64'), pts]);

for (const variant of ['typical', 'overflow']) {
  const L = await local({ variant });
  try {
    // L1 picker title unreachable on iPhone (#gate centred flex column + overflow:auto)
    for (const device of ['iphone-pwa', 'iphone-safari', 'ipad-landscape']) {
      const { d } = await SURFACES.picker(L, { device, mode: 'light' });
      const m = await d.page.evaluate(() => { const g = document.querySelector('#gate'); g.scrollTop = 0; const t = document.querySelector('.gate-title').getBoundingClientRect(); const c = document.querySelector('#profiles .pcard').getBoundingClientRect(); return { gateScrollTop: g.scrollTop, gateScrollHeight: g.scrollHeight, gateClient: g.clientHeight, titleTop: Math.round(t.top), titleBottom: Math.round(t.bottom), firstCardTop: Math.round(c.top), elementAtTop: (document.elementFromPoint(innerWidth / 2, 20) || {}).className }; });
      const f = await shotCss(d.page, `leads-picker-${variant}-${device}.png`);
      log(`L1 picker title reachable? (${variant}, ${device})`, { ...m, shot: f });
      await d.close();
    }
    if (variant === 'typical') {
      // L2 kid Home hero art (art/hero/play.svg) visible? diff the hero with the art shown vs hidden
      for (const mode of ['light', 'dark']) {
        const { d } = await SURFACES.home(L, { device: 'ipad-portrait', mode, profile: 'ezra' });
        const box = await d.page.evaluate(() => { const a = document.querySelector('.home-hero .hero-art'); const r = a.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(Math.min(r.height, document.querySelector('.home-hero').getBoundingClientRect().bottom - r.y)), src: (a.querySelector('img') || {}).getAttribute && a.querySelector('img').getAttribute('src'), opacity: getComputedStyle(a).opacity }; });
        const a = await d.page.screenshot({ scale: 'css', clip: box });
        await d.page.evaluate(() => { document.querySelector('.home-hero .hero-art').style.visibility = 'hidden'; });
        const b = await d.page.screenshot({ scale: 'css', clip: box });
        const diff = await d.page.evaluate(async ([x, y]) => { const load = async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; }; const p = await load(x), q = await load(y); let n = 0, sum = 0, max = 0; for (let i = 0; i < p.length; i += 4) { const dd = Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]); sum += dd; if (dd > 30) n++; if (dd > max) max = dd; } return { pixels: p.length / 4, changedOver30: n, meanDiff: +(sum / (p.length / 4)).toFixed(2), maxDiff: max }; }, [a.toString('base64'), b.toString('base64')]);
        await d.page.evaluate(() => { document.querySelector('.home-hero .hero-art').style.visibility = ''; });
        const f = await shotCss(d.page, `leads-kid-hero-${mode}.png`, { clip: { x: 0, y: 0, width: 820, height: 230 } });
        log(`L2 kid hero art visible? (${mode})`, { box, diff, shot: f });
        await d.close();
      }
      // L3 PIN dots colour vs the person's colour (Mae #BC5A38); L4 Create-PIN title (Mea)
      {
        const { d } = await SURFACES.pin(L, { device: 'ipad-portrait', mode: 'light' });
        await d.page.click('#pad [data-d="1"]'); await d.page.click('#pad [data-d="2"]'); await sleep(300);
        const dots = await d.page.evaluate(() => ({ dotOn: getComputedStyle(document.querySelector('.pin-dots i.on')).backgroundColor, avatarRing: getComputedStyle(document.querySelector('.pin-who .avatar')).boxShadow.slice(0, 60), accentOnRoot: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), tintOnCard: getComputedStyle(document.querySelector('.pin-wrap')).getPropertyValue('--tint').trim() }));
        const f = await shotCss(d.page, 'leads-pin-dots-mae.png');
        log('L3 PIN dots colour (Mae, 2 digits typed, not submitted)', { ...dots, shot: f });
        await d.close();
        const r2 = await SURFACES.picker(L, { device: 'iphone-pwa', mode: 'light' });
        await r2.d.page.click('#profiles .pcard[data-id="niece"]'); await r2.d.page.waitForSelector('#pad'); await sleep(400);
        log('L4 Create-PIN pad title (Mea)', { title: await r2.d.page.evaluate(() => document.querySelector('.pin-who h2').textContent), hint: await r2.d.page.evaluate(() => document.querySelector('#pinhint').textContent), nameAnywhere: await r2.d.page.evaluate(() => /Mea/.test(document.querySelector('#gate').innerText)) });
        await r2.d.close();
      }
      // L5 switch-app sheet: icons? colours?
      {
        const { d } = await SURFACES.switchSheet(L, { device: 'ipad-portrait', mode: 'light' });
        log('L5 Switch app sheet content', await d.page.evaluate(() => ({ buttons: [...document.querySelectorAll('.switch-list .btn')].map(b => b.textContent.trim()), withIconOrImage: document.querySelectorAll('.switch-list svg, .switch-list img').length })));
        await shotCss(d.page, 'leads-switch-sheet-ipad.png');
        await d.close();
      }
      // L6 add-guest sheet on iPad landscape: are Cancel / Add guest reachable (does the sheet scroll)?
      {
        const { d } = await SURFACES.guestSheet(L, { device: 'ipad-landscape', mode: 'light' });
        const m = await d.page.evaluate(() => { const s = document.querySelector('.sheet'); const btn = [...s.querySelectorAll('button')].pop().getBoundingClientRect(); return { sheetScrollHeight: s.scrollHeight, sheetClient: s.clientHeight, overflowY: getComputedStyle(s).overflowY, lastButtonBottom: Math.round(btn.bottom), viewport: innerHeight, sheetBg: getComputedStyle(s).backgroundColor, backdrop: getComputedStyle(s).webkitBackdropFilter || getComputedStyle(s).backdropFilter }; });
        const f1 = await shotCss(d.page, 'leads-guest-sheet-ipad-landscape.png');
        await d.page.evaluate(() => { const s = document.querySelector('.sheet'); s.scrollTop = s.scrollHeight; }); await sleep(200);
        const after = await d.page.evaluate(() => { const b = [...document.querySelectorAll('.sheet button')].pop().getBoundingClientRect(); return { lastButtonBottomAfterScroll: Math.round(b.bottom), visible: b.bottom <= innerHeight }; });
        log('L6 Add-a-guest sheet on iPad landscape', { ...m, ...after, shot: f1 });
        await d.close();
      }
      // L7 timer pill over content: can the last content scroll clear of the floating pill? (Elizabeth has a timer running)
      for (const device of ['desktop', 'iphone-pwa', 'ipad-portrait']) {
        const { d } = await SURFACES.home(L, { device, mode: 'light', profile: 'mom' });
        await d.page.waitForSelector('#timer-pill:not([hidden])', { timeout: 5000 }).catch(() => {});
        await d.page.evaluate(() => { const v = document.querySelector('#views'); v.scrollTop = v.scrollHeight; }); await sleep(300);
        const m = await d.page.evaluate(() => { const p = document.querySelector('#timer-pill'); const pr = p.getBoundingClientRect(); const cards = [...document.querySelectorAll('#view-home .two-col > .card')]; const last = cards.map(c => c.getBoundingClientRect()); const tb = document.querySelector('#tabbar').getBoundingClientRect();
          return { pillShown: !p.hidden, pill: { top: Math.round(pr.top), bottom: Math.round(pr.bottom), left: Math.round(pr.left), right: Math.round(pr.right) }, cardBottoms: last.map(r => Math.round(r.bottom)), tabbarTop: Math.round(tb.top), viewport: innerHeight,
            overlapsCardText: [...document.querySelectorAll('#view-home .two-col .rem-text, #view-home .two-col .ftxt')].filter(e => { const r = e.getBoundingClientRect(); return r.bottom > pr.top && r.top < pr.bottom && r.right > pr.left && r.left < pr.right; }).map(e => e.textContent.trim().slice(0, 40)) }; });
        const f = await shotCss(d.page, `leads-timer-pill-bottom-${device}.png`);
        log(`L7 timer pill at the end of Home (${device})`, { ...m, shot: f });
        await d.close();
      }
      // L8 TV: board height vs 1080; gutters vs panes in dark; kicker size
      for (const mode of ['light', 'dark']) {
        const { d } = await SURFACES.tv(L, { mode });
        const m = await d.page.evaluate(() => { const v = document.querySelector('#views'); const rem = [...document.querySelectorAll('#tv #remlist .rem-row')].map(r => Math.round(r.getBoundingClientRect().bottom)); return { viewsScrollHeight: v.scrollHeight, viewsClient: v.clientHeight, remBottoms: rem, kickerPx: getComputedStyle(document.querySelector('#tv-date')).fontSize, faceLabelPx: getComputedStyle(document.querySelector('.tv-face')).fontSize, whenPx: (document.querySelector('.tv-lines .when') ? getComputedStyle(document.querySelector('.tv-lines .when')).fontSize : null), remByPx: (document.querySelector('#tv .rem-by') ? getComputedStyle(document.querySelector('#tv .rem-by')).fontSize : null) }; });
        const png = await d.page.screenshot({ scale: 'css' });
        const px = await pxAt(d.page, png, [[739, 300], [1320, 300], [960, 1075], [300, 300], [1100, 600], [1600, 300]]);
        const Lm = c => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return +(0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])).toFixed(3); };
        log(`L8 TV board (${mode})`, { ...m, gutterPx: [px[0], px[1], px[2]].map(c => ({ rgb: c, L: Lm(c) })), panePx: [px[3], px[4], px[5]].map(c => ({ rgb: c, L: Lm(c) })) });
        await d.close();
      }
      // L9 TV picker after Switch: card and label sizes at 1920×1080
      {
        const { d } = await SURFACES.tv(L, { mode: 'light' });
        await d.page.click('#kiosk-switch'); await d.page.click('.sheet [data-act="switch"]'); await d.page.waitForSelector('#profiles .pcard:not(.skeleton)'); await sleep(600);
        log('L9 picker on the TV after Switch', await d.page.evaluate(() => { const c = document.querySelector('#profiles .pcard').getBoundingClientRect(); return { card: [Math.round(c.width), Math.round(c.height)], nameFont: getComputedStyle(document.querySelector('#profiles .pcard')).fontSize, subFont: getComputedStyle(document.querySelector('#profiles .psub')).fontSize, dataKind: document.documentElement.dataset.kind || null, cards: document.querySelectorAll('#profiles .pcard').length }; }));
        await shotCss(d.page, 'leads-tv-picker.png');
        await d.close();
      }
    }
    if (variant === 'overflow') {
      // L10 kids card chips / TV overflow / Me hero long names
      for (const device of ['desktop', 'ipad-portrait', 'iphone-pwa']) {
        const { d } = await SURFACES.home(L, { device, mode: 'light' });
        const m = await d.page.evaluate(() => [...document.querySelectorAll('.kid-chip')].map(k => { const card = k.closest('.card').getBoundingClientRect(); const r = k.getBoundingClientRect(); return { text: k.textContent.trim(), chipRight: Math.round(r.right), cardRight: Math.round(card.right), cut: r.right > card.right - 1 }; }));
        await d.page.evaluate(() => { const k = document.querySelector('.kids-card'); if (k) document.querySelector('#views').scrollTop += k.getBoundingClientRect().top - 40; }); await sleep(200);
        const f = await shotCss(d.page, `leads-kids-card-overflow-${device}.png`);
        log(`L10 Kids card chips, long names (${device})`, { chips: m, shot: f });
        await d.close();
      }
      {
        const { d } = await SURFACES.tv(L, { mode: 'light' });
        const m = await d.page.evaluate(() => { const v = document.querySelector('#views'); const rows = [...document.querySelectorAll('#tv #remlist .rem-row')]; return { viewsScrollHeight: v.scrollHeight, viewsClient: v.clientHeight, hiddenPx: v.scrollHeight - v.clientHeight, reminders: rows.length, remindersOnScreen: rows.filter(r => r.getBoundingClientRect().bottom <= innerHeight).length, feedTop: Math.round(document.querySelector('#tv .tv-feed').getBoundingClientRect().top), scrollIndicator: getComputedStyle(v).overflowY }; });
        log('L11 TV board overflow (1920×1080)', { ...m, shot: await shotCss(d.page, 'leads-tv-overflow.png') });
        await d.close();
      }
      for (const [profile, tag] of [['ezra', 'kid'], ['eli', 'adult']]) {
        const { d } = await SURFACES.me(L, { device: 'iphone-pwa', mode: 'dark', profile });
        const m = await d.page.evaluate(() => { const h = document.querySelector('.me-hero'); const t = h.querySelector('.hero-title').getBoundingClientRect(); const s = h.querySelector('#switch').getBoundingClientRect(); return { name: h.querySelector('.hero-title').textContent, titleRight: Math.round(t.right), switchLeft: Math.round(s.left), overlap: t.right > s.left + 1 && t.bottom > s.top && t.top < s.bottom, titleFont: getComputedStyle(h.querySelector('.hero-title')).fontSize }; });
        log(`L12 Me hero long name (${tag}, iPhone)`, { ...m, shot: await shotCss(d.page, `leads-me-hero-overflow-${tag}.png`, { clip: { x: 0, y: 0, width: 430, height: 260 } }) });
        await d.close();
      }
    }
  } finally { await L.close(); }
}
console.log('\nwrote', save('leads.json', out));
