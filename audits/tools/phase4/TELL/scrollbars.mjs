// TELL / scrollbars: "visible scrollbars on chrome", measured with REAL classic scrollbars in all 11 areas.
//   node audits/tools/phase4/TELL/scrollbars.mjs   → audits/evidence/p4/TELL/scrollbars.json (+ 1x PNGs where one paints)
// Playwright starts headless Chromium with --hide-scrollbars and its WebKit build on Windows paints overlay scrollbars, so
// both report 0 px everywhere (tells.json vbar 0). This script launches its own Chromium WITHOUT --hide-scrollbars — what
// a Windows PC, or a Mac set to "Show scroll bars: always" or with a mouse plugged in, shows at 1440x900 — against the
// rig's local instance (L.site / L.api from lib/local.mjs), with the same signed-in localStorage lib/local.mjs seeds.
// Every scroller in the area's document (the app frame; the page for shell/TV) is listed with its bar px. For areas with
// on-demand scrollers the script also opens them: shell Me (the Me view scrolls in #views), F260 Plan (the sticky side
// column), Prayer's More sheet, the build guide's chip strip and the park map's Search sheet.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, playwright } from '../../lib/local.mjs';
import { contextOptions } from '../../lib/devices.mjs';
import { AREAS, profileFor, deviceFor } from './areas.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const L = await local({ variant: 'typical', engine: 'chromium' });
const pw = playwright();
const browser = await pw.chromium.launch({ executablePath: CHROME, headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
const OUTF = path.join(EV, 'scrollbars.json');
const out = { note: 'See the header of audits/tools/phase4/TELL/scrollbars.mjs.', areas: fs.existsSync(OUTF) ? JSON.parse(fs.readFileSync(OUTF, 'utf8')).areas : {} };
const EXTRA = { shell: [['#me', null]], f260: [[null, '#tabPlan']], prayer: [[null, '#moreBtn']], 'dollywood-live': [[null, '#lv-search']] };
const PROBE = () => {
  const px = v => parseFloat(v) || 0;
  const shown = e => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none'; };
  const sel = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '');
  const sc = [];
  const se = document.scrollingElement;
  if (se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1) sc.push({ sel: 'document', vbar: innerWidth - document.documentElement.clientWidth, hbar: innerHeight - document.documentElement.clientHeight, scrollbarWidth: getComputedStyle(document.documentElement).scrollbarWidth, chrome: false });
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el); if (!/(auto|scroll)/.test(s.overflowY + ' ' + s.overflowX) || !shown(el)) continue;
    const y = /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1, x = /(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1;
    if (!x && !y) continue;
    let chrome = false; for (let a = el; a && a !== document.body; a = a.parentElement) { const c = getComputedStyle(a); if (/fixed|sticky/.test(c.position) || a.matches('nav, header, aside, [role=tablist], .tabbar, .topbar, .chips, .sheet, .side, .miles, .lv-sheet, .lv-body, .pop, #views')) { chrome = true; break; } }
    const r = el.getBoundingClientRect();
    sc.push({ sel: sel(el), x, y, vbar: Math.round(el.offsetWidth - el.clientWidth - px(s.borderLeftWidth) - px(s.borderRightWidth)), hbar: Math.round(el.offsetHeight - el.clientHeight - px(s.borderTopWidth) - px(s.borderBottomWidth)), scrollbarWidth: s.scrollbarWidth, chrome, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] });
  }
  return sc;
};
async function device(profile, dev) {
  const S = L.S;
  const ctx = await browser.newContext({ ...contextOptions(dev, 'light'), serviceWorkers: 'block' });
  await ctx.route('https://house-hub-api.catalystfarm1.workers.dev/**', r => r.abort());
  const cfg = { site: L.site, api: L.api, device: S.info.device, session: S.sessions[profile], profiles: S.profiles, last: profile };
  await ctx.addInitScript(c => { try { if (location.origin === c.site && !localStorage.getItem('rig.init')) { localStorage.clear(); localStorage.setItem('hub.api', JSON.stringify(c.api)); localStorage.setItem('hub.device', JSON.stringify(c.device)); if (c.session) localStorage.setItem('hub.session', JSON.stringify(c.session)); localStorage.setItem('hub.profiles', JSON.stringify(c.profiles)); localStorage.setItem('hub.lastProfile', JSON.stringify(c.last)); localStorage.setItem('rig.init', '1'); } } catch {} }, cfg);
  const page = await ctx.newPage();
  return { ctx, page };
}
try {
  const WANT = process.argv.slice(2).length ? process.argv.slice(2) : AREAS;
  for (const area of WANT) {
    const R = { area, views: [] };
    try {
      const { ctx, page } = await device(profileFor(area), deviceFor(area, 'desktop'));
      const shellArea = area === 'shell' || area === 'tv';
      await page.goto(L.site + '/index.html#' + (shellArea ? 'home' : area), { waitUntil: 'load' });
      await sleep(/dollywood/.test(area) ? 4000 : 2500);
      const doc = () => shellArea ? page.mainFrame() : page.frames().find(f => f.url().includes(`/apps/${area}.html`));
      const probe = async (label) => { const d = doc(); if (!d) return; const sc = await d.evaluate(PROBE).catch(e => [{ err: e.message.slice(0, 60) }]); const any = sc.some(s => s.vbar > 0 || s.hbar > 0);
        // one small 1x crop per area: the right-hand 260 px of the first scroller with a vertical bar (or the bottom 90 px of a horizontal one)
        let shot = null; const first = sc.find(s => s.vbar > 0 || s.hbar > 0);
        if (any && first && !R.views.some(v => v.shot)) {
          const off = shellArea ? { x: 0, y: 0 } : await page.$eval('#frame', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y }; });
          const vp = page.viewportSize();
          const r = first.sel === 'document' ? [0, 0, vp.width - off.x, vp.height - off.y] : first.rect;
          const clip = first.vbar > 0 ? { x: off.x + r[0] + r[2] - 260, y: off.y + r[1], width: 260, height: Math.max(40, Math.min(r[3], vp.height - off.y - r[1], 640)) }
            : { x: off.x + r[0], y: off.y + r[1] + r[3] - 90, width: Math.min(r[2], 700), height: 90 };
          clip.y = Math.max(0, Math.min(clip.y, vp.height - 60)); clip.height = Math.max(40, Math.min(clip.height, vp.height - clip.y)); clip.x = Math.max(0, Math.min(clip.x, vp.width - clip.width));
          const f = path.join(EV, `scrollbar-${area}-${label}-desktop.png`); await page.screenshot({ path: f, scale: 'css', clip }); shot = path.relative(ROOT, f).replace(/\\/g, '/');
        }
        R.views.push({ view: label, scrollers: sc, shot }); };
      await probe('main');
      for (const [hash, click] of EXTRA[area] || []) {
        if (hash) { await page.evaluate(h => { location.hash = h; }, hash); await sleep(1500); }
        if (click) { await doc().click(click, { timeout: 3000 }).catch(() => {}); await sleep(1200); }
        await probe((hash || click).replace(/[#.]/g, ''));
      }
      await ctx.close();
    } catch (e) { R.error = String(e.message || e).split('\n')[0]; }
    out.areas[area] = R;
    console.log(area, JSON.stringify(R.views.map(v => [v.view, v.scrollers.filter(s => s.vbar || s.hbar).map(s => `${s.sel}${s.chrome ? '(chrome)' : ''} v${s.vbar} h${s.hbar} sw=${s.scrollbarWidth}`)])), R.error || '');
    fs.writeFileSync(path.join(EV, 'scrollbars.json'), JSON.stringify(out, null, 1));
  }
} finally { await browser.close().catch(() => {}); await L.close(); }
