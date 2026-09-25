// Skeptic #2 for TELL "classic-scrollbars-on-chrome". Independent re-measure on the local rig.
//   node audits/tools/phase4/TELL/verify-classic-scrollbars-on-chrome-2.mjs
//   -> audits/evidence/p4/TELL/verify-classic-scrollbars-on-chrome-2.json (+ 1x PNG crops)
// Launches the installed Chrome twice: (A) Playwright defaults (which add --hide-scrollbars, what earlier phases saw) and
// (B) without --hide-scrollbars (classic bars, as Windows / a Mac set to always show). For each area it lists every
// scroller that overflows with its bar thickness, and for the shell samples the pixel colours of the right-edge bar
// against the page background: Hearth on a light OS, System on a dark OS, Midnight on a light OS, Hearth on a dark OS
// (design.css:15 declares color-scheme: light dark only at :root, so the UA bar follows the OS, not the theme).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, playwright } from '../../lib/local.mjs';
import { contextOptions } from '../../lib/devices.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const OUT = path.join(EV, 'verify-classic-scrollbars-on-chrome-2.json');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const L = await local({ variant: 'typical', engine: 'chromium' });
const pw = playwright();
const out = { chrome: CHROME, runs: {} };
const AREAS = [['shell', 'eli', 'desktop'], ['tv', 'tv', 'tv'], ['f260', 'eli', 'desktop'], ['leftovers', 'eli', 'desktop'], ['tally', 'eli', 'desktop'], ['dollywood', 'eli', 'desktop'], ['dollywood-live', 'eli', 'desktop']];
function probe() {
  const px = v => parseFloat(v) || 0;
  const res = [];
  const se = document.scrollingElement;
  if (se.scrollHeight > se.clientHeight + 1) res.push({ sel: 'document', v: innerWidth - document.documentElement.clientWidth, h: 0, sw: getComputedStyle(document.documentElement).scrollbarWidth, cs: getComputedStyle(document.documentElement).colorScheme });
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || s.display === 'none' || s.visibility === 'hidden') continue;
    const oy = /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1, ox = /(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1;
    if (!oy && !ox) continue;
    res.push({ sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : ''), y: oy, x: ox,
      v: Math.round(el.offsetWidth - el.clientWidth - px(s.borderLeftWidth) - px(s.borderRightWidth)), h: Math.round(el.offsetHeight - el.clientHeight - px(s.borderTopWidth) - px(s.borderBottomWidth)),
      sw: s.scrollbarWidth, sc: s.scrollbarColor, rect: [r.x, r.y, r.width, r.height].map(Math.round) });
  }
  return res;
}
async function ctxFor(browser, profile, dev, mode, theme) {
  const S = L.S;
  const ctx = await browser.newContext({ ...contextOptions(dev, mode), serviceWorkers: 'block' });
  await ctx.route('https://house-hub-api.catalystfarm1.workers.dev/**', r => r.abort());
  const cfg = { site: L.site, api: L.api, device: S.info.device, session: S.sessions[profile], profiles: S.profiles, last: profile, theme };
  await ctx.addInitScript(c => { try { if (location.origin === c.site && !localStorage.getItem('rig.init')) { localStorage.clear(); localStorage.setItem('hub.api', JSON.stringify(c.api)); localStorage.setItem('hub.device', JSON.stringify(c.device)); if (c.session) localStorage.setItem('hub.session', JSON.stringify(c.session)); localStorage.setItem('hub.profiles', JSON.stringify(c.profiles)); localStorage.setItem('hub.lastProfile', JSON.stringify(c.last)); if (c.theme) localStorage.setItem('hub.theme', JSON.stringify(c.theme)); localStorage.setItem('rig.init', '1'); } } catch {} }, cfg);
  return { ctx, page: await ctx.newPage() };
}
async function pixels(page, clip) {
  const buf = await page.screenshot({ scale: 'css', clip });
  const p2 = await page.context().newPage();
  const r = await p2.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const at = (x, y) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3);
    return { w: img.width, h: img.height, pageNearBar: at(img.width - 30, Math.floor(img.height * 0.9)), barAtY90pct: at(img.width - 8, Math.floor(img.height * 0.9)), barAtY30: at(img.width - 8, 30) };
  }, buf.toString('base64'));
  await p2.close(); return r;
}
const fmt = R => JSON.stringify(Object.fromEntries(Object.entries(R).filter(([k]) => k !== 'shot').map(([k, v]) => [k, Array.isArray(v) ? v.filter(s => s.v || s.h).map(s => `${s.sel} v${s.v} h${s.h} sw=${s.sw}`) : v])));
try {
  for (const [label, hide] of [['A-playwright-default', true], ['B-classic', false]]) {
    const browser = await pw.chromium.launch({ executablePath: CHROME, headless: true, ...(hide ? {} : { ignoreDefaultArgs: ['--hide-scrollbars'] }) });
    const run = out.runs[label] = { version: browser.version(), areas: {} };
    for (const [area, prof, dev] of AREAS) {
      const R = run.areas[area] = {};
      try {
        const { ctx, page } = await ctxFor(browser, prof, dev, 'light');
        const shellish = area === 'shell' || area === 'tv';
        await page.goto(L.site + '/index.html#' + (shellish ? 'home' : area), { waitUntil: 'load' });
        await sleep(/dollywood/.test(area) ? 4500 : 2800);
        const doc = () => shellish ? page.mainFrame() : page.frames().find(f => f.url().includes(`/apps/${area}.html`));
        const d = doc(); R.main = d ? await d.evaluate(probe) : 'no frame';
        if (area === 'dollywood-live' && d) { await d.click('#lv-search', { timeout: 3000 }).catch(e => { R.clickErr = e.message.slice(0, 80); }); await sleep(1200); R.search = await d.evaluate(probe); }
        if (area === 'f260' && d) { await d.click('#tabPlan', { timeout: 3000 }).catch(() => {}); await sleep(1000); R.plan = await d.evaluate(probe); }
        if (!hide && ['shell', 'f260', 'dollywood'].includes(area) && Array.isArray(R.main)) {
          const f = path.join(EV, `verify-classic-scrollbars-on-chrome-2-${area}.png`);
          const vp = page.viewportSize();
          let clip = { x: vp.width - 200, y: 0, width: 200, height: 500 };
          const fr = shellish ? [0, 0] : await page.$eval('#frame', e => { const r = e.getBoundingClientRect(); return [r.x, r.y]; });
          if (area === 'dollywood') { const ch = R.main.find(s => s.sel.startsWith('div#chips')); if (ch) clip = { x: fr[0] + ch.rect[0], y: fr[1] + ch.rect[1], width: Math.min(ch.rect[2], 600), height: ch.rect[3] + 4 }; }
          if (area === 'f260') { const sd = R.main.find(s => s.sel === 'div.side'); if (sd) { const y = fr[1] + Math.max(0, sd.rect[1]); clip = { x: fr[0] + sd.rect[0] + sd.rect[2] - 120, y, width: 120, height: Math.max(40, Math.min(400, vp.height - y)) }; } }
          await page.screenshot({ path: f, scale: 'css', clip }); R.shot = path.relative(ROOT, f).replace(/\\/g, '/');
        }
        await ctx.close();
      } catch (e) { R.error = String(e.message || e).split('\n')[0]; }
      console.log(label, area, fmt(R));
    }
    if (!hide) {
      const colours = run.colours = {};
      const combos = [['hearth-light-os', 'light', 'hearth'], ['system-dark-os', 'dark', 'system'], ['midnight-light-os', 'light', 'midnight'], ['hearth-dark-os', 'dark', 'hearth']];
      for (const [name, mode, theme] of combos) {
        await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
        const { ctx, page } = await ctxFor(browser, 'eli', 'desktop', mode, theme);
        await page.goto(L.site + '/index.html#home', { waitUntil: 'load' }); await sleep(3000);
        const meta = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, scheme: document.documentElement.dataset.scheme, colorScheme: getComputedStyle(document.documentElement).colorScheme, viewsBar: (e => e.offsetWidth - e.clientWidth)(document.querySelector('#views')), bodyBg: getComputedStyle(document.body).backgroundColor }));
        const vp = page.viewportSize();
        colours[name] = { ...meta, ...(await pixels(page, { x: vp.width - 60, y: 0, width: 60, height: vp.height })) };
        if (name === 'midnight-light-os') { const f = path.join(EV, 'verify-classic-scrollbars-on-chrome-2-shell-midnight-light-os.png'); await page.screenshot({ path: f, scale: 'css', clip: { x: vp.width - 200, y: 0, width: 200, height: 500 } }); colours[name].shot = path.relative(ROOT, f).replace(/\\/g, '/'); }
        console.log('colour', name, JSON.stringify(colours[name]));
        await ctx.close();
      }
      await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'system' } });
    }
    await browser.close();
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
} finally { await L.close(); }
