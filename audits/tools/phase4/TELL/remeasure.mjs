// Phase 4 TELL — independent re-measure of the investigator's key numbers (written from scratch; does not import any
// other TELL script). Local rig only. Usage:  node audits/tools/phase4/TELL/remeasure.mjs <part> [area,area,...]
// Parts: static | tap | usel | ring | flash | over | scroll | cls | latency
// Output: audits/evidence/p4/TELL/remeasure-<part>.json (merged per area when run in chunks).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'TELL');
const ALL = ['shell', 'tv', 'f260', 'leftovers', 'prayer', 'tally', 'timer', 'dollywood', 'dollywood-live', 'kidverse', 'verses'];
const part = process.argv[2];
const areas = process.argv[3] ? process.argv[3].split(',') : ALL;
const prof = a => a === 'tv' ? 'tv' : a === 'kidverse' ? 'ezra' : 'eli';
const devFor = (a, d) => a === 'tv' ? 'tv' : d;
const save = (obj) => {
  const f = path.join(OUT, `remeasure-${part}.json`);
  let prev = {}; try { prev = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  const merged = { ...prev, ...obj, results: { ...(prev.results || {}), ...(obj.results || {}) } };
  fs.writeFileSync(f, JSON.stringify(merged, null, 1));
  console.log('wrote', f);
};

async function open(d, a, settle = 1500) {
  if (a === 'shell' || a === 'tv') {
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 }).catch(() => {});
    await sleep(settle);
    return d.page.mainFrame();
  }
  const f = await d.openApp(a);
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 }).catch(() => {});
  await sleep(settle);
  return f;
}

