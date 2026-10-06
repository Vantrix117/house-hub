// Batch 9, Worker A: the shared map and look of the two Dollywood apps, on the local rig (Chromium; the cloud rig runs Chromium where Phase 3
// scripts say WebKit). Both flavours: the build guide (apps/dollywood.html, inside the hub's viewer) and the park map (apps/dollywood-live.html).
//   (1) VIS-DOLLYWOOD-2 / P4-SHAPE-03: controls under 44 px (a pseudo-element hit area counts, as the Phase 4 rig counts it) at 390 and 820:
//       the guide must read 0; the park map's are reported (the park map's own script is audits/tools/phase6/10/park-c-10.mjs)
//   (2) P4-TYPE-01 / GAP-TYPE-3: no rendered map text under 11 px at the default fit on the iPhone and the iPad (every <text> of the map svg,
//       its font size times the svg's screen scale)
//   (3) VIS-DOLLYWOOD-1: a done step reads --success-ink for its check and --text-2 for its title, contrast >= 4.5:1 in all six palettes
//   (4) P3-DOLLYWOOD-12 / -13: the View menu, the "?" panel, More and the "..." menu stay inside the viewport at 390 and 820
//   (5) P4-TELL-05: the guide's layout shift through the viewer (the chip strip's room is reserved from the first paint), CLS < 0.05
//   (6) UX-DOLLYWOOD-3: the phone's first screen: the map's top is at most 160 px from the top and at least 40 of the 68 attraction
//       markers are visible and not under the steps sheet
//   (7) UX-DOLLYWOOD-9: a card opened from a marker stays inside the visible part of the viewport (iPad portrait and desktop), also with
//       the map half scrolled off screen; its head stays while the body scrolls
//   (8) P3-DOLLYWOOD-16: Ctrl+D, Cmd+P, Alt+arrows change nothing and write no row; P3-DOLLYWOOD-17: the arrows scroll the page when the map is out of view
//       and pan it when the map has focus
//   (9) no horizontal scroll from 375 to 1440, default and XXL text, in both flavours
//  (10) VIS-DOLLYWOOD-6 / CONS-GLASS-2: no content surface of the guide has a backdrop blur (the Phase 4 rig's chrome-by-name rule)
//  (11) CONS-TYPE-6 / CONS-TOK-1 / CONS-TOK-3: no Fraunces / Archivo / generic family, no old local alias and no color-mix in either page's CSS
//  (12) VIS-DOLLYWOOD-8 / VIS-ICON-1: no native select arrow, spinner or search clear glyph; no glyph-as-icon in a button label
//  (13) P3-DOLLYWOOD-08: the step highlight's pulse runs three times and rests at full stroke
//   node "audits/tools/phase6/9/look-a-9.mjs"       ONLY=targets,text,done,popovers,cls,phone,cards,keys,hscroll,glass,source,native,pulse
//   OVERLAY=<dir under audits/> serves a folder holding apps/dollywood.html and apps/dollywood-live.html over the repo (a build not exported yet)
//   SHOTS=<dir> to keep the pictures (default audits/evidence/p6/9/look-a)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const ROOT = process.cwd();
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = s => !ONLY || ONLY.includes(s);
const EV = path.join(ROOT, 'audits', 'evidence', 'p6', '9'); fs.mkdirSync(EV, { recursive: true });
const SHOTS = process.env.SHOTS || path.join(EV, 'look-a'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 900)); } };
const info = (n, x) => console.log('  ·', n, x === undefined ? '' : JSON.stringify(x).slice(0, 700));
const FLAVOURS = [{ id: 'dollywood', name: 'guide' }, { id: 'dollywood-live', name: 'park map' }];
const PHONE = { n: '390x844', dev: 'iphone-pwa', w: 390, h: 844 }, IPAD = { n: '820x1180', dev: 'ipad-portrait', w: 820, h: 1180 }, DESK = { n: '1440x900', dev: 'desktop', w: 1440, h: 900 };
const html = fs.readFileSync(path.join(process.env.OVERLAY ? path.join(ROOT, process.env.OVERLAY) : ROOT, 'apps', 'dollywood.html'), 'utf8');
const htmlLive = fs.readFileSync(path.join(process.env.OVERLAY ? path.join(ROOT, process.env.OVERLAY) : ROOT, 'apps', 'dollywood-live.html'), 'utf8');

