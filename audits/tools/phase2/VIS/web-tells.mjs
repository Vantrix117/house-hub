// VIS web tells: the constitution's "Native feel — eliminate every web tell" list, checked one by one in the shell on the
// local rig (typical household). Prints one block per tell and writes audits/evidence/p2/VIS/web-tells.json.
//   node "audits/tools/phase2/VIS/web-tells.mjs"
// Every dialog that appears is DISMISSED (Cancel), so nothing is written. Frames for the white-flash test are saved as
// small 1× PNGs under audits/evidence/p2/VIS/flash-*.png.
import { local, sleep } from '../../lib/local.mjs';
import { SURFACES, install, save, shotCss } from './lib-vis.mjs';

const out = {};
const log = (k, v) => { out[k] = v; console.log(`\n## ${k}\n` + JSON.stringify(v, null, 1).slice(0, 2400)); };
const CHROME = ['#tabbar .tab', '#grid .tile', '#profiles .pcard', '.pin-pad .btn', '.kid-cta', '#theme .theme-card', '#pill button', '.view-title h1', '.hero-title', '.gbig', '.card h2', '.btn'];

async function styleOf(page, sels, props) {
  return page.evaluate(([sels, props]) => sels.map(s => { const el = document.querySelector(s); if (!el) return { sel: s, found: false };
    const cs = getComputedStyle(el); const o = { sel: s }; for (const p of props) o[p] = cs.getPropertyValue(p) || cs[p.replace(/-([a-z])/g, (m, c) => c.toUpperCase())] || '(unsupported)'; return o; }), [sels, props]);
}