// ---------- static: whole-file scan (no long-line skipping) ----------
function partStatic() {
  const files = { design: 'apps/design.css', hub: 'apps/hub.js', shell: 'index.html', f260: 'apps/f260.html', leftovers: 'apps/leftovers.html', prayer: 'apps/prayer.html', tally: 'apps/tally.html', timer: 'apps/timer.html', dollywood: 'apps/dollywood.html', 'dollywood-live': 'apps/dollywood-live.html', kidverse: 'apps/kidverse.html', verses: 'apps/verses.html' };
  const results = {};
  for (const [k, f] of Object.entries(files)) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const callout = (s.match(/touch-callout/g) || []).length;
    const dlg = [...s.matchAll(/(^|[^.\w$'"`])(alert|confirm|prompt)\(/g)].map(m => m[2]);
    results[k] = { file: f, bytes: s.length, touchCallout: callout, dialogCalls: dlg.length, byKind: dlg.reduce((o, x) => (o[x] = (o[x] || 0) + 1, o), {}) };
  }
  const total = Object.values(results).reduce((n, r) => n + r.dialogCalls, 0);
  save({ note: 'whole-file regex; dialog = alert(/confirm(/prompt( not preceded by a word char, dot, $ or quote', totalDialogCalls: total, results });
}

// ---------- in-page probes ----------
const PROBE = () => {
  const CTL = 'button, a, [role], label, .tile, .chip';
  const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const c = getComputedStyle(e); return c.visibility !== 'hidden' && c.display !== 'none' && (!e.checkVisibility || e.checkVisibility({ opacityProperty: false, visibilityProperty: true })); };
  const id = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '');
  const ctl = [...document.querySelectorAll(CTL)].filter(e => !e.closest('svg') && vis(e));
  const tap = {}; const usel = {};
  for (const e of ctl) { const c = getComputedStyle(e); const t = c.webkitTapHighlightColor; tap[t] = (tap[t] || 0) + 1; const u = c.webkitUserSelect || c.userSelect; usel[u] = (usel[u] || 0) + 1; }
  const selectable = ctl.filter(e => { const c = getComputedStyle(e); return (c.webkitUserSelect || c.userSelect) !== 'none'; }).map(id);
  const SKIP = ['hidden', 'checkbox', 'radio', 'range', 'file', 'button', 'submit', 'reset', 'image', 'color'];
  const fields = [...document.querySelectorAll('input, select, textarea')].filter(e => !(e.tagName === 'INPUT' && SKIP.includes(e.type)))
    .map(e => ({ sel: id(e), type: e.type, fs: parseFloat(getComputedStyle(e).fontSize), visible: vis(e) }));
  const native = [...document.querySelectorAll('input, select, textarea')].filter(e => e.type !== 'hidden')
    .map(e => ({ sel: id(e), type: e.type, app: getComputedStyle(e).appearance || getComputedStyle(e).webkitAppearance, visible: vis(e) }))
    .filter(x => x.app && x.app !== 'none');
  return { controls: ctl.length, tap, usel, selectable, fieldsUnder16: fields.filter(f => f.fs < 16), fieldCount: fields.length, native };
};

async function partProbe(engine, device) {
  const L = await local({ engine });
  const results = {};
  try {
    for (const a of areas) {
      const d = await L.device({ device: devFor(a, device), profile: prof(a) });
      try { const doc = await open(d, a); results[a] = await doc.evaluate(PROBE); console.log(a, JSON.stringify({ n: results[a].controls, tap: results[a].tap, usel: results[a].usel, f16: results[a].fieldsUnder16.map(f => f.sel + ' ' + f.fs), native: results[a].native.length })); }
      catch (e) { results[a] = { error: String(e).slice(0, 300) }; console.log(a, 'ERR', e.message); }
      await d.close();
    }
  } finally { await L.close(); }
  save({ engine, device, results });
}

// ---------- keyboard ring: pixel diff blurred / focused / blurred again ----------
const RING = [['shell', '.gcard .btn'], ['tv', '#kiosk-switch'], ['tally', '#reset'], ['tally', '#plus'], ['timer', '#go'], ['kidverse', '#done,#say'], ['verses', '#show'], ['f260', '#tabPlan'], ['prayer', '#listSwitch button']];
async function partRing() {
  const L = await local({ engine: 'chromium' });
  const results = {};
  const cmpCtx = await L.browser.newContext(); const cmp = await cmpCtx.newPage();
  const diff = (a, b) => cmp.evaluate(async ([a, b]) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [A, B] = [await load(a), await load(b)];
    const px = im => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
    const pa = px(A), pb = px(B); let n = 0;
    for (let i = 0; i < pa.length; i += 4) if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 24) n++;
    return { changed: n, total: pa.length / 4 };
  }, [a.toString('base64'), b.toString('base64')]);
  try {
    for (const [a, sel] of RING) {
      if (!areas.includes(a)) continue;
      const d = await L.device({ device: devFor(a, 'desktop'), profile: prof(a) });
      try {
        const doc = await open(d, a, 2000);
        let h = null, used = null;
        for (const s of sel.split(',')) { const hs = await doc.$$(s); for (const x of hs) if (await x.isVisible()) { h = x; used = s; break; } if (h) break; }
        if (!h) { results[a + ' ' + sel] = { error: 'not visible' }; await d.close(); continue; }
        await h.scrollIntoViewIfNeeded(); await sleep(300);
        const bb = await h.boundingBox(); const clip = { x: Math.max(0, bb.x - 6), y: Math.max(0, bb.y - 6), width: bb.width + 12, height: bb.height + 12 };
        const shot = () => d.page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
        const b0 = await shot();
        await d.page.keyboard.press('Tab'); await sleep(100);
        await h.evaluate(e => e.focus()); await sleep(400);
        const fv = await h.evaluate(e => ({ focus: e.matches(':focus'), fv: e.matches(':focus-visible'), outline: getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineWidth, shadow: getComputedStyle(e).boxShadow.slice(0, 120) }));
        const f1 = await shot();
        await h.evaluate(e => e.blur()); await sleep(400);
        const b1 = await shot();
        const change = await diff(b0, f1), noise = await diff(b0, b1);
        results[a + ' ' + used] = { ...fv, changed: change.changed, noise: noise.changed, cropPx: change.total };
        console.log(a, used, JSON.stringify(results[a + ' ' + used]));
      } catch (e) { results[a + ' ' + sel] = { error: String(e).slice(0, 300) }; console.log(a, 'ERR', e.message); }
      await d.close();
    }
  } finally { await cmpCtx.close(); await L.close(); }
  save({ method: 'Chromium desktop; Tab once (keyboard modality) then el.focus(); crop bbox+6px; changed = pixels with |dR|+|dG|+|dB| > 24 between blurred and focused; noise = blurred vs blurred again', results });
}