// Layout shifts and the like are watched from the very first frame of the app, in every frame of the page
const watch = ctx => ctx.addInitScript(() => { try { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {} });

// Every control the Phase 4 rig would count, with its effective size (an absolutely placed ::before / ::after counts as a hit area)
const TARGETS = () => {
  const IA = 'a[href], button, input:not([type=hidden]):not([type=file]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=switch], [role=checkbox], [tabindex]:not([tabindex="-1"])';
  const px = v => parseFloat(v) || 0, out = [], seen = new Set();
  const shown = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; if (e.hidden) return false; } return true; };
  const sel = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  for (const el of document.querySelectorAll(IA)) {
    if (seen.has(el) || !shown(el) || (el.closest('svg') && el.tagName !== 'svg')) continue; seen.add(el);
    if (el.tagName === 'LABEL' && el.control && seen.has(el.control)) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    if (parseFloat(getComputedStyle(el).opacity) < 0.05) continue;   // the invisible select laid over the basemap icon is measured through its wrapper
    let w = r.width, h = r.height;
    for (const pe of ['::before', '::after']) { const b = getComputedStyle(el, pe); if (b && b.content && b.content !== 'none' && b.position === 'absolute') { if (b.top !== 'auto' && b.bottom !== 'auto') h = Math.max(h, r.height - px(b.top) - px(b.bottom)); if (b.left !== 'auto' && b.right !== 'auto') w = Math.max(w, r.width - px(b.left) - px(b.right)); } }
    out.push({ sel: sel(el), label: (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 30), w: Math.round(w), h: Math.round(h), inline: el.tagName === 'A' && getComputedStyle(el).display === 'inline' });
  }
  return out;
};
const MAPTEXT = () => {
  const svg = document.getElementById('map'); if (!svg) return { n: 0, small: [] };
  const small = []; let n = 0;
  for (const t of svg.querySelectorAll('text')) {
    const cs = getComputedStyle(t); if (cs.display === 'none' || cs.visibility === 'hidden' || !t.textContent.trim()) continue;
    let hid = false; for (let e = t.parentElement; e && e !== svg; e = e.parentElement) if (getComputedStyle(e).display === 'none') { hid = true; break; }
    if (hid) continue;
    const r = t.getBoundingClientRect(); if (!r.width) continue; n++;
    const m = t.getScreenCTM(); const k = m ? Math.hypot(m.a, m.b) : 1; const px = parseFloat(cs.fontSize) * k;
    if (px < 10.99) small.push({ txt: t.textContent.slice(0, 18), cls: t.getAttribute('class'), px: +px.toFixed(1) });
  }
  return { n, small: small.slice(0, 12), count: small.length };
};
const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };

