// Skeptic #1 follow-up for "classic-scrollbars-on-chrome": the TV board. #views reserves 15 px on the TV (main script), but
// is a bar painted there? Crop the right 60 px at 1920x1080 without --hide-scrollbars and list what sits over x=1912.
//   node audits/tools/phase4/TELL/verify-classic-scrollbars-on-chrome-1-tv.mjs → evidence verify-classic-scrollbars-on-chrome-1-tv*.{png,json}
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { local, sleep, playwright } from '../../lib/local.mjs'; import { contextOptions } from '../../lib/devices.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'); const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const L = await local({ variant: 'typical', engine: 'chromium' }); const pw = playwright();
const b = await pw.chromium.launch({ executablePath: CHROME, headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
const out = {};
try {
  const ctx = await b.newContext({ ...contextOptions('tv', 'light'), serviceWorkers: 'block' });
  await ctx.route('https://house-hub-api.catalystfarm1.workers.dev/**', r => r.abort());
  const S = L.S; const cfg = { site: L.site, api: L.api, device: S.info.device, session: S.sessions.tv, profiles: S.profiles, last: 'tv' };
  await ctx.addInitScript(c => { if (location.origin === c.site && !localStorage.getItem('rig.init')) { localStorage.clear(); localStorage.setItem('hub.api', JSON.stringify(c.api)); localStorage.setItem('hub.device', JSON.stringify(c.device)); localStorage.setItem('hub.session', JSON.stringify(c.session)); localStorage.setItem('hub.profiles', JSON.stringify(c.profiles)); localStorage.setItem('hub.lastProfile', JSON.stringify(c.last)); localStorage.setItem('rig.init', '1'); } }, cfg);
  const page = await ctx.newPage(); await page.goto(L.site + '/index.html#home', { waitUntil: 'load' }); await sleep(3500);
  out.probe = await page.evaluate(() => { const v = document.querySelector('#views'); const s = getComputedStyle(v);
    const stack = document.elementsFromPoint(1912, 300).slice(0, 6).map(e => { const c = getComputedStyle(e); return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').slice(0, 2).join('.') : ''} pos=${c.position} z=${c.zIndex}`; });
    return { kind: document.documentElement.dataset.kind, v: v.offsetWidth - v.clientWidth, sh: v.scrollHeight, ch: v.clientHeight, z: s.zIndex, pos: s.position, stackAt1912: stack }; });
  const f = path.join(EV, 'verify-classic-scrollbars-on-chrome-1-tv.png');
  await page.screenshot({ path: f, scale: 'css', clip: { x: 1860, y: 0, width: 60, height: 600 } }); out.shot = path.relative(ROOT, f).split(path.sep).join('/');
  await ctx.close();
  fs.writeFileSync(path.join(EV, 'verify-classic-scrollbars-on-chrome-1-tv.json'), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out));
} finally { await b.close().catch(() => {}); await L.close(); }