for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  try {
    if (engine === 'webkit') {
      // 1. tap highlight + 8. tap delay (touch-action) on the chrome, Home/Apps/Me, iPad
      let { d } = await SURFACES.home(L, { device: 'ipad-portrait', mode: 'light' });
      const page = d.page;
      log('1-tap-highlight+8-touch-action (home, ipad)', await page.evaluate(() => {
        const els = [...document.querySelectorAll('button, [data-open], .tile, .card, a, input')];
        const hl = {}; const ta = {};
        for (const e of els) { const cs = getComputedStyle(e); const h = cs.webkitTapHighlightColor || cs.getPropertyValue('-webkit-tap-highlight-color') || '(unsupported)'; hl[h] = (hl[h] || 0) + 1; ta[cs.touchAction] = (ta[cs.touchAction] || 0) + 1; }
        const vp = document.querySelector('meta[name=viewport]').content;
        return { elements: els.length, tapHighlightValues: hl, touchActionValues: ta, bodyTouchAction: getComputedStyle(document.body).touchAction, viewport: vp };
      }));
      // 2. long-press callout / selection on chrome
      await d.page.click('#tabbar .tab[data-tab="apps"]'); await sleep(500);
      const sel1 = await styleOf(page, CHROME, ['user-select', '-webkit-user-select', '-webkit-touch-callout']);
      await d.page.click('#tabbar .tab[data-tab="home"]'); await sleep(500);
      const sel2 = await styleOf(page, CHROME, ['user-select', '-webkit-user-select', '-webkit-touch-callout']);
      const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].slice(0, 12).map(i => ({ src: i.getAttribute('src').slice(0, 40), draggable: i.draggable, userDrag: getComputedStyle(i).webkitUserDrag || '(unsupported)', callout: getComputedStyle(i).webkitTouchCallout || '(unsupported)' })));
      // selection by double-click on chrome labels (a desktop/iPad-with-trackpad proxy for long-press select)
      const dbl = {};
      for (const s of ['.hero-title', '.card h2', '.gbig', '#tabbar .tab[data-tab="chat"]']) { await page.evaluate(() => getSelection().removeAllRanges()); await page.dblclick(s).catch(() => {}); dbl[s] = await page.evaluate(() => getSelection().toString().trim()); await page.evaluate(() => getSelection().removeAllRanges()); }
      log('2-long-press-select-callout', { computed: [...sel2, ...sel1.filter(x => x.found && !sel2.find(y => y.sel === x.sel && y.found))], images: imgs, selectedByDoubleClick: dbl });
      await shotCss(page, 'tell-selection-home-ipad.png');
      // 4. focus rings: tap vs keyboard
      await page.evaluate(() => { document.querySelector('#views').scrollTop = 0; });
      await page.tap('.gcard .btn[data-open="f260"]').catch(() => {});
      await sleep(300);
      const afterTap = await page.evaluate(() => { const a = document.activeElement; return { active: a && (a.id || a.className || a.tagName), focusVisible: a && a.matches(':focus-visible'), boxShadow: a && getComputedStyle(a).boxShadow.slice(0, 80) }; });
      await d.close();
      // keyboard focus on desktop: does the ring show on .btn, .tile, .tab, .pcard, .switch?
      ({ d } = await SURFACES.home(L, { device: 'desktop', mode: 'light' }));
      const kb = await d.page.evaluate(() => {
        const r = [];
        for (const s of ['.gcard .btn', '#tabbar .tab', '#remtext', '#feed-refresh', '#remform button']) {
          const el = document.querySelector(s); if (!el) { r.push({ sel: s, found: false }); continue; }
          const before = getComputedStyle(el).boxShadow + ' | outline ' + getComputedStyle(el).outlineStyle;
          el.focus({ focusVisible: true }); const fv = el.matches(':focus-visible');
          const after = getComputedStyle(el).boxShadow + ' | outline ' + getComputedStyle(el).outlineStyle;
          r.push({ sel: s, focusVisible: fv, ringChanged: before !== after, before: before.slice(0, 90), after: after.slice(0, 90) }); el.blur();
        }
        return r;
      });
      // real keyboard: Tab to the first control and read what is focused and whether it looks different
      await d.page.keyboard.press('Tab'); await sleep(150);
      const tab1 = await d.page.evaluate(() => { const a = document.activeElement; return { active: a && (a.id || (a.className + '').slice(0, 40) || a.tagName), focusVisible: a && a.matches(':focus-visible'), boxShadow: a && getComputedStyle(a).boxShadow.slice(0, 120), outline: a && getComputedStyle(a).outlineStyle }; });
      await shotCss(d.page, 'tell-keyboard-focus-desktop.png', { clip: { x: 0, y: 0, width: 1440, height: 300 } });
      log('4-focus-rings', { ipadTapOnOpenF260: afterTap, desktopProgrammaticFocusVisible: kb, desktopFirstTab: tab1 });
      await d.close();
      // 5. links, 3. default form controls, 12. native dialogs — Me (admin) + the add-guest sheet + edit profile sheet
      ({ d } = await SURFACES.me(L, { device: 'iphone-pwa', mode: 'light' }));
      const anchors = await d.page.evaluate(() => [...document.querySelectorAll('a')].map(a => ({ text: a.textContent.trim().slice(0, 30), color: getComputedStyle(a).color, deco: getComputedStyle(a).textDecorationLine })));
      const dialogs = [];
      d.page.on('dialog', async dg => { dialogs.push({ type: dg.type(), message: dg.message().slice(0, 120) }); await dg.dismiss(); });
      await d.page.click('#forget').catch(e => dialogs.push({ error: e.message.slice(0, 80) })); await sleep(400);
      await d.page.click('#album-grid [data-del]').catch(() => {}); await sleep(400);
      await d.page.click('#rewards-body button:not([disabled])').catch(() => {}); await sleep(400);
      const controls = async () => d.page.evaluate(() => [...document.querySelectorAll('.sheet input:not([type=hidden]), .sheet select, .sheet textarea, .sheet button, #view-me input:not([type=file]), #view-me select')].filter(e => e.offsetParent || e.getClientRects().length).map(e => ({ tag: e.tagName.toLowerCase(), type: e.type, id: e.id, cls: (e.className + '').slice(0, 40), appearance: getComputedStyle(e).appearance || getComputedStyle(e).webkitAppearance, h: Math.round(e.getBoundingClientRect().height) })));
      await d.page.click('#guest-add'); await d.page.waitForSelector('.sheet'); await sleep(500);
      const guestCtl = await controls();
      await shotCss(d.page, 'tell-controls-guest-sheet-iphone.png');
      await d.page.keyboard.press('Escape'); await sleep(300);
      // admin → Edit (the only <select> in the shell)
      await d.page.click('#admin-body [data-edit=\"ezra\"]').catch(() => {}); await sleep(600);
      const editCtl = await controls();
      await shotCss(d.page, 'tell-controls-edit-sheet-iphone.png');
      log('5-links', { anchorsOnMe: anchors.length, anchors });
      log('3-default-form-controls', { guestSheet: guestCtl, editSheet: editCtl });
      log('12-native-dialogs', dialogs);
      await d.close();
      // 7. overscroll + 9. scrollbars
      ({ d } = await SURFACES.home(L, { device: 'desktop', mode: 'light' }));
      const os1 = await d.page.evaluate(() => { const v = document.querySelector('#views'); const cs = x => getComputedStyle(x); return { htmlOverscroll: cs(document.documentElement).overscrollBehavior, bodyOverscroll: cs(document.body).overscrollBehavior, viewsOverscroll: cs(v).overscrollBehavior, bodyPosition: cs(document.body).position, htmlBg: cs(document.documentElement).backgroundColor, bodyBg: cs(document.body).backgroundColor, viewsBg: cs(v).backgroundColor, viewsScrollbarPx: v.offsetWidth - v.clientWidth, scrollbarStyling: [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => /scrollbar/.test(r.cssText)); } catch { return false; } }) }; });
      log('7-overscroll+9-scrollbars (desktop webkit on Windows)', os1);
      await d.close();
    }
    // 6. white flash: dark OS, cold load (no service worker), frames sampled at the centre of the screen
    for (const delayCss of [0, 1200]) {
      const d = await L.device({ device: 'ipad-portrait', mode: 'dark', profile: 'eli' });
      if (delayCss) await d.ctx.route(/apps\/design\.css/, async r => { await sleep(delayCss); await r.continue(); });
      const frames = [];
      const t0 = Date.now();
      await d.page.goto(L.site + '/index.html#home', { waitUntil: 'commit' });
      for (let i = 0; i < 25; i++) {
        const png = await d.page.screenshot({ scale: 'css' }).catch(() => null);
        if (!png) { await sleep(40); continue; }
        const px = await d.page.evaluate(async b64 => { try { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return [...g.getImageData(Math.floor(im.width / 2), Math.floor(im.height * 0.6), 1, 1).data].slice(0, 3); } catch (e) { return 'n/a'; } }, png.toString('base64')).catch(() => 'n/a');
        const shellUp = await d.page.evaluate(() => !!document.querySelector('#shell:not([hidden])')).catch(() => false);
        frames.push({ ms: Date.now() - t0, px, shellUp });
        if (i === 1 && delayCss) { const fs = await import('node:fs'); fs.writeFileSync(`audits/evidence/p2/VIS/flash-${engine}-css-delayed.png`, png); }
        if (shellUp && frames.filter(f => f.shellUp).length > 2) break;
      }
      log(`6-white-flash (${engine}, dark OS, design.css delayed ${delayCss} ms)`, frames);
      await d.close();
    }
    // 6b. opening an app in the viewer in dark mode: does the iframe paint white before the app's CSS arrives?
    {
      const d = await L.device({ device: 'ipad-portrait', mode: 'dark', profile: 'eli' });
      await d.goto('#apps'); await d.page.waitForSelector('#grid .tile'); await sleep(800);
      await d.ctx.route(/apps\/(design\.css|hub\.js)(\?.*)?$/, async (r) => { if (r.request().frame() !== d.page.mainFrame()) await sleep(1500); await r.continue(); });
      await d.page.click('#grid .tile[data-id="tally"]');
      await sleep(700);
      const png = await d.page.screenshot({ scale: 'css' });
      const fs = await import('node:fs'); fs.writeFileSync(`audits/evidence/p2/VIS/flash-${engine}-viewer-tally-dark.png`, png);
      const px = await d.page.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return [...g.getImageData(Math.floor(im.width / 2), Math.floor(im.height * 0.7), 1, 1).data].slice(0, 3); }, png.toString('base64'));
      log(`6b-viewer-open-flash (${engine}, dark, app css delayed 1500 ms, frame at 700 ms)`, { centrePixel: px, file: `audits/evidence/p2/VIS/flash-${engine}-viewer-tally-dark.png` });
      await d.close();
    }
  } finally { await L.close(); }
}
console.log('\nwrote', save('web-tells.json', out));
