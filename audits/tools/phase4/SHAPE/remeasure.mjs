// Phase 4 SHAPE — independent re-measurement (does not reuse analyze.mjs / verify.mjs / crops.mjs / cards.mjs or the rig raw).
// Own in-page DOM scans on the local instance (WebKit): side margins, explicit concentric pairs + a generic concentric scan,
// card/button boxes with elevation matched against each document's resolved --e1..--e4, sheet radii, upward shadows,
// spacing grid share on each area's main screen, kid target sizes, the Prayer toast Undo, adult targets < 44 on main screens.
//   node "audits/tools/phase4/SHAPE/remeasure.mjs"  → audits/evidence/p4/SHAPE/remeasure.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p4/SHAPE/remeasure.json');
const only = process.argv[2] || 'all';

const LIB = String.raw`
window.__rm = (() => {
  const px = v => parseFloat(v) || 0;
  const sel = el => { if (!el || !el.tagName) return ''; let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; const c = [...el.classList].slice(0, 3); if (c.length) s += '.' + c.join('.'); return s; };
  const path2 = el => (el.parentElement ? sel(el.parentElement) + ' > ' : '') + sel(el);
  const vw = () => document.documentElement.clientWidth;
  const vh = () => document.documentElement.clientHeight;
  const visible = (el, cs) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && px(cs.opacity) > 0.01; };
  const transparent = c => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c) || c === 'rgba(0, 0, 0, 0)';
  const paints = (el, cs) => !transparent(cs.backgroundColor) || cs.backgroundImage !== 'none' || px(cs.borderTopWidth) + px(cs.borderLeftWidth) + px(cs.borderRightWidth) + px(cs.borderBottomWidth) > 0 || (cs.boxShadow && cs.boxShadow !== 'none');
  const inFixed = el => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') { const r = e.getBoundingClientRect(); if (r.width >= 0.9 * vw() && r.height >= 0.6 * vh()) continue; return true; } } return false; };
  // the rect of el clipped by every ancestor that clips horizontally (scroll rails, overflow hidden)
  const clipRect = el => { const r = el.getBoundingClientRect(); let L = r.left, R = r.right; for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const ox = getComputedStyle(e).overflowX; if (ox !== 'visible') { const a = e.getBoundingClientRect(); L = Math.max(L, a.left); R = Math.min(R, a.right); } } return { left: L, right: R, width: R - L }; };
  const hasText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const radii = cs => ({ tl: px(cs.borderTopLeftRadius), tr: px(cs.borderTopRightRadius), br: px(cs.borderBottomRightRadius), bl: px(cs.borderBottomLeftRadius) });
  function elevTokens() {
    const probe = document.createElement('div'); document.body.appendChild(probe); const t = {};
    for (const k of ['e1', 'e2', 'e3', 'e4']) { probe.style.boxShadow = 'var(--' + k + ')'; t[k] = getComputedStyle(probe).boxShadow; }
    probe.remove(); return t;
  }
  function elev(shadow, T) { if (!shadow || shadow === 'none') return ['none']; const m = []; for (const k of ['e4', 'e3', 'e2', 'e1']) if (T[k] && T[k] !== 'none' && shadow.includes(T[k])) m.push(k); return m.length ? m : ['literal']; }
  function box(q, { root = document } = {}) {
    const el = typeof q === 'string' ? root.querySelector(q) : q; if (!el) return { q, found: false };
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), T = elevTokens();
    return { q: typeof q === 'string' ? q : sel(el), sel: sel(el), found: true, visible: visible(el, cs), x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      radius: radii(cs), padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px), border: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].map(px),
      shadow: cs.boxShadow, elev: elev(cs.boxShadow, T), bg: cs.backgroundColor, bgImage: cs.backgroundImage !== 'none', backdrop: cs.backdropFilter || cs.webkitBackdropFilter || 'none' };
  }
  function margins() {
    const W = vw(); let L = Infinity, R = -Infinity, ls = '', rs = '';
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el); if (!visible(el, cs)) continue;
      if (['SCRIPT', 'STYLE', 'TEMPLATE'].includes(el.tagName)) continue;
      const r0 = el.getBoundingClientRect(); if (r0.width >= W - 1) continue; const r = clipRect(el); if (r.width <= 0 || r.width >= W - 1) continue; if (r.right <= 0 || r.left >= W) continue;
      const leaf = hasText(el) || ['IMG', 'SVG', 'svg', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'CANVAS', 'VIDEO'].includes(el.tagName) || paints(el, cs);
      if (!leaf) continue; if (inFixed(el)) continue;
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      if (r.left < L) { L = r.left; ls = path2(el); } if (r.right > R) { R = r.right; rs = path2(el); }
    }
    return { vw: W, left: +L.toFixed(1), right: +(W - R).toFixed(1), span: +(R - L).toFixed(1), leftSel: ls, rightSel: rs };
  }
  const effR = (rv, w, h) => Math.min(rv, w / 2, h / 2);
  // corner geometry of inner (child) against outer (container)
  function pairGeom(o, i) {
    const oc = getComputedStyle(o), ic = getComputedStyle(i), orc = o.getBoundingClientRect(), irc = i.getBoundingClientRect();
    const oR = radii(oc), iR = radii(ic);
    const corners = [
      ['tl', irc.left - orc.left, irc.top - orc.top], ['tr', orc.right - irc.right, irc.top - orc.top],
      ['br', orc.right - irc.right, orc.bottom - irc.bottom], ['bl', irc.left - orc.left, orc.bottom - irc.bottom]];
    let best = null;
    for (const [k, dx, dy] of corners) { const R = effR(oR[k], orc.width, orc.height); if (R <= 0) continue; const ins = Math.max(dx, dy); if (dx < 0 || dy < 0) continue; if (!best || ins < best.inset) best = { corner: k, dx: +dx.toFixed(1), dy: +dy.toFixed(1), inset: +ins.toFixed(1), R: +R.toFixed(1), r: +effR(iR[k], irc.width, irc.height).toFixed(1) }; }
    if (!best) return null;
    best.want = +(best.R - best.inset).toFixed(1); best.off = +Math.abs(best.r - Math.max(0, best.want)).toFixed(1);
    best.inCurve = best.inset < best.R; best.bad = best.inCurve && Math.abs(best.r - best.want) > Math.max(3, 0.25 * best.R);
    return best;
  }
  function conc(outerQ, innerQ) {
    const o = document.querySelector(outerQ); if (!o) return { outerQ, innerQ, found: 'no outer' };
    const i = o.querySelector(innerQ); if (!i) return { outerQ, innerQ, found: 'no inner' };
    return { outerQ, innerQ, outer: sel(o), inner: sel(i), ...pairGeom(o, i) };
  }
  function concScan() {
    const pairs = new Map();
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el); if (!visible(el, cs) || !paints(el, cs)) continue;
      const rr = radii(cs); if (Math.max(rr.tl, rr.tr, rr.br, rr.bl) <= 0) continue;
      let a = el.parentElement;
      for (; a && a !== document.body; a = a.parentElement) { const ac = getComputedStyle(a); const ar = radii(ac); if (Math.max(ar.tl, ar.tr, ar.br, ar.bl) > 0 && paints(a, ac) && visible(a, ac)) break; }
      if (!a || a === document.body) continue;
      const g = pairGeom(a, el); if (!g || !g.inCurve) continue;
      const key = path2(a) + ' || ' + sel(el);
      if (!pairs.has(key)) pairs.set(key, { outer: path2(a), inner: sel(el), ...g, n: 0 });
      pairs.get(key).n++;
    }
    const list = [...pairs.values()];
    return { distinctPairs: list.length, bad: list.filter(p => p.bad).length, pairs: list };
  }
  function spacing() {
    const vals = [];
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el); if (!visible(el, cs)) continue; if (el.closest('svg')) continue;
      for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft']) { const v = px(cs[p]); if (v !== 0) vals.push({ p, v: Math.abs(v), s: sel(el) }); }
      if (/flex|grid/.test(cs.display)) for (const p of ['rowGap', 'columnGap']) { if (cs[p] === 'normal') continue; const v = px(cs[p]); if (v) vals.push({ p, v, s: sel(el) }); }
    }
    const on4 = v => Math.abs(v / 4 - Math.round(v / 4)) < 0.01;
    const macro = vals.filter(x => x.v >= 8);
    const off = {}; for (const x of macro) if (!on4(x.v)) { const k = x.v + ' ' + x.p.replace(/Top|Right|Bottom|Left/, '') + ' ' + x.s; off[k] = (off[k] || 0) + 1; }
    return { n: vals.length, grid4: +(vals.filter(x => on4(x.v)).length / vals.length).toFixed(3), macroN: macro.length, macroGrid4: +(macro.filter(x => on4(x.v)).length / macro.length).toFixed(3),
      topOffMacro: Object.entries(off).sort((a, b) => b[1] - a[1]).slice(0, 8) };
  }
  function targets(min) {
    const W = vw(), H = vh(), out = new Map();
    const q = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=checkbox]';
    for (const el of document.querySelectorAll(q)) {
      const cs = getComputedStyle(el); if (!visible(el, cs)) continue; if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
      const r = el.getBoundingClientRect(); if (r.bottom <= 0 || r.right <= 0 || r.left >= W || r.top >= H) continue;
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), W - 1), cy = Math.min(Math.max(r.top + r.height / 2, 0), H - 1);
      const hit = document.elementFromPoint(cx, cy); if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) continue;
      if (r.width < min || r.height < min) { const k = path2(el); const cur = out.get(k); if (!cur) out.set(k, { sel: k, w: +r.width.toFixed(1), h: +r.height.toFixed(1), n: 1, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30) }); else cur.n++; }
    }
    return [...out.values()];
  }
  function rootInfo() { const h = document.documentElement; return { theme: h.dataset.theme || null, scheme: h.dataset.scheme || null, kind: h.dataset.kind || null, vw: vw(), vh: vh() }; }
  return { box, margins, conc, concScan, spacing, targets, elevTokens, rootInfo, sel };
})();
`;

