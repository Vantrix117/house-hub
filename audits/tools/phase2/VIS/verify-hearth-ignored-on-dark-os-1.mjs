// Skeptic #1 for finding "hearth-ignored-on-dark-os": choosing Hearth on a dark-mode OS.
// Independent of palette.mjs: picks the theme by tapping the real Me → Appearance card (not hub.setTheme),
// runs four conditions per engine (two controls, one reference, one test), then reloads to check persistence.
//   node "audits/tools/phase2/VIS/verify-hearth-ignored-on-dark-os-1.mjs"
// Writes only to the throwaway local rig (Eli's hub/theme) and audits/evidence/p2/VIS/verify-hearth-*.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/VIS');
const CASES = [
  { name: 'light OS + Hearth (control)', mode: 'light', theme: 'hearth' },
  { name: 'dark OS + System (control)', mode: 'dark', theme: 'system' },
  { name: 'dark OS + Midnight (reference dark palette)', mode: 'dark', theme: 'midnight' },
  { name: 'dark OS + Hearth (TEST)', mode: 'dark', theme: 'hearth' },
];

const measure = page => page.evaluate(() => {
  const root = document.documentElement, cs = getComputedStyle(root);
  const spot = document.querySelector('#view-home .kids-card .spot, #view-home .stars-card .spot');
  const hero = document.querySelector('#view-home .hero, #view-home .home-hero');
  return {
    stored: localStorage.getItem('hub.theme'), hubTheme: window.hub && hub.theme(), hubScheme: window.hub && hub.scheme(),
    dataTheme: root.getAttribute('data-theme'), dataScheme: root.getAttribute('data-scheme'),
    prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
    tokBg: cs.getPropertyValue('--bg').trim(), tokText: cs.getPropertyValue('--text').trim(), tokOnAccent: cs.getPropertyValue('--on-accent').trim(),
    bodyBg: getComputedStyle(document.body).backgroundColor, bodyColor: getComputedStyle(document.body).color,
    kidsSpotOpacity: spot ? getComputedStyle(spot).opacity : 'NO SPOT',
    heroColor: hero ? getComputedStyle(hero).color : 'NO HERO',
    themeColorMeta: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content),
    activeCard: (document.querySelector('#theme .theme-card.on') || {}).dataset?.theme || null,
  };
});

const results = {};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  try {
    for (const c of CASES) {
      const d = await L.device({ device: 'ipad-portrait', mode: c.mode, profile: 'eli' });
      await d.goto('#home'); await d.page.waitForSelector('#view-home .kids-card, #view-home .stars-card', { timeout: 15000 }).catch(() => {}); await sleep(800);
      // the real user path: Me tab → Appearance → tap the theme card
      await d.page.click('#tabbar .tab[data-tab="me"]'); await d.page.waitForSelector('#theme .theme-card', { timeout: 10000 });
      await d.page.click(`#theme .theme-card[data-theme="${c.theme}"]`); await sleep(600);
      const afterTap = await measure(d.page);
      await d.page.click('#tabbar .tab[data-tab="home"]'); await sleep(800);
      const home = await measure(d.page);
      const slug = `${engine}-${c.mode}-${c.theme}`;
      if (engine === 'webkit') await d.page.screenshot({ path: path.join(OUT, `verify-hearth-${slug}.png`), scale: 'css' });
      // persistence: reload the page — is the choice still ignored?
      await d.goto('#home'); await sleep(1500);
      const reload = await measure(d.page);
      const server = (await L.apiAs('eli', '/api/data/hub?scope=person')).body;
      const serverTheme = JSON.stringify(server).match(/"key":"theme"[^}]*"value":("[^"]*"|null)/)?.[1] ?? JSON.stringify(server).slice(0, 200);
      results[`${engine} | ${c.name}`] = { afterTap, home, reload, serverTheme };
      console.log(`\n== ${engine} | ${c.name}`);
      console.log('  Me after tap :', JSON.stringify({ stored: afterTap.stored, activeCard: afterTap.activeCard, dataTheme: afterTap.dataTheme, dataScheme: afterTap.dataScheme, bodyBg: afterTap.bodyBg }));
      console.log('  Home         :', JSON.stringify({ dataTheme: home.dataTheme, dataScheme: home.dataScheme, prefersDark: home.prefersDark, tokBg: home.tokBg, tokText: home.tokText, bodyBg: home.bodyBg, bodyColor: home.bodyColor, kidsSpotOpacity: home.kidsSpotOpacity, heroColor: home.heroColor, tokOnAccent: home.tokOnAccent, themeColorMeta: home.themeColorMeta }));
      console.log('  after reload :', JSON.stringify({ stored: reload.stored, dataTheme: reload.dataTheme, dataScheme: reload.dataScheme, bodyBg: reload.bodyBg }));
      console.log('  server hub/theme:', serverTheme);
      if (d.logs.length) console.log('  console:', d.logs.slice(0, 5).join(' | '));
      await d.close();
    }
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(OUT, 'verify-hearth-ignored-on-dark-os-1.json'), JSON.stringify(results, null, 1));
console.log('\nwrote audits/evidence/p2/VIS/verify-hearth-ignored-on-dark-os-1.json');