let L = await local({ variant: process.env.VARIANT || 'typical', clock: 'real', engine: 'chromium', overlay: process.env.OVERLAY });
const open = async (S, id, { profile = 'eli', mode = 'light' } = {}) => {
  await L.reset(process.env.VARIANT || 'typical');
  const d = await L.device({ device: S.dev, profile, mode, fixedTime: false });
  await watch(d.ctx);
  await d.page.setViewportSize({ width: S.w, height: S.h });
  const f = await d.openApp(id);
  await f.waitForFunction(() => typeof apply === 'function' && document.querySelector('#official .mk'), null, { timeout: 20000 }).catch(() => {});
  await sleep(1200);
  return { d, f };
};
try {
  // ── (1) targets under 44 ────────────────────────────────────────────────────────
  if (want('targets')) {
    console.log('\n## (1) controls under 44 px');
    for (const S of [PHONE, IPAD]) for (const F of FLAVOURS) {
      const { d, f } = await open(S, F.id);
      const all = new Map();
      const grab = async tag => { for (const t of await f.evaluate(TARGETS)) if (Math.min(t.w, t.h) < 43.5 && !t.inline) all.set(t.sel + '|' + t.label, { ...t, st: tag }); };
      await grab('default');
      if (F.id === 'dollywood') {
        for (const tab of ['layers', 'scale', 'list']) { await f.evaluate(t => document.querySelector(`[data-tab=${t}]`).click(), tab); await sleep(150); await grab('tab ' + tab); }
        await f.evaluate(() => { const m = document.getElementById('more-btn'); if (m && getComputedStyle(m).display !== 'none') m.click(); }); await sleep(150); await grab('more');
        await f.evaluate(() => { document.getElementById('view-btn').click(); }); await sleep(150); await grab('view menu');
        await f.evaluate(() => { document.getElementById('view-btn').click(); document.getElementById('help-btn').click(); }); await sleep(150); await grab('help'); await f.evaluate(() => document.getElementById('help-btn').click());
        await f.evaluate(() => { const b = document.getElementById('b-menu'); if (b) b.click(); }); await sleep(250); await grab('build menu'); await f.evaluate(() => { const b = document.getElementById('b-menu'); if (b) b.click(); });
        await f.evaluate(() => { try { showOfficial(OFFNUM[1]); } catch (e) {} }); await sleep(250); await grab('card');
        await f.evaluate(() => { try { closePop(); } catch (e) {} });
      } else {
        for (const sel of ['#lv-layers-tab', '#lv-family', '#lv-search', '#loc-near']) { await f.evaluate(s => { const b = document.querySelector(s); if (b) b.click(); }, sel); await sleep(150); await grab(sel); }
      }
      const list = [...all.values()];
      if (F.id === 'dollywood') ok(list.length === 0, `${F.name} ${S.n}: no control under 44 px (${list.length})`, list.slice(0, 20).map(t => `${t.sel} "${t.label}" ${t.w}x${t.h} [${t.st}]`));
      else info(`${F.name} ${S.n}: ${list.length} control(s) under 44 px (the park map's are audits/tools/phase6/10/park-c-10.mjs)`, list.slice(0, 12).map(t => `${t.sel} "${t.label}" ${t.w}x${t.h} [${t.st}]`));
      await d.close();
    }
  }

  // ── (2) map text >= 11 px at the default fit ──────────────────────────────────────
  if (want('text')) {
    console.log('\n## (2) rendered map text at the default fit');
    for (const S of [PHONE, IPAD]) for (const F of FLAVOURS) {
      const { d, f } = await open(S, F.id);
      const m = await f.evaluate(MAPTEXT);
      ok(m.count === 0, `${F.name} ${S.n}: ${m.n} map labels drawn, none under 11 px`, m.small);
      await d.shot(path.join(SHOTS, `${F.id}-${S.n}-default.png`));
      await d.close();
    }
  }

  // ── (3) a done step's contrast in the six palettes ─────────────────────────────────
  if (want('done')) {
    console.log('\n## (3) a done step: check in --success-ink, title in --text-2, >= 4.5:1 on the list in every palette');
    const { d, f } = await open(IPAD, 'dollywood');
    await f.waitForFunction(() => { const b = document.getElementById('b-done'); return b && !b.disabled; }, null, { timeout: 15000 }).catch(() => {});
    await f.evaluate(() => document.getElementById('b-done').click()); await sleep(500);
    const PAL = [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['forest', 'dark'], ['graphite', 'dark']];
    for (const [theme, scheme] of PAL) {
      await f.evaluate(([t, s]) => { document.documentElement.dataset.theme = t; document.documentElement.dataset.scheme = s; }, [theme, scheme]); await sleep(150);
      const r = await f.evaluate(() => {
        const it = document.querySelector('.bitem.ok'); if (!it) return null;
        const bg = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > 0.9)) return m.slice(0, 3).map(Number); } return [255, 255, 255]; };
        const rgb = c => c.match(/[\d.]+/g).slice(0, 3).map(Number);
        const mark = it.querySelector('span'), title = it.querySelector('b');
        return { strike: getComputedStyle(title).textDecorationLine, op: getComputedStyle(it).opacity, bg: bg(it), mark: rgb(getComputedStyle(mark).color), title: rgb(getComputedStyle(title).color), hasSvg: !!it.querySelector('svg.sym'), cur: it.classList.contains('cur') };
      });
      if (!r) { ok(false, `${theme}: a done step is listed`); continue; }
      ok(r.strike === 'none' && r.op === '1', `${theme}: no strike-through, no dimming (${r.strike}, opacity ${r.op})`);
      ok(r.hasSvg, `${theme}: the check is a sprite icon`);
      ok(ratio(r.title, r.bg) >= 4.5, `${theme}: title ${ratio(r.title, r.bg).toFixed(2)}:1`);
      ok(ratio(r.mark, r.bg) >= 4.5, `${theme}: check ${ratio(r.mark, r.bg).toFixed(2)}:1`);
    }
    await f.evaluate(() => document.getElementById('b-done').click());   // leave the rig as found
    await d.close();
  }

  // ── (4) popovers inside the viewport ────────────────────────────────────────────────
  if (want('popovers')) {
    console.log('\n## (4) popovers and menus stay inside the viewport');
    for (const S of [PHONE, IPAD]) {
      const { d, f } = await open(S, 'dollywood');
      const inside = async (name, openJs, id) => {
        await f.evaluate(openJs); await sleep(300);
        const r = await f.evaluate(id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), W: document.documentElement.clientWidth, H: innerHeight, wraps: getComputedStyle(e).whiteSpace }; }, id);
        if (!r) return ok(false, `${S.n}: ${name} opened`);
        ok(r.l >= 7.5 && r.r <= r.W - 7.5 && r.t >= -0.5 && r.b <= r.H + 0.5, `${S.n}: ${name} inside the viewport (${r.l}..${r.r} of ${r.W}, ${r.t}..${r.b} of ${r.H})`, r);
        await f.evaluate(openJs); await sleep(150);   // close it again with the same control (Escape in the viewer would close the app itself)
      };
      await f.evaluate(() => { const m = document.getElementById('more-btn'); if (m && getComputedStyle(m).display !== 'none') m.click(); });
      if (S.w >= 700) await inside('View menu', () => document.getElementById('view-btn').click(), 'vmenu');
      await inside('"?" panel', () => document.getElementById('help-btn').click(), 'help-pop');
      await inside('"..." menu', () => document.getElementById('b-menu').click(), 'bmenu');
      await d.close();
    }
  }

  // ── (5) the chip strip's layout shift ───────────────────────────────────────────────
  if (want('cls')) {
    console.log('\n## (5) layout shift through the viewer (P4-TELL-05)');
    for (const S of [PHONE, IPAD]) {
      const { d, f } = await open(S, 'dollywood');
      const m = await f.evaluate(() => ({ cls: window.__cls, minH: getComputedStyle(document.getElementById('chips')).minHeight, h: Math.round(document.getElementById('chips').getBoundingClientRect().height) }));
      ok(m.cls < 0.05, `${S.n}: CLS ${m.cls && m.cls.toFixed(4)} < 0.05; #chips min-height ${m.minH}, ${m.h} px tall`, m);
      await d.close();
    }
  }

  // ── (6) the phone's first screen ─────────────────────────────────────────────────────
  if (want('phone')) {
    console.log('\n## (6) the phone\'s first screen: map top and the attraction markers above the sheet');
    const { d, f } = await open(PHONE, 'dollywood');
    await sleep(800);
    const m = await f.evaluate(() => {
      const mb = document.getElementById('mapbox').getBoundingClientRect(), sheet = document.getElementById('build').getBoundingClientRect(), sv = document.getElementById('map').getBoundingClientRect();
      const attr = OFF.filter(o => o.cat === 'attraction' && o.pos); let vis = 0;
      for (const o of attr) { const r = o.el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx >= Math.max(0, sv.left) && cx <= Math.min(innerWidth, sv.right) && cy >= Math.max(0, sv.top) && cy <= Math.min(innerHeight, sv.bottom, sheet.top)) vis++; }
      return { top: Math.round(mb.top), total: attr.length, vis, sheetTop: Math.round(sheet.top), header: Math.round(document.querySelector('header').getBoundingClientRect().height), aspect: document.getElementById('map').getAttribute('preserveAspectRatio') };
    });
    ok(m.top <= 160, `390x844: the map's top is ${m.top} px from the top (<= 160)`, m);
    ok(m.vis >= 40, `390x844: ${m.vis} of ${m.total} attraction markers visible and above the sheet (>= 40)`, m);
    ok(m.aspect === 'xMidYMid slice', `390x844: the phone's map fills its box (${m.aspect})`);
    await d.shot(path.join(SHOTS, 'guide-390x844-first.png'));
    await d.close();
  }

  // ── (7) cards stay on screen ──────────────────────────────────────────────────────────
  if (want('cards')) {
    console.log('\n## (7) cards stay inside the visible viewport, 8 px in; the head stays while the body scrolls');
    for (const S of [IPAD, DESK]) {
      const { d, f } = await open(S, 'dollywood');
      for (const scroll of [0, 320]) {
        await f.evaluate(y => { window.scrollTo(0, y); }, scroll); await sleep(300);
        const pt = await f.evaluate(() => { const o = OFFNUM[1]; o.el.dispatchEvent(new Event('x')); const r = o.el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, vis: r.top > 0 && r.bottom < innerHeight }; });
        // open the card the way a tap does: through the map's pick path with the tap position remembered
        await f.evaluate(([x, y]) => { const r = svg.getBoundingClientRect(); lastPt = [x - r.left, y - r.top]; showOfficial(OFFNUM[1]); }, [pt.x, pt.y]); await sleep(300);
        const r = await f.evaluate(() => { const p = document.getElementById('pop'), b = p.getBoundingClientRect(), h = p.querySelector('.phead'), hb = h && h.getBoundingClientRect(); p.scrollTop = 40; const hb2 = h && h.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), W: document.documentElement.clientWidth, H: innerHeight, dock: p.classList.contains('dock'), mh: p.style.maxHeight, scrolls: p.scrollHeight > p.clientHeight, headStays: !!h && Math.abs((hb2.top - b.top) - (hb.top - b.top)) < 1.5, x: !!p.querySelector('.phead #pop-x') }; });
        ok(r.l >= 7.5 && r.r <= r.W - 7.5 && r.t >= 7.5 && r.b <= r.H - 7.5, `${S.n}, page scrolled ${scroll}: the card is inside the viewport, 8 px in (${r.l}..${r.r}, ${r.t}..${r.b} of ${r.W}x${r.H}${r.dock ? ', docked' : ''})`, r);
        ok(r.x, `${S.n}: the close button is in the sticky head`);
        if (r.scrolls) ok(r.headStays, `${S.n}: the head stays while the body scrolls`, r);
        await f.evaluate(() => closePop());
      }
      await d.close();
    }
  }

  // ── (8) keys ──────────────────────────────────────────────────────────────────────────
  if (want('keys')) {
    console.log('\n## (8) browser shortcuts are not ours; the arrows pan only the focused or mostly visible map');
    const { d, f } = await open(DESK, 'dollywood');
    const rows = async () => { const r = await L.apiAs('eli', '/api/data/dollywood?scope=person'); const b = r.body && (r.body.rows || r.body.data || r.body); return JSON.stringify((Array.isArray(b) ? b.map(x => x.key) : Object.keys(b || {})).filter(k => /^step:/.test(k)).sort()); };
    const before = await rows();
    const st = () => f.evaluate(() => JSON.stringify({ view: view.map(v => +v.toFixed(2)), done: Object.keys(doneMap).filter(k => doneMap[k]).length, tool, mode, y: Math.round(window.scrollY) }));
    const s0 = await st();
    const press = (key, mods) => f.evaluate(([key, mods]) => { const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }); (document.activeElement||document.body).dispatchEvent(e); return e.defaultPrevented; }, [key, mods]);
    const cases = [['d', { ctrlKey: true }], ['p', { metaKey: true }], ['s', { ctrlKey: true }], ['m', { metaKey: true }], ['ArrowLeft', { altKey: true }], ['ArrowRight', { altKey: true }], ['n', { ctrlKey: true }], ['0', { ctrlKey: true }], ['+', { ctrlKey: true }], ['-', { metaKey: true }]];
    for (const [k, m] of cases) { const prevented = await press(k, m); ok(!prevented, `${Object.keys(m)[0]}+${k}: not handled, the browser keeps it`); }
    await sleep(2500);
    ok(await st() === s0, 'the view, the ticks, the tool and the mode are unchanged after every shortcut', { before: s0, after: await st() });
    ok(await rows() === before, 'no row was written (Ctrl+D did not tick a step)');
    // the menus own the keys while they are open
    await f.evaluate(() => { document.getElementById('view-btn').click(); }); await sleep(200);
    const pw = await press('ArrowLeft', {}); ok(!pw && (await st()) === s0, 'with the View menu open the arrows do not pan the map');
    await f.evaluate(() => { document.getElementById('view-btn').click(); });
    // arrows: page body focus + the map mostly out of view -> the page scrolls (the handler lets the key through)
    await f.evaluate(() => { window.scrollTo(0, document.getElementById('mapbox').getBoundingClientRect().bottom + window.scrollY - 40); if (document.activeElement) document.activeElement.blur(); }); await sleep(400);
    const vis = await f.evaluate(() => { const r = document.getElementById('mapbox').getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height; });
    const v1 = await f.evaluate(() => view.join(','));
    const prevented = await press('ArrowDown', {});
    ok(vis < 0.5 && !prevented && (await f.evaluate(() => view.join(','))) === v1, `map ${Math.round(vis * 100)}% in view, body focused: ArrowDown is left to the page (not prevented, view unchanged)`);
    // a real key press scrolls the frame's page
    await f.evaluate(() => { window.focus(); }); const y0 = await f.evaluate(() => window.scrollY); await d.page.locator('#frame').focus().catch(() => {}); await d.page.keyboard.press('ArrowDown'); await sleep(300);
    info('a real ArrowDown moved the page from ' + y0 + ' to ' + await f.evaluate(() => window.scrollY));
    // the map in view and body focused -> pans; the map focused -> pans
    await f.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement) document.activeElement.blur(); }); await sleep(300);
    const v2 = await f.evaluate(() => view.join(',')); const pr2 = await press('ArrowRight', {});
    ok(pr2 && (await f.evaluate(() => view.join(','))) !== v2, 'map in view, body focused: ArrowRight pans the map');
    await f.evaluate(() => document.getElementById('mapbox').focus());
    const v3 = await f.evaluate(() => view.join(',')); const pr3 = await press('ArrowLeft', {});
    ok(pr3 && (await f.evaluate(() => view.join(','))) !== v3, 'map focused: ArrowLeft pans the map');
    ok(await f.evaluate(() => document.getElementById('mapbox').tabIndex === 0), 'the map box is focusable (tabindex 0)');
    await d.close();
  }

  // ── (9) no horizontal scroll ────────────────────────────────────────────────────────────
  if (want('hscroll')) {
    console.log('\n## (9) no horizontal scroll, 375 to 1440, default and XXL');
    for (const F of FLAVOURS) {
      const { d, f } = await open(PHONE, F.id);
      for (const w of [375, 390, 430, 744, 820, 1024, 1180, 1280, 1440]) for (const xxl of [false, true]) {
        await d.page.setViewportSize({ width: w, height: w < 700 ? 844 : 900 }); await f.evaluate(x => document.documentElement.setAttribute('data-text-size', x ? 'xxl' : 'normal'), xxl); await sleep(350);
        const m = await f.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
        ok(m.sw <= m.cw + 1 && m.bw <= m.cw + 1, `${F.name} ${w}${xxl ? ' XXL' : ''}: scrollWidth ${m.sw} <= ${m.cw}`, m);
      }
      await d.close();
    }
  }

  // ── (10) glass is chrome only ────────────────────────────────────────────────────────────
  if (want('glass')) {
    console.log('\n## (10) backdrop blur only on chrome (toolbar, sheets, floating buttons)');
    for (const S of [PHONE, IPAD, DESK]) {
      const { d, f } = await open(S, 'dollywood');
      await f.evaluate(() => { try { showOfficial(OFFNUM[1]); } catch (e) {} document.getElementById('view-btn') && document.getElementById('view-btn').click(); }); await sleep(300);
      const g = await f.evaluate(() => {
        const RX = /tabbar|topbar|toolbar|sheet|pill|nav|header|fab|dock|bar\b|menu|popover|dialog|modal|toast|switcher|composer|floating|float|controls/i, out = [];
        for (const el of document.querySelectorAll('*')) {
          const s = getComputedStyle(el), bf = s.backdropFilter || s.webkitBackdropFilter; if (!bf || bf === 'none') continue;
          const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || s.display === 'none' || s.visibility === 'hidden') continue;
          let pos = s.position; for (let e = el.parentElement; e && e !== document.body && !/fixed|sticky/.test(pos); e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') pos = p + '(ancestor)'; }
          const role = el.closest('[role]') && el.closest('[role]').getAttribute('role');
          const chrome = /fixed|sticky/.test(pos) || RX.test(el.id + ' ' + el.className) || /^(NAV|HEADER|FOOTER|DIALOG)$/.test(el.tagName) || /dialog|navigation|toolbar|tablist|menu/.test(role || '');
          out.push({ sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + String(el.className).split(' ')[0], chrome });
        }
        return out;
      });
      const content = g.filter(x => !x.chrome);
      ok(content.length === 0, `${S.n}: ${g.length} live blur layer(s), ${content.length} on content`, content);
      info(`${S.n}: blur layers: ${g.map(x => x.sel).join(', ') || 'none'}`);
      await d.close();
    }
  }

  // ── (11) the source: fonts, aliases, color-mix ──────────────────────────────────────────────
  if (want('source')) {
    console.log('\n## (11) fonts, aliases, color-mix in the two exports');
    for (const [name, src] of [['guide', html], ['park map', htmlLive]]) {
      const css = (src.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
      const fam = css.match(/font-family:[^;}]*/g) || [];
      const bad = fam.filter(x => /Fraunces|Archivo|Georgia|system-ui|sans-serif|serif|monospace/.test(x) && !/var\(--font-/.test(x));
      ok(bad.length === 0, `${name}: every font-family reads a --font-* token (${fam.length} declarations)`, bad);
      ok(!/Fraunces|Archivo/.test(css), `${name}: no Fraunces or Archivo in the page's CSS`);
      const alias = css.match(/var\(--(ink|panel|panel2|panel3|dim|sky|ochre|moss|forest|clay|cream)\b/g) || [];
      ok(alias.length === 0, `${name}: no old local alias is read (${alias.length})`, alias.slice(0, 8));
      ok(!/color-mix/.test(css), `${name}: no color-mix in the CSS`);
      const clamp = (css.match(/max\(var\(--fs-floor,0px\)/g) || []).length;
      ok(clamp === 0, `${name}: no max(var(--fs-floor,0px),calc(..)) size left (${clamp})`);
    }
  }

  // ── (12) native controls and glyph icons ─────────────────────────────────────────────────────
  if (want('native')) {
    console.log('\n## (12) drawn controls, icon buttons');
    const { d, f } = await open(IPAD, 'dollywood');
    await f.evaluate(() => document.querySelector('[data-tab=layers]').click()); await sleep(200);
    const m = await f.evaluate(() => {
      const sel = document.getElementById('bmap'), num = document.getElementById('sc-plot') || document.getElementById('sc-in'), q = document.getElementById('q'), cb = document.getElementById('l-seclab');
      const cs = (e, p) => e ? getComputedStyle(e)[p] : null;
      const glyph = [...document.querySelectorAll('button')].filter(b => /^[\s▾×↗✓−+⚑✕…?]+$/.test(b.textContent.trim()) && b.textContent.trim() && !b.querySelector('svg')).map(b => b.id || b.className);
      return { selApp: cs(sel, 'appearance'), numApp: cs(num, 'appearance'), qApp: cs(q, 'appearance'), cbApp: cs(cb, 'appearance'), cbW: cb && Math.round(cb.getBoundingClientRect().width), cbH: cb && Math.round(cb.getBoundingClientRect().height), cbOn: cs(cb, 'backgroundColor'), glyph, svgCount: document.querySelectorAll('svg.sym').length, qx: !!document.getElementById('q-x') };
    });
    ok(m.selApp === 'none', 'the basemap select is drawn (appearance none)', m);
    ok(m.numApp === 'textfield' || m.numApp === 'none', 'number fields have no spinners', m);
    ok(m.qApp === 'none' && m.qx, 'the search field has no native clear glyph and has its own x button', m);
    ok(m.cbApp === 'none' && m.cbW === 52 && m.cbH === 32, `a layer checkbox is the shared switch, 52 x 32 (${m.cbW}x${m.cbH})`, m);
    ok(m.glyph.length === 0, 'no button is a bare glyph', m.glyph);
    ok(m.svgCount > 10, `icons come from the sprite (${m.svgCount} svg.sym)`);
    await d.close();
  }

  // ── (13) the pulse ────────────────────────────────────────────────────────────────────────────
  if (want('pulse')) {
    console.log('\n## (13) the step highlight pulses three times and rests');
    const { d, f } = await open(IPAD, 'dollywood');
    const m = await f.evaluate(() => { const r = document.querySelector('#hl .hl-ring'); if (!r) return null; const s = getComputedStyle(r); return { name: s.animationName, n: s.animationIterationCount, dur: s.animationDuration, so: s.strokeOpacity, op: s.opacity }; });
    ok(m && m.name === 'hlring' && m.n === '3', 'the ring animation runs 3 iterations, not forever', m);
    await sleep(8500);
    const so = await f.evaluate(() => getComputedStyle(document.querySelector('#hl .hl-ring')).strokeOpacity);
    ok(so === '1', `after the loop it rests at full stroke (${so})`);
    await d.close();
  }

  // ── (14) chrome text is not selectable ─────────────────────────────────────────────────────────
  if (want('tells')) {
    console.log('\n## (14) CONS-TELL-1: labels and control text are not selectable');
    for (const [F, S] of [[FLAVOURS[0], IPAD], [FLAVOURS[1], PHONE]]) {
      const { d, f } = await open(S, F.id);
      if (F.id === 'dollywood') for (const tab of ['layers', 'scale']) { await f.evaluate(t => document.querySelector(`[data-tab=${t}]`).click(), tab); await sleep(100); }
      const bad = await f.evaluate(() => [...document.querySelectorAll('label, button, summary, a.btn, .tog, .vrow, .cle, .lv-src a, .tabs button')].filter(e => e.getClientRects().length && !e.closest('svg')).filter(e => { const s = getComputedStyle(e); return (s.userSelect || s.webkitUserSelect) !== 'none'; }).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0]));
      ok(bad.length === 0, `${F.name}: every label, button, summary and link-button has user-select: none (${bad.length} selectable)`, [...new Set(bad)].slice(0, 12));
      await d.close();
    }
  }

  // ── (15) profile labels, the cross-section pill, the measure pill ──────────────────────────────────
  if (want('cross')) {
    console.log('\n## (15) VIS-DOLLYWOOD-4 / UX-DOLLYWOOD-8 / VIS-DOLLYWOOD-14');
    for (const S of [PHONE, IPAD]) {
      const { d, f } = await open(S, 'dollywood');
      const cap = await f.evaluate(() => { const p = document.createElement('i'); p.style.cssText = 'position:absolute;visibility:hidden;font-size:var(--fs-caption2)'; document.body.appendChild(p); const v = parseFloat(getComputedStyle(p).fontSize); p.remove(); return v; });
      const px = async () => f.evaluate(() => { const sv = document.getElementById('prof'); const k = sv.getBoundingClientRect().width / 1000; return [...sv.querySelectorAll('text')].map(t => parseFloat(t.getAttribute('font-size')) * k); });
      const a = await px();
      ok(a.length > 0 && a.every(v => v >= cap - 0.1), `${S.n}: the profile's axis labels render at ${Math.min(...a).toFixed(1)} px >= --fs-caption2 (${cap} px)`);
      await d.page.setViewportSize({ width: S.w === 390 ? 430 : 700, height: S.h }); await sleep(900);
      const b = await px(); const cap2 = await f.evaluate(() => { const p = document.createElement('i'); p.style.cssText = 'position:absolute;visibility:hidden;font-size:var(--fs-caption2)'; document.body.appendChild(p); const v = parseFloat(getComputedStyle(p).fontSize); p.remove(); return v; });
      ok(b.length > 0 && b.every(v => v >= cap2 - 0.1), `${S.n}: after a resize they still render at ${Math.min(...b).toFixed(1)} px`);
      await d.page.setViewportSize({ width: S.w, height: S.h }); await sleep(600);
      // the cross-section: two taps, then the pill reads "Profile ready" and the profile is brought into view
      await f.evaluate(() => { setTool('section'); window.scrollTo(0, 0); }); await sleep(300);
      const box = await (await d.page.$('#frame')).boundingBox();
      const pts = await f.evaluate(() => { const r = document.getElementById('map').getBoundingClientRect(); return [[r.left + r.width * .35, r.top + r.height * .4], [r.left + r.width * .6, r.top + r.height * .5]]; });
      for (const [x, y] of pts) { await d.page.mouse.click(box.x + x, box.y + y); await sleep(250); }
      await sleep(1200);
      const t = await f.evaluate(() => { const h = document.getElementById('maphint'), w = document.querySelector('.profwrap').getBoundingClientRect(); return { txt: h.textContent, hidden: h.hidden, wTop: Math.round(w.top), wBot: Math.round(w.bottom), H: innerHeight, y: Math.round(scrollY) }; });
      ok(/Profile ready/.test(t.txt) && !t.hidden, `${S.n}: after the second point the pill reads "${t.txt}"`, t);
      ok(t.wTop >= -1 && t.wTop < t.H, `${S.n}: the profile is on screen after the cut (top ${t.wTop} of ${t.H})`, t);
      // the measure pill
      await f.evaluate(() => { setTool('measure'); window.scrollTo(0, 0); }); await sleep(300);
      const pts2 = await f.evaluate(() => { const r = document.getElementById('map').getBoundingClientRect(); return [[r.left + r.width * .3, r.top + r.height * .3], [r.left + r.width * .55, r.top + r.height * .35]]; });
      for (const [x, y] of pts2) { await d.page.mouse.click(box.x + x, box.y + y); await sleep(250); }
      const m = await f.evaluate(() => { const g = document.querySelector('#measure .mpill'); if (!g) return null; const t = g.querySelector('text'), r = g.querySelector('rect'), cs = getComputedStyle(t), k = t.getScreenCTM().a; return { txt: t.textContent, px: parseFloat(cs.fontSize) * k, fill: getComputedStyle(r).fill, halo: getComputedStyle(document.documentElement).getPropertyValue('--map-halo').trim(), w: r.getBoundingClientRect().width, tw: t.getBoundingClientRect().width }; });
      ok(m && m.px >= 10.9 && m.w >= m.tw, `${S.n}: the measure label is a pill at ${m && m.px.toFixed(1)} px (${m && m.txt})`, m);
      await d.close();
    }
  }

  // ── (16) listing labels: none over a marker or another label ──────────────────────────────────────
  if (want('labels')) {
    console.log('\n## (16) VIS-DOLLYWOOD-15: listing labels at section zoom');
    const { d, f } = await open(IPAD, 'dollywood');
    await f.evaluate(() => { selectSection('show', false); fitBox([470, 600, 560, 720], false); }); await sleep(1800);
    const r = await f.evaluate(() => {
      const names = [...document.querySelectorAll('#names text')].filter(t => t.style.display !== 'none' && t.getBoundingClientRect().width);
      const mk = [...document.querySelectorAll('.mk')].filter(m => m.style.display !== 'none').map(m => m.getBoundingClientRect());
      const rects = names.map(t => t.getBoundingClientRect()); let overl = 0, onMk = 0;
      for (let i = 0; i < rects.length; i++) { for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j]; if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) overl++; }
        const own = names[i]; for (const m of mk) { if (Math.abs((m.left + m.width / 2) - (rects[i].left - 15)) < 40 && Math.abs((m.top + m.height / 2) - (rects[i].top + rects[i].height / 2)) < 12) continue; const a = rects[i]; if (a.left < m.right - 2 && a.right > m.left + 2 && a.top < m.bottom - 2 && a.bottom > m.top + 2) onMk++; } }
      return { labels: names.length, overl, onMk };
    });
    ok(r.overl === 0, `Showstreet: ${r.labels} listing labels, none over another label`, r);
    info('labels over a foreign marker (the own marker is skipped by position)', r.onMk);
    await d.shot(path.join(SHOTS, 'guide-showstreet-labels.png'));
    await d.close();
  }

  // ── (17) the header on an iPad and the duplicate title ─────────────────────────────────────────────
  if (want('header')) {
    console.log('\n## (17) VIS-DOLLYWOOD-10 / UNFILED-1 / CONS-TYPE-1 / VIS-DOLLYWOOD-17');
    for (const S of [{ n: '820x1180', dev: 'ipad-portrait', w: 820, h: 1180 }, { n: '1180x820', dev: 'ipad-landscape', w: 1180, h: 820 }, DESK]) {
      const { d, f } = await open(S, 'dollywood');
      const m = await f.evaluate(() => { const h = document.querySelector('header'), art = h.querySelector('.hero-art').getBoundingClientRect(), st = h.querySelector('.stats').getBoundingClientRect(), hb = h.getBoundingClientRect(), h1 = document.querySelector('h1').getBoundingClientRect(), cs = getComputedStyle(document.querySelector('h1'));
        const srch = document.querySelector('.tg[data-l=Search]').getBoundingClientRect(), tools = document.querySelector('.toolbar .tg').getBoundingClientRect();
        return { H: Math.round(hb.height), oneRow: st.top < art.bottom && st.left > art.right, artW: Math.round(art.width), h1Visible: h1.width > 2 && h1.height > 2 && cs.clip === 'auto', h1InDom: !!document.querySelector('h1').textContent, searchTop: Math.round(srch.top), toolsTop: Math.round(tools.top), searchW: Math.round(srch.width) }; });
      ok(m.oneRow && m.artW === 96, `${S.n}: art (${m.artW} px), title block and the facts share one row`, m);
      if (S.w === 1180) ok(m.H <= 150, `${S.n}: the header is ${m.H} px tall (<= 150)`);
      ok(!m.h1Visible && m.h1InDom, `${S.n}: the h1 is kept for screen readers and not drawn (the viewer bar names the app)`, m);
      if (S.w >= 1280) ok(m.searchTop - m.toolsTop < 20 || m.searchW > 200, `${S.n}: the Search group flexes (${m.searchW} px wide)`, m);
      await d.shot(path.join(SHOTS, `guide-header-${S.n}.png`));
      await d.close();
    }
  }
} finally { await L.close(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