async function inject(f) { await f.evaluate(src => { if (!window.__rm) (0, eval)(src); }, LIB); }
const ev = async (f, fn, arg) => { await inject(f); return f.evaluate(fn, arg); };

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const R = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { note: 'Independent re-measurement for Phase 4 SHAPE (own DOM scans; WebKit; typical household; demo clock). Values are CSS px.', runs: {} };  // runs merge: each mode replaces only its own key
const save = () => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1)); };

async function setTheme(profile, theme) {
  const r = await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } });
  return r.status;
}
async function open(device, profile, target, { mode = 'light', theme } = {}) {
  const ls = theme && theme !== 'system' ? { 'hub.theme': JSON.stringify(theme) } : null;
  const d = await L.device({ device, profile, mode, localStorage: ls });
  let f;
  if (target.startsWith('#')) { await d.goto(target); f = d.page.mainFrame(); }
  else f = await d.openApp(target);
  await sleep(2500);
  return { d, f };
}

const APPS = ['f260', 'leftovers', 'prayer', 'tally', 'timer', 'kidverse', 'verses', 'dollywood', 'dollywood-live'];

try {
  // ── 1. side margins on three devices ─────────────────────────────
  if (only === 'all' || only === 'margins') {
    R.runs.margins = [];
    for (const device of ['iphone-pwa', 'ipad-portrait', 'ipad-landscape']) {
      for (const area of ['#home', ...APPS]) {
        try {
          const { d, f } = await open(device, 'eli', area);
          const m = await ev(f, () => __rm.margins());
          R.runs.margins.push({ device, area: area === '#home' ? 'shell' : area, ...m });
          console.log('margins', device, area, m.left, m.right, m.span, m.leftSel, '|', m.rightSel);
          await d.close();
        } catch (e) { R.runs.margins.push({ device, area, error: String(e).slice(0, 200) }); console.log('ERR', device, area, e.message); }
      }
      save();
    }
  }

  // ── 2. explicit concentric pairs, cards, buttons, sheets, shadows (iPad portrait, eli; themes spread) ─
  if (only === 'undo') {
    const { d, f } = await open('ipad-portrait', 'eli', 'prayer');
    await f.evaluate(() => toast('Moved to the record.', 'Undo', () => {})); await sleep(700);
    R.runs.undo = { toast: await ev(f, () => __rm.box('#toast')), act: await ev(f, () => __rm.box('#toastAct')), text: await f.evaluate(() => document.querySelector('#toastAct').textContent) };
    console.log(JSON.stringify(R.runs.undo).slice(0, 600));
    await d.page.screenshot({ path: path.join(ROOT, 'audits/evidence/p4/SHAPE/remeasure-prayer-undo.png'), scale: 'css', animations: 'disabled', clip: { x: 0, y: Math.max(0, d.page.viewportSize().height - 260), width: d.page.viewportSize().width, height: 260 } });
    await d.close(); save();
  }
  if (only === 'all' || only === 'boxes') {
    R.runs.boxes = [];
    const push = (area, theme, what, v) => { R.runs.boxes.push({ area, theme, what, ...v }); console.log(area, theme, what, JSON.stringify(v).slice(0, 260)); };
    for (const theme of ['system', 'midnight']) {
      await L.reset('typical');
      if (theme !== 'system') console.log('theme PUT', await setTheme('eli', theme));
      // shell Home
      { const { d, f } = await open('ipad-portrait', 'eli', '#home', { theme });
        push('shell', theme, 'root', await ev(f, () => __rm.rootInfo()));
        push('shell', theme, 'home .gcard', await ev(f, () => __rm.box('.glance > .card.gcard')));
        push('shell', theme, 'home .card', await ev(f, () => __rm.box('#views .card')));
        push('shell', theme, 'conc gcard/.btn', await ev(f, () => __rm.conc('.glance > .card.gcard', '.btn')));
        push('shell', theme, 'tabbar', await ev(f, () => __rm.box('#tabbar')));
        push('shell', theme, 'home .btn', await ev(f, () => __rm.box('#views .btn')));
        // sheet radius via a probe in the shell's .ds context
        push('shell', theme, 'sheet probe', await ev(f, () => { const bd = document.createElement('div'); bd.className = 'sheet-backdrop'; bd.style.visibility = 'hidden'; const s = document.createElement('div'); s.className = 'sheet'; s.textContent = 'x'; bd.appendChild(s); document.body.appendChild(bd); const b = __rm.box(s); bd.remove(); return b; }));
        if (theme === 'system') push('shell', theme, 'concScan home', await ev(f, () => { const c = __rm.concScan(); return { distinctPairs: c.distinctPairs, bad: c.bad, pairs: c.pairs.map(p => [p.outer, p.inner, p.R, p.inset, p.r, p.want, p.bad]) }; }));
        if (theme === 'system') push('shell', theme, 'spacing home', await ev(f, () => __rm.spacing()));
        await d.close(); }
      // shell Me
      { const { d, f } = await open('ipad-portrait', 'eli', '#me', { theme });
        push('shell', theme, 'me card', await ev(f, () => __rm.box('.me-grid > .card.glass')));
        push('shell', theme, 'conc me/#syncnow', await ev(f, () => __rm.conc('.me-grid > .card.glass:has(#syncnow)', '#syncnow')));
        if (theme === 'system') push('shell', theme, 'concScan me', await ev(f, () => { const c = __rm.concScan(); return { distinctPairs: c.distinctPairs, bad: c.bad, pairs: c.pairs.map(p => [p.outer, p.inner, p.R, p.inset, p.r, p.want, p.bad]) }; }));
        await d.close(); }
      const appBoxes = {
        f260: ['h1', 'section.week', 'section#today', '#todayDone', 'section.today', '.hero', '.modal .card'],
        leftovers: ['.item', 'form#add', 'button.log', '.done', '#name'],
        prayer: ['#todayDate', '.ledger', '#startPray', '#sheet', 'nav', 'nav .inner'],
        timer: ['#go', '.dial', 'button[data-s]'],
        tally: ['#plus', '#minus', '#reset', '.dial'],
        kidverse: ['section#story', '#story-say', '.card', '#done'],
        verses: ['#trainer', '#show', '.card.grown'],
        dollywood: ['.tabs button[role=tab]', 'header', '.pop', '.wrap'],
        'dollywood-live': ['#lv-sheet', '#lv-handle', '.lv-tabs button', '.pop'],
      };
      const appConc = { leftovers: [['form#add', '#name'], ['form#add', 'button.log']], kidverse: [['section#story', '#story-say']], verses: [['#trainer', '#show']], prayer: [['#sheet', '.ask']] };
      for (const app of APPS) {
        try {
          const { d, f } = await open('ipad-portrait', 'eli', app, { theme });
          push(app, theme, 'root', await ev(f, () => __rm.rootInfo()));
          for (const q of appBoxes[app] || []) push(app, theme, q, await ev(f, q => __rm.box(q), q));
          for (const [o, i] of appConc[app] || []) push(app, theme, 'conc ' + o + '/' + i, await ev(f, ([o, i]) => __rm.conc(o, i), [o, i]));
          if (theme === 'system') {
            push(app, theme, 'concScan', await ev(f, () => { const c = __rm.concScan(); return { distinctPairs: c.distinctPairs, bad: c.bad, pairs: c.pairs.map(p => [p.outer, p.inner, p.R, p.inset, p.r, p.want, p.bad]) }; }));
            push(app, theme, 'spacing', await ev(f, () => __rm.spacing()));
            push(app, theme, 'targets<44', await ev(f, () => __rm.targets(44)));
          }
          if (app === 'prayer' && theme === 'system') {
            const t = await f.evaluate(async () => { try { toast('Moved to the record.', 'Undo', () => {}); } catch (e) { return { err: String(e) }; } await new Promise(r => setTimeout(r, 700)); return null; });
            push(app, theme, 'toast call', { t });
            push(app, theme, 'toast', await ev(f, () => __rm.box('#toast')));
            push(app, theme, 'toastAct', await ev(f, () => __rm.box('#toastAct')));
            await d.page.screenshot({ path: path.join(ROOT, 'audits/evidence/p4/SHAPE/remeasure-prayer-undo.png'), scale: 'css', animations: 'disabled', clip: { x: 0, y: Math.max(0, d.page.viewportSize().height - 260), width: d.page.viewportSize().width, height: 260 } });
          }
          await d.close();
        } catch (e) { push(app, theme, 'error', { e: String(e).slice(0, 200) }); }
      }
      save();
    }
  }

  // ── 2b. TV board (kiosk) and the Verses trainer after "Show" ──────
  if (only === 'all' || only === 'extra') {
    await L.reset('typical');
    R.runs.extra = [];
    const push = (area, what, v) => { R.runs.extra.push({ area, what, ...v }); console.log('X', area, what, JSON.stringify(v).slice(0, 400)); };
    { const { d, f } = await open('tv', 'tv', '#home');
      push('tv', 'root', await ev(f, () => __rm.rootInfo()));
      push('tv', 'panes', await ev(f, () => [...document.querySelectorAll('.tv-pane')].filter(e => e.getBoundingClientRect().width > 0).map(e => __rm.box(e))));
      push('tv', 'margins', await ev(f, () => __rm.margins()));
      push('tv', 'concScan', await ev(f, () => { const c = __rm.concScan(); return { distinctPairs: c.distinctPairs, bad: c.bad, pairs: c.pairs.map(p => [p.outer, p.inner, p.R, p.inset, p.r, p.want, p.bad]) }; }));
      push('tv', 'spacing', await ev(f, () => __rm.spacing()));
      push('tv', 'targets<44', await ev(f, () => __rm.targets(44)));
      await d.close(); }
    { const { d, f } = await open('ipad-portrait', 'eli', 'verses');
      await f.click('#show').catch(e => push('verses', 'click', { e: String(e).slice(0, 120) }));
      await sleep(800);
      push('verses', 'after show conc', await ev(f, () => [...document.querySelectorAll('#trainer button')].filter(b => b.getBoundingClientRect().width > 0).map(b => { const g = __rm.conc('#trainer', '#' + (b.id || '___')); return { b: __rm.sel(b), R: g.R, dx: g.dx, dy: g.dy, inset: g.inset, r: g.r, want: g.want, bad: g.bad }; })));
      push('verses', 'after show concScan', await ev(f, () => { const c = __rm.concScan(); return { distinctPairs: c.distinctPairs, bad: c.bad, pairs: c.pairs.map(p => [p.outer, p.inner, p.R, p.inset, p.r, p.want, p.bad]) }; }));
      await d.close(); }
    save();
  }

  // ── 3. kid mode (Ezra) targets and radii ──────────────────────────
  if (only === 'all' || only === 'kid') {
    await L.reset('typical');
    R.runs.kid = [];
    const push = (area, device, what, v) => { R.runs.kid.push({ area, device, what, ...v }); console.log('KID', area, device, what, JSON.stringify(v).slice(0, 300)); };
    for (const device of ['ipad-portrait', 'ipad-landscape']) {
      const { d, f } = await open(device, 'ezra', '#home');
      push('shell', device, 'root', await ev(f, () => __rm.rootInfo()));
      push('shell', device, 'tab', await ev(f, () => __rm.box('#tabbar .tab')));
      push('shell', device, 'targets<64', await ev(f, () => __rm.targets(64)));
      await d.close();
    }
    for (const [device, profile] of [['iphone-pwa', 'eli'], ['ipad-portrait', 'ezra']]) {
      const { d, f } = await open(device, profile, 'verses');
      const scan = () => ev(f, () => { const c = __rm.concScan(); return { distinctPairs: c.distinctPairs, bad: c.bad, pairs: c.pairs.map(p => [p.outer, p.inner, p.R, p.dx, p.dy, p.r, p.want, p.bad]) }; });
      push('verses', device, profile + ' concScan before show', await scan());
      if (await f.$('#show:visible')) { await f.click('#show').catch(() => {}); await sleep(800); push('verses', device, profile + ' concScan after show', await scan()); }
      if (profile === 'ezra') push('verses', device, 'kid targets<64', await ev(f, () => __rm.targets(64)));
      await d.close();
    }
    const kidBoxes = { leftovers: ['.done', '#size', '#date', '#name', 'button.log', '#copy'], 'dollywood-live': ['#lv-handle', '.lv-tabs button'], kidverse: ['.actions .btn', '#done', '#story-say'], tally: ['#plus', '#minus', '#reset'], prayer: [], timer: ['#go'], verses: [] };
    for (const app of Object.keys(kidBoxes)) {
      try {
        const { d, f } = await open('ipad-portrait', 'ezra', app);
        push(app, 'ipad-portrait', 'root', await ev(f, () => __rm.rootInfo()));
        for (const q of kidBoxes[app]) push(app, 'ipad-portrait', q, await ev(f, q => __rm.box(q), q));
        push(app, 'ipad-portrait', 'targets<64', await ev(f, () => __rm.targets(64)));
        await d.close();
      } catch (e) { push(app, 'ipad-portrait', 'error', { e: String(e).slice(0, 200) }); }
    }
    save();
  }
} finally {
  save();
  await L.close();
}
console.log('wrote', OUT);