// ---------- flash: Midnight on a light OS, hub.js 400 ms late, rAF-sampled body background ----------
const FLASH_INIT = () => {
  const s = []; window.__fl = s; let last = null; const t0 = performance.timeOrigin;
  const tick = () => {
    const b = document.body; const el = b || document.documentElement;
    if (el) { const bg = getComputedStyle(el).backgroundColor; const hbg = getComputedStyle(document.documentElement).backgroundColor; const th = document.documentElement.dataset.theme || ''; const k = bg + '|' + hbg + '|' + th + '|' + !!b;
      if (k !== last) { s.push({ t: Math.round(t0 + performance.now()), bg, hbg, theme: th, body: !!b, hub: !!window.hub }); last = k; } }
    if (performance.now() < 6000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__first = null; requestAnimationFrame(() => { window.__first = Math.round(t0 + performance.now()); });
};
const lum = c => { const m = String(c).match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(Number).map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); const a = m[3] != null ? Number(m[3]) : 1; return a === 0 ? null : +(0.2126 * r + 0.7152 * g + 0.0722 * b).toFixed(3); };
async function partFlash() {
  const L = await local({ engine: 'chromium' });
  const results = {};
  try {
    for (const a of areas) {
      const p = prof(a);
      if (p !== 'tv') { const r = await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'midnight' } }); if (r.status !== 200) console.log('theme put', p, r.status, JSON.stringify(r.body).slice(0, 200)); }
      const d = await L.device({ device: devFor(a, 'ipad-portrait'), mode: 'light', profile: p, localStorage: { 'hub.theme': JSON.stringify('midnight') } });
      try {
        await d.ctx.addInitScript(FLASH_INIT);
        const shellArea = a === 'shell' || a === 'tv';
        let doc;
        if (shellArea) {
          await d.ctx.route(/\/apps\/hub\.js(\?.*)?$/, async r => { await sleep(400); await r.continue(); });
          const t = Date.now(); await d.goto('#home'); await sleep(3000); doc = d.page.mainFrame(); results[a] = { navAt: t };
        } else {
          await d.goto('#home'); await sleep(2500);
          await d.ctx.route(/\/apps\/hub\.js(\?.*)?$/, async r => { if (r.request().frame() !== d.page.mainFrame()) await sleep(400); await r.continue(); });
          await d.page.evaluate(id => { location.hash = '#' + id; }, a);
          let f = null; const until = Date.now() + 10000; while (!f && Date.now() < until) { f = d.frame(a); await sleep(50); }
          await sleep(3500); doc = f; results[a] = {};
        }
        const s = await doc.evaluate(() => ({ samples: window.__fl, first: window.__first, theme: document.documentElement.dataset.theme || '', scheme: document.documentElement.dataset.scheme }));
        const rows = (s.samples || []).map(x => ({ ...x, L: lum(x.bg) ?? lum(x.hbg) }));
        const firstBody = rows.find(x => x.body) || rows[0];
        const light = rows.filter(x => x.L != null && x.L > 0.4);
        const darkAfter = rows.find(x => x.L != null && x.L < 0.1 && firstBody && x.t >= firstBody.t);
        const firstLight = light[0];
        results[a] = { ...results[a], final: { theme: s.theme, scheme: s.scheme }, samples: rows.slice(0, 12), firstFrame: s.first,
          lightFirst: !!(firstLight && darkAfter && firstLight.t < darkAfter.t), lightBg: firstLight ? firstLight.bg : null, lightL: firstLight ? firstLight.L : null,
          lightMs: firstLight && darkAfter ? darkAfter.t - Math.max(firstLight.t, s.first || firstLight.t) : 0 };
        console.log(a, JSON.stringify({ lightFirst: results[a].lightFirst, lightMs: results[a].lightMs, lightBg: results[a].lightBg, L: results[a].lightL, final: results[a].final, n: rows.length }));
      } catch (e) { results[a] = { error: String(e).slice(0, 300) }; console.log(a, 'ERR', e.message); }
      await d.close();
    }
  } finally { await L.close(); }
  save({ method: 'Chromium iPad portrait, light OS, Midnight in app_data + localStorage; hub.js 400 ms late (main frame for shell/TV, app frame only for apps, opened from a settled Home by hash); rAF samples of body background; lightMs = first rAF with a light (L>0.4) body -> first rAF with a dark (L<0.1) body', results });
}

