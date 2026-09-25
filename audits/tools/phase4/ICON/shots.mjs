// Phase 4 ICON — the few 1x screenshots this dimension cites (read-only; theme set as the profile's own pref on the rig).
//   node audits/tools/phase4/ICON/shots.mjs
// → audits/evidence/p4/ICON/shot-*.png
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const OUT = path.resolve('audits/evidence/p4/ICON');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const setTheme = async (p, t) => L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: t, updated_at: Date.now() } });
const shot = async (d, name, clip) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide', clip }); console.log(path.relative(process.cwd(), f), fs.statSync(f).size); };
const open = async (device, profile, theme, mode) => { await setTheme(profile, theme); return L.device({ device, profile, mode, localStorage: { 'hub.theme': JSON.stringify(theme) } }); };
const home = async d => { await d.goto('#home'); await d.page.waitForSelector('#view-home .home-hero', { timeout: 15000 }); await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull, null, { timeout: 10000 }).catch(() => {}); await sleep(1200); };
try {
  // 1. Apps grid in Parchment (Kid Verse and Timer tile glyphs under 3:1) and in Midnight (6 of 9 under 3:1)
  for (const [t, m] of [['parchment', 'light'], ['midnight', 'dark']]) {
    const d = await open('iphone-pwa', 'eli', t, m); await home(d);
    await d.page.click('#tabbar .tab[data-tab="apps"]'); await d.page.waitForSelector('#grid .tile'); await sleep(900);
    const bb = await d.page.locator('#grid').boundingBox();
    await shot(d, `shot-apps-grid-${t}-iphone.png`, { x: 0, y: Math.max(0, bb.y - 8), width: 430, height: Math.min(360, bb.height + 16) });
    await d.close();
  }
  // 2. Midnight: Home card heads (apps.json hex tints) vs the TV board heads (theme tokens)
  { const d = await open('ipad-portrait', 'eli', 'midnight', 'dark'); await home(d);
    const heads = await d.page.$$eval('#view-home .card h2', hs => hs.slice(0, 6).map(h => { const r = h.getBoundingClientRect(); return { y: r.y + scrollY, h: r.height, t: h.innerText.trim().slice(0, 30) }; }));
    console.log('home heads', JSON.stringify(heads));
    await shot(d, 'shot-home-heads-midnight-ipad.png', { x: 0, y: 0, width: 820, height: 1180 });
    await d.close(); }
  { const d = await L.device({ device: 'tv', profile: 'tv', mode: 'dark', localStorage: { 'hub.theme': JSON.stringify('midnight') } });
    await d.goto('#home'); await d.page.waitForSelector('#tv', { timeout: 15000 }); await sleep(2500);
    await shot(d, 'shot-tv-heads-midnight.png', { x: 0, y: 0, width: 1920, height: 1080 });
    await d.close(); }
  // 3. F260 week rows in Hearth: the week-done tick on the ring
  { const d = await open('iphone-pwa', 'eli', 'hearth', 'light'); const f = await d.openApp('f260'); await sleep(2500);
    const y = await f.evaluate(() => { const e = document.querySelector('.week .wk-head'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return r.y; }); await sleep(500);
    const fe = await (await f.frameElement()).boundingBox();
    await shot(d, 'shot-f260-week-ticks-hearth-iphone.png', { x: 0, y: Math.max(0, fe.y + y - 20), width: 430, height: 260 });
    await d.close(); }
} catch (e) { console.log('ERROR', e && e.stack || e); }
finally { await L.close(); }
