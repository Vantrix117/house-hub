// Phase 4 GLASS — contrast of text on glass WITH a real backdrop blur (Chromium paints backdrop-filter; the WebKit rig
// does not), against the same text with the blur switched off (= what the WebKit rig and Phase 2/3 measured).
// Settles the "provisional, no blur" contrast items: the tab bar labels (P2 "Apps" 3.78), Prayer's nav labels
// (VIS-PRAYER-1, 3.40-3.56), the chat composer, Prayer's detail sheet, the Dollywood park-map sheet, the timer pill.
//
// Method: the Phase 1 screen's go() (areas/*.mjs) through the same `t` adapter as perf.mjs; content is scrolled so
// that busy content sits under the glass; for each target text node: its line boxes (Range.getClientRects), then
// the text is made transparent (color + -webkit-text-fill-color + text-shadow, injected !important on that element
// only) and the page is screenshotted at 1x CSS; every pixel inside the line boxes is compared with the text colour
// (WCAG ratio); p10 and median are reported. Arm "blur" = as shipped in Chromium; arm "noblur" = backdrop-filter:none
// on every element (the WebKit rig's view).
//   node audits/tools/phase4/GLASS/glass-text-blur.mjs [--only id,id]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { DEVICES } from '../../lib/devices.mjs';

const OUTF = path.join(ROOT, 'audits/evidence/p4/GLASS/glass-text-blur.json');
const SHOTS = path.join(ROOT, 'audits/evidence/p4/GLASS/shots');
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();

function decodePng(buf) {
  let p = 8, w, h, ct, idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break; p += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], s = y * (stride + 1) + 1, o = y * stride;
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - stride + x] : 0, c = y && x >= bpp ? px[o - stride + x - bpp] : 0; let v = raw[s + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[o + x] = v & 255; } }
  return { w, h, bpp, px };
}
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const x = Math.max(a, b), y = Math.min(a, b); return (x + 0.05) / (y + 0.05); };

// id, module, screen, device, theme ('system' + mode, or a named theme), target doc, text selector, how to put busy content under the glass
const JOBS = [
  { id: 'tabbar-apps-light', mod: 'shell', screen: 'home', device: 'ipad-portrait', mode: 'light', theme: 'system', doc: 'page', sel: '#tabbar .tab:not(.on)', under: { doc: 'page', sel: '#views', to: 'mid' } },
  { id: 'tabbar-apps-dark', mod: 'shell', screen: 'home', device: 'ipad-portrait', mode: 'dark', theme: 'system', doc: 'page', sel: '#tabbar .tab:not(.on)', under: { doc: 'page', sel: '#views', to: 'mid' } },
  { id: 'tabbar-apps-midnight', mod: 'shell', screen: 'home', device: 'ipad-portrait', mode: 'light', theme: 'midnight', doc: 'page', sel: '#tabbar .tab:not(.on)', under: { doc: 'page', sel: '#views', to: 'mid' } },
  { id: 'tabbar-apps-phone-light', mod: 'shell', screen: 'home', device: 'iphone-pwa', mode: 'light', theme: 'system', doc: 'page', sel: '#tabbar .tab:not(.on)', under: { doc: 'page', sel: '#views', to: 'mid' } },
  { id: 'composer-placeholder-phone', mod: 'shell-me', screen: 'chat', device: 'iphone-pwa', mode: 'light', theme: 'system', doc: 'page', sel: '#chat-in', placeholder: true, under: null },
  { id: 'prayer-nav-dark', mod: 'prayer', screen: 'today', device: 'ipad-portrait', mode: 'dark', theme: 'system', doc: 'app', sel: "body > nav button:not([aria-current=true])", under: { doc: 'app', sel: 'auto', to: 'mid' } },
  { id: 'prayer-nav-midnight', mod: 'prayer', screen: 'today', device: 'ipad-portrait', mode: 'light', theme: 'midnight', doc: 'app', sel: "body > nav button:not([aria-current=true])", under: { doc: 'app', sel: 'auto', to: 'mid' } },
  { id: 'prayer-nav-forest', mod: 'prayer', screen: 'today', device: 'ipad-portrait', mode: 'light', theme: 'forest', doc: 'app', sel: "body > nav button:not([aria-current=true])", under: { doc: 'app', sel: 'auto', to: 'mid' } },
  { id: 'prayer-nav-light', mod: 'prayer', screen: 'today', device: 'ipad-portrait', mode: 'light', theme: 'system', doc: 'app', sel: "body > nav button:not([aria-current=true])", under: { doc: 'app', sel: 'auto', to: 'mid' } },
  { id: 'prayer-sheet-meta-light', mod: 'prayer', screen: 'detail', device: 'ipad-portrait', mode: 'light', theme: 'system', doc: 'app', sel: '#sheetInner > .meta', under: null },
  { id: 'prayer-sheet-meta-dark', mod: 'prayer', screen: 'detail', device: 'ipad-portrait', mode: 'dark', theme: 'system', doc: 'app', sel: '#sheetInner > .meta', under: null },
  { id: 'dlive-pill-light', mod: 'dollywood-live', screen: 'map', device: 'ipad-portrait', mode: 'light', theme: 'system', doc: 'app', sel: '#lv-pill *', under: null },
  { id: 'dlive-meet-light', mod: 'dollywood-live', screen: 'map', device: 'ipad-portrait', mode: 'light', theme: 'system', doc: 'app', sel: '#lv-meet *', under: null },
  { id: 'timer-pill-home', mod: 'timer', screen: 'pill', device: 'ipad-portrait', mode: 'light', theme: 'system', doc: 'page', sel: '#timer-pill *', under: { doc: 'page', sel: '#views', to: 'mid' } },
  { id: 'leftovers-bar-labels', mod: 'leftovers', screen: 'main', device: 'iphone-pwa', mode: 'light', theme: 'system', doc: 'app', sel: '#add label, #add button, #add .hint, #add small', under: { doc: 'app', sel: 'auto', to: 'mid' } },
];