// ---------- overscroll: synthetic, does body{overscroll-behavior:none} stop chaining out of an iframe? ----------
async function partOver() {
  const L = await local({ engine: 'chromium' });
  const results = {};
  try {
    for (const [name, rule] of [['none', ''], ['body', 'body{overscroll-behavior:none}'], ['html', 'html{overscroll-behavior:none}']]) {
      const ctx = await L.browser.newContext({ viewport: { width: 800, height: 600 } }); const page = await ctx.newPage();
      const inner = `<!doctype html><style>${rule} body{margin:0} .c{height:2000px;background:linear-gradient(#cde,#edc)}</style><div class=c></div>`;
      await page.setContent(`<!doctype html><style>body{margin:0}</style><iframe id=f style="width:780px;height:400px;border:0" srcdoc="${inner.replace(/"/g, '&quot;')}"></iframe><div style="height:4000px"></div>`);
      await sleep(300);
      const fr = page.frames()[1]; await fr.evaluate(() => scrollTo(0, 1e6)); await sleep(200);
      const innerY = await fr.evaluate(() => scrollY);
      await page.mouse.move(400, 200);
      for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 400); await sleep(350); }
      await sleep(400);
      results[name] = { rule, iframeScrollY: innerY, parentScrollY: await page.evaluate(() => scrollY), iframeScrollYAfter: await fr.evaluate(() => scrollY) };
      console.log(name, JSON.stringify(results[name]));
      await ctx.close();
    }
  } finally { await L.close(); }
  save({ method: 'synthetic page, iframe scrolled to its end, 3 x 400 px wheel over it, parent scrollY after', results });
}

