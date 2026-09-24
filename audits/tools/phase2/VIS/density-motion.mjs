// VIS density + motion: (1) Apps-grid and Home density per device (columns, tile/icon/label size, how much of Home is
// above the fold); (2) the press/transition timings actually computed on the main controls; (3) whether the shell
// boots at all with Reduce Motion on (WebKit; Phase 0 saw a blank page in Chromium).
//   node "audits/tools/phase2/VIS/density-motion.mjs"      → audits/evidence/p2/VIS/density-motion.json
import { local, sleep } from '../../lib/local.mjs';
import { SURFACES, save, shotCss } from './lib-vis.mjs';

const out = { density: {}, motion: null, reducedMotion: {} };
const L = await local({ variant: 'typical' });
try {
  for (const [device, profile] of [['iphone-pwa', 'eli'], ['ipad-portrait', 'eli'], ['ipad-landscape', 'eli'], ['desktop', 'eli'], ['iphone-pwa', 'ezra'], ['ipad-portrait', 'ezra']]) {
    const { d } = await SURFACES.home(L, { device, mode: 'light', profile });
    const home = await d.page.evaluate(() => {
      const H = innerHeight - (document.querySelector('#tabbar').getBoundingClientRect().top < innerHeight - 5 && innerWidth < 1024 ? document.querySelector('#tabbar').getBoundingClientRect().height : 0);
      const blocks = [...document.querySelectorAll('#view-home .home-hero, #view-home .glance > *, #view-home .kid-cta, #view-home .two-col > .card, #view-home .stack-lg > .card')];
      const r = blocks.map(b => { const q = b.getBoundingClientRect(); return { el: (b.querySelector('h2') ? b.querySelector('h2').textContent.trim() : b.className.split(' ')[0]).slice(0, 22), top: Math.round(q.top), bottom: Math.round(q.bottom), full: q.bottom <= H }; });
      const hero = document.querySelector('#view-home .home-hero').getBoundingClientRect();
      return { visibleHeight: Math.round(H), heroHeight: Math.round(hero.height), heroShare: +(hero.height / H).toFixed(2), fullyVisible: r.filter(x => x.full).map(x => x.el), blocks: r, scrollHeight: document.querySelector('#views').scrollHeight };
    });
    await d.page.click('#tabbar .tab[data-tab="apps"]'); await sleep(700);
    const apps = await d.page.evaluate(() => {
      const g = document.querySelector('#grid'); const cols = getComputedStyle(g).gridTemplateColumns.split(' ').length;
      const t = document.querySelector('#grid .tile:not(.wide)'); const tr = t.getBoundingClientRect(); const ic = t.querySelector('.ticon').getBoundingClientRect();
      return { columns: cols, tile: [Math.round(tr.width), Math.round(tr.height)], icon: Math.round(ic.width), labelPx: getComputedStyle(t.querySelector('.tlabel')).fontSize, tiles: document.querySelectorAll('#grid .tile').length, gridBottom: Math.round(g.getBoundingClientRect().bottom), viewport: [innerWidth, innerHeight] };
    });
    out.density[`${device}-${profile}`] = { home, apps };
    console.log(`\n== ${device} (${profile})\n  Home: hero ${home.heroHeight}px = ${Math.round(home.heroShare * 100)}% of the visible height; fully visible above the tab bar: ${home.fullyVisible.join(', ')}; page ${home.scrollHeight}px`);
    console.log(`  Apps: ${apps.columns} columns, tile ${apps.tile.join('×')}, icon ${apps.icon}px, label ${apps.labelPx}, ${apps.tiles} tiles, grid ends at y=${apps.gridBottom} of ${apps.viewport[1]}`);
    if (device === 'iphone-pwa' && profile === 'eli') {
      // motion as computed on the controls people press
      out.motion = await d.page.evaluate(() => {
        const q = [['.tile', '#grid .tile'], ['.tab', '#tabbar .tab'], ['.tab-ind', '#tab-ind'], ['.view', '#view-apps']];
        return q.map(([n, s]) => { const e = document.querySelector(s); const c = getComputedStyle(e); return { el: n, transition: c.transition.slice(0, 160), animation: (c.animationName + ' ' + c.animationDuration + ' ' + c.animationTimingFunction).slice(0, 120) }; });
      });
      const sheets = await d.page.evaluate(() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).map(r => r.cssText).filter(t => /:active/.test(t) && /scale\(/.test(t)).map(t => t.replace(/\s+/g, ' ').slice(0, 120)));
      out.pressRules = sheets;
      console.log('  press rules (:active + scale):\n   ' + sheets.join('\n   '));
      console.log('  computed motion:', JSON.stringify(out.motion));
    }
    await d.close();
  }
  // Reduce Motion on (WebKit): does the shell boot?
  for (const rm of ['no-preference', 'reduce']) {
    const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'eli' });
    await d.page.emulateMedia({ reducedMotion: rm });
    await d.goto('#home'); await sleep(3500);
    const st = await d.page.evaluate(() => ({ gateHidden: document.querySelector('#gate').hidden, shellHidden: document.querySelector('#shell').hidden, sheenFrom: typeof (window.hub && hub.sheenFrom), matches: matchMedia('(prefers-reduced-motion: reduce)').matches }));
    out.reducedMotion[rm] = { ...st, errors: d.logs.filter(l => /error/i.test(l)).slice(0, 3), shot: await shotCss(d.page, `reduced-motion-${rm}-webkit-ipad.png`) };
    console.log(`\n== Reduce Motion ${rm} (WebKit iPad):`, JSON.stringify(out.reducedMotion[rm]));
    await d.close();
  }
} finally { await L.close(); }
console.log('\nwrote', save('density-motion.json', out));