function mkT(Lx, d, dev) {
  const page = d.page, ctx = d.ctx;
  const t = { page, ctx, state: 'typical', device: d.device, mode: 'light', variant: 'typical', profile: d.profile, site: Lx.site, api: Lx.api, dev, loading: false, offline: false, error: false, reopened: false, touch: dev.hasTouch, sleep,
    async settle() { await sleep(1200); }, frame: () => page.frameLocator('#frame'),
    async goto(hash = '') { await page.goto(Lx.site + '/index.html' + hash, { waitUntil: 'load' }); },
    async openApp(id, { wait } = {}) { await t.goto('#' + id); await page.waitForSelector('#viewer.on', { timeout: 10000 }).catch(() => {}); const until = Date.now() + 10000; let f; while (Date.now() < until && !(f = page.frames().find(f => f.url().includes(`/apps/${id}.html`)))) await sleep(100); if (f) { await f.waitForLoadState('domcontentloaded').catch(() => {}); if (wait) await f.waitForSelector(wait, { timeout: 10000 }).catch(() => {}); } return f; },
    appFrame: id => page.frames().find(f => f.url().includes(`/apps/${id}.html`)),
    async tap(target, opts = {}) { const loc = typeof target === 'string' ? page.locator(target).first() : target; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
    async tapIn(fl, selector, opts = {}) { const loc = selector ? fl.locator(selector).first() : fl; if (dev.hasTouch) await loc.tap(opts); else await loc.click(opts); },
    async hold() {}, async answer() {}, async failApi() {}, async clockTo(when) { await ctx.clock.setFixedTime(new Date(when)); },
    async scroll(selector = '#views', y = 'bottom', where = page) { await where.evaluate(([sel, y]) => { const el = document.querySelector(sel) || document.scrollingElement; el.scrollTop = y === 'bottom' ? el.scrollHeight : y; }, [selector, y]); await sleep(250); },
  };
  return t;
}

const out = fs.existsSync(OUTF) ? JSON.parse(fs.readFileSync(OUTF, 'utf8')) : {};
out.note = 'See the header of audits/tools/phase4/GLASS/glass-text-blur.mjs. Per job and text: the ink, the line boxes, and the WCAG ratio of the ink against every background pixel inside them (text hidden), p10 and median, with the real Chromium blur ("blur") and with backdrop-filter off ("noblur", the WebKit rig\'s view). req = 4.5 (3 for large text).';
out.jobs ||= {};
const Lx = await local({ variant: 'typical', engine: 'chromium' });
try {
  for (const j of JOBS) {
    if (only && !only.includes(j.id)) continue;
    const mod = await import(pathToFileURL(path.join(ROOT, 'audits/tools/areas', j.mod + '.mjs')));
    const scr = mod.screens.find(x => x.screen === j.screen && (!x.states || x.states.includes('typical'))) || mod.screens.find(x => x.screen === j.screen);
    const variant = scr && typeof scr.variant === 'object' ? (scr.variant.typical || 'typical') : (scr && scr.variant || 'typical');
    await Lx.reset(variant);
    const profile = scr.profile === undefined ? 'eli' : scr.profile;
    const extra = {};
    if (j.theme !== 'system') {
      for (const [id, s] of Object.entries(Lx.S.sessions)) if (s.profile.kind !== 'kiosk') await Lx.apiAs(id, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: j.theme } });
      extra['hub.theme'] = JSON.stringify(j.theme);
    }
    const d = await Lx.device({ device: j.device, mode: j.mode, profile, localStorage: Object.keys(extra).length ? extra : null });
    const dev = DEVICES[j.device];
    const rec = { job: j, goError: null, arms: {} };
    try { await scr.go(mkT(Lx, d, dev)); if (scr.after) await scr.after(mkT(Lx, d, dev)); } catch (e) { rec.goError = String(e && e.message || e).split('\n')[0]; }
    await sleep(2000);
    const app = d.page.frames().find(f => /\/apps\/[^/]+\.html/.test(f.url()));
    const F = j.doc === 'app' ? app : d.page.mainFrame();
    if (!F) { rec.error = 'no frame'; out.jobs[j.id] = rec; await d.close(); continue; }
    rec.applied = await d.page.evaluate(() => ({ theme: document.documentElement.dataset.theme || null, scheme: document.documentElement.dataset.scheme || null }));
    if (j.under) {
      const U = j.under.doc === 'app' ? app : d.page.mainFrame();
      rec.under = await U.evaluate(u => { let el = u.sel !== 'auto' ? document.querySelector(u.sel) : null;
        if (!el) { const c = [document.scrollingElement, ...document.querySelectorAll('*')].filter(e => e && (e === document.scrollingElement || /auto|scroll/.test(getComputedStyle(e).overflowY)) && e.scrollHeight - e.clientHeight > 40); c.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight)); el = c[0]; }
        if (!el) return null; el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * 0.45); return { scroller: el.id || el.tagName, top: el.scrollTop, range: el.scrollHeight - el.clientHeight }; }, j.under).catch(e => String(e));
      await sleep(600);
    }
    for (const arm of ['blur', 'noblur']) {
      for (const f of d.page.frames()) await f.evaluate(on => { let s = document.getElementById('m4-nb'); if (!on) { if (s) s.remove(); return; } if (!s) { s = document.createElement('style'); s.id = 'm4-nb'; document.head.appendChild(s); } s.textContent = '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'; }, arm === 'noblur').catch(() => {});
      await sleep(500);
      // the frame's offset in the page
      const off = j.doc === 'app' ? await d.page.evaluate(() => { const r = document.querySelector('#frame').getBoundingClientRect(); return { x: r.left, y: r.top }; }) : { x: 0, y: 0 };
      const items = await F.evaluate(([sel, ph]) => {
        const res = []; let k = 0;
        for (const el of document.querySelectorAll(sel)) {
          const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          let rects = [];
          if (ph) { if (!el.placeholder || el.value) continue; const r = el.getBoundingClientRect(); const pl = parseFloat(cs.paddingLeft), fs = parseFloat(cs.fontSize); rects = [{ x: r.left + pl, y: r.top + (r.height - fs * 1.2) / 2, w: Math.min(r.width - pl * 2, el.placeholder.length * fs * 0.5), h: fs * 1.2 }]; }
          else for (const n of el.childNodes) { if (n.nodeType !== 3 || !n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width > 2 && r.height > 4) rects.push({ x: r.left, y: r.top, w: r.width, h: r.height }); }
          rects = rects.filter(r => r.y + r.h > 0 && r.y < innerHeight && r.x + r.w > 0 && r.x < innerWidth);
          if (!rects.length) continue;
          const col = ph ? getComputedStyle(el, '::placeholder').color : cs.color;
          const id = 'm4t' + (k++); el.setAttribute('data-m4t', id);
          res.push({ id, sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''), text: (ph ? el.placeholder : el.textContent).trim().slice(0, 40), color: col, fs: parseFloat(cs.fontSize), fw: +cs.fontWeight, rects });
        }
        return res;
      }, [j.sel, !!j.placeholder]);
      // hide the text of every target, shoot once
      await F.evaluate(ph => { const s = document.createElement('style'); s.id = 'm4-hide'; s.textContent = ph ? '[data-m4t]::placeholder{color:transparent!important}' : '[data-m4t]{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}'; document.head.appendChild(s); }, !!j.placeholder);
      await sleep(150);
      const buf = await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' });
      await F.evaluate(() => { const s = document.getElementById('m4-hide'); if (s) s.remove(); });
      if (arm === 'blur') { fs.mkdirSync(SHOTS, { recursive: true }); const sp = path.join(SHOTS, `text-${j.id}.png`); fs.writeFileSync(sp, await d.page.screenshot({ scale: 'css', animations: 'disabled', caret: 'hide' })); rec.shot = path.relative(ROOT, sp).replace(/\\/g, '/'); }
      const img = decodePng(buf);
      const res = [];
      for (const it of items) {
        const m = it.color.match(/[\d.]+/g).map(Number); const [r, g, b] = m; const a = m.length > 3 ? m[3] : 1;
        const vals = [];
        for (const R of it.rects) for (let y = Math.max(0, Math.floor(R.y + off.y + 1)); y < Math.min(img.h, Math.ceil(R.y + off.y + R.h - 1)); y++) for (let x = Math.max(0, Math.floor(R.x + off.x + 1)); x < Math.min(img.w, Math.ceil(R.x + off.x + R.w - 1)); x++) {
          const o = (y * img.w + x) * img.bpp; const br = img.px[o], bg = img.px[o + 1], bb = img.px[o + 2];
          const ir = r * a + br * (1 - a), ig = g * a + bg * (1 - a), ib = b * a + bb * (1 - a);
          vals.push(ratio(L(ir, ig, ib), L(br, bg, bb)));
        }
        vals.sort((x, y) => x - y);
        const q = p => vals.length ? +vals[Math.floor(p * (vals.length - 1))].toFixed(2) : null;
        const large = it.fs >= 24 || (it.fs >= 18.66 && it.fw >= 700);
        res.push({ sel: it.sel, text: it.text, color: it.color, fs: it.fs, fw: it.fw, px: vals.length, p10: q(0.1), med: q(0.5), req: large ? 3 : 4.5 });
      }
      rec.arms[arm] = res;
    }
    rec.summary = rec.arms.blur.map((b, i) => ({ text: b.text, sel: b.sel, fs: b.fs, req: b.req, blur: [b.p10, b.med], noblur: rec.arms.noblur[i] ? [rec.arms.noblur[i].p10, rec.arms.noblur[i].med] : null }));
    console.log(j.id, JSON.stringify(rec.applied), rec.goError || '', JSON.stringify(rec.summary));
    out.jobs[j.id] = rec;
    fs.writeFileSync(OUTF, JSON.stringify(out, null, 1));
    await d.close();
  }
} finally { fs.writeFileSync(OUTF, JSON.stringify(out, null, 1)); await Lx.close(); }