// ---------- scrollbars: Chromium without --hide-scrollbars, generic scan of scrolling boxes ----------
const SCAN = () => {
  const out = [];
  const id = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '');
  const de = document.documentElement;
  out.push({ sel: 'document', v: innerWidth - de.clientWidth, h: innerHeight - de.clientHeight, sh: de.scrollHeight, ch: de.clientHeight });
  for (const e of document.querySelectorAll('body *')) {
    const c = getComputedStyle(e); if (!/(auto|scroll)/.test(c.overflowY + c.overflowX)) continue;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const bl = parseFloat(c.borderLeftWidth) + parseFloat(c.borderRightWidth), bt = parseFloat(c.borderTopWidth) + parseFloat(c.borderBottomWidth);
    const v = Math.round(e.offsetWidth - e.clientWidth - bl), h = Math.round(e.offsetHeight - e.clientHeight - bt);
    if (v > 0 || h > 0) out.push({ sel: id(e), v, h, sw: c.scrollbarWidth });
  }
  return out;
};
async function partScroll() {
  const L = await local({ engine: 'chromium' });
  const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  const br = await L.pw.chromium.launch({ executablePath: CHROME, headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  const results = {};
  try {
    for (const a of areas) {
      const p = prof(a); const vp = a === 'tv' ? { width: 1920, height: 1080 } : { width: 1440, height: 900 };
      const ctx = await br.newContext({ viewport: vp, colorScheme: 'light', serviceWorkers: 'block', timezoneId: 'America/New_York', locale: 'en-US' });
      await ctx.route('https://house-hub-api.catalystfarm1.workers.dev/**', r => r.abort());
      const S = L.S;
      await ctx.addInitScript(c => { try { if (location.origin === c.site && !localStorage.getItem('rig.init')) { localStorage.clear(); localStorage.setItem('hub.api', JSON.stringify(c.api)); localStorage.setItem('hub.device', JSON.stringify(c.device)); localStorage.setItem('hub.session', JSON.stringify(c.session)); localStorage.setItem('hub.profiles', JSON.stringify(c.profiles)); localStorage.setItem('hub.lastProfile', JSON.stringify(c.last)); localStorage.setItem('rig.init', '1'); } } catch {} },
        { site: L.site, api: L.api, device: S.info.device, session: S.sessions[p], profiles: S.profiles, last: p });
      await ctx.clock.setFixedTime(new Date(DEMO + 500));
      const page = await ctx.newPage();
      try {
        const hash = a === 'shell' || a === 'tv' ? '#home' : '#' + a;
        await page.goto(L.site + '/index.html' + hash, { waitUntil: 'load' });
        let doc = page.mainFrame();
        if (hash !== '#home') { const until = Date.now() + 10000; let f; while (!f && Date.now() < until) { f = page.frames().find(x => x.url().includes(`/apps/${a}.html`)); await sleep(100); } doc = f; }
        await sleep(2500);
        results[a] = { doc: await doc.evaluate(SCAN), shellViews: hash !== '#home' ? await page.evaluate(() => { const v = document.querySelector('#views'); return v ? v.offsetWidth - v.clientWidth : null; }) : undefined };
        console.log(a, JSON.stringify(results[a]).slice(0, 400));
      } catch (e) { results[a] = { error: String(e).slice(0, 300) }; console.log(a, 'ERR', e.message); }
      await ctx.close();
    }
  } finally { await br.close(); await L.close(); }
  save({ method: 'Chromium (own launch without --hide-scrollbars), desktop 1440x900 / TV 1920x1080, every overflow auto|scroll box with offset-client-border > 0 plus the document', results });
}

// ---------- CLS with the first pull held + loading placeholders at 900 ms ----------
const CLS_INIT = () => {
  window.__cls = { sum: 0, n: 0, max: 0, top: [] };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__cls.sum += e.value; window.__cls.n++; window.__cls.max = Math.max(window.__cls.max, e.value);
    window.__cls.top.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).slice(0, 2).map(s => { const n = s.node; return (n && n.nodeType === 1 ? n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ')[0] : '') : '?') + ' ' + Math.round(s.previousRect.y) + '->' + Math.round(s.currentRect.y); }) }); } }).observe({ type: 'layout-shift', buffered: true }); } catch {}
};
const LOADING = () => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const all = [...document.querySelectorAll('*')];
  const skel = all.filter(e => /skeleton|shimmer/i.test(typeof e.className === 'string' ? e.className : '') && vis(e)).length;
  const spin = all.filter(e => (/spinner|loader|\bspin\b/i.test(typeof e.className === 'string' ? e.className : '') || e.getAttribute('role') === 'progressbar' || e.getAttribute('aria-busy') === 'true') && vis(e)).length;
  let inf = 0; try { inf = document.getAnimations().filter(a => a.effect && a.effect.getTiming().iterations === Infinity && a.playState === 'running').length; } catch {}
  return { skeletons: skel, spinners: spin, infiniteAnims: inf, textChars: (document.body && document.body.innerText || '').trim().length };
};
async function partCls() {
  const L = await local({ engine: 'chromium', clock: 'real' });
  const results = {};
  try {
    for (const a of areas) {
      const d = await L.device({ device: devFor(a, 'ipad-portrait'), profile: prof(a), fixedTime: false });
      try {
        await d.ctx.addInitScript(CLS_INIT);
        await d.ctx.route(L.api + '/api/**', async r => { const q = r.request(); const hold = q.method() === 'GET' && /\/api\/data\//.test(q.url()); await sleep(hold ? 2500 : 150); r.continue().catch(() => {}); });
        const hash = a === 'shell' || a === 'tv' ? '#home' : '#' + a;
        const t0 = Date.now();
        await d.page.goto(L.site + '/index.html' + hash, { waitUntil: 'commit' });
        const docOf = () => hash === '#home' ? d.page.mainFrame() : d.frame(a);
        await sleep(Math.max(0, 900 - (Date.now() - t0)));
        const f9 = docOf(); const at900 = f9 ? await f9.evaluate(LOADING).catch(e => ({ error: e.message })) : { error: 'frame not yet loaded' };
        at900.ms = Date.now() - t0;
        await sleep(Math.max(0, 6500 - (Date.now() - t0)));
        const doc = docOf(); const cls = await doc.evaluate(() => window.__cls);
        cls.top = cls.top.sort((x, y) => y.v - x.v).slice(0, 4); cls.sum = +cls.sum.toFixed(4);
        results[a] = { cls, at900 };
        console.log(a, JSON.stringify({ cls: cls.sum, n: cls.n, top: cls.top[0], at900 }));
      } catch (e) { results[a] = { error: String(e).slice(0, 300) }; console.log(a, 'ERR', e.message); }
      await d.close();
    }
  } finally { await L.close(); }
  save({ method: 'Chromium iPad portrait, light, System, real clock, cold context; GET /api/data/* held 2500 ms, other API 150 ms; layout-shift sum (no recent input) in the area document over 6.5 s; loading placeholders ~900 ms after commit', results });
}

// ---------- tap latency: touchend -> click in the area document ----------
const TAPSEL = { shell: '#tabbar .tab[data-tab="apps"]', f260: '#tabPlan', leftovers: '#copy', prayer: '#listSwitch button', tally: '#plus', timer: '#presets button', dollywood: '#chips button', 'dollywood-live': '#lv-fit', kidverse: '#say', verses: '#say' };
async function partLatency() {
  const L = await local({ engine: 'chromium' });
  const results = {};
  try {
    for (const a of areas) {
      if (!TAPSEL[a]) continue;
      const d = await L.device({ device: 'ipad-portrait', profile: prof(a) });
      try {
        const doc = await open(d, a, 2000);
        await doc.evaluate(() => { window.__lat = {}; addEventListener('touchend', () => { window.__lat.te = performance.now(); }, true); addEventListener('click', () => { window.__lat.cl = performance.now(); }, true); });
        let h = null; for (const x of await doc.$$(TAPSEL[a])) if (await x.isVisible()) { h = x; break; }
        if (!h) { results[a] = { error: 'no visible ' + TAPSEL[a] }; await d.close(); continue; }
        await h.tap(); await sleep(600);
        const lat = await doc.evaluate(() => window.__lat).catch(() => ({}));
        results[a] = { sel: TAPSEL[a], touchend: lat.te != null, click: lat.cl != null, ms: lat.te != null && lat.cl != null ? +(lat.cl - lat.te).toFixed(1) : null };
        console.log(a, JSON.stringify(results[a]));
      } catch (e) { results[a] = { error: String(e).slice(0, 300) }; console.log(a, 'ERR', e.message); }
      await d.close();
    }
  } finally { await L.close(); }
  save({ method: 'Chromium iPad portrait (isMobile, hasTouch), elementHandle.tap(), capture listeners in the area document', results });
}

const RUN = { static: partStatic, tap: () => partProbe('chromium', 'desktop'), usel: () => partProbe('webkit', 'ipad-portrait'), ring: partRing, flash: partFlash, over: partOver, scroll: partScroll, cls: partCls, latency: partLatency };
if (!RUN[part]) { console.log('parts:', Object.keys(RUN).join(' ')); process.exit(1); }
await RUN[part]();
