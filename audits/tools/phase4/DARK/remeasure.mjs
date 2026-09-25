// Phase 4 DARK — independent re-measurement of the investigator's key numbers (own code; shares only the harness).
//   node audits/tools/phase4/DARK/remeasure.mjs [webkit|chromium|static]   → audits/evidence/p4/DARK/remeasure-<engine>.json
// Method: every "rendered" background is the median pixel of a 1x CSS screenshot of the element's box taken with the
// element's own text made transparent (and, for a select, the right 28 px arrow column and a 4 px inset skipped);
// the foreground is the element's computed colour/stroke. Token math is resolved by the browser (probe elements in a
// document under the theme) and the WCAG 2 ratio / OKLCH are computed here. Everything runs on the local rig.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT, DEMO } from '../../lib/local.mjs';

const mode = process.argv[2] || 'webkit';
const OUT = path.join(ROOT, 'audits/evidence/p4/DARK');

// ── colour math ──────────────────────────────────────────────────────────────────────────────────────────────
function parse(s) {
  if (!s) return null; s = s.trim();
  let m = s.match(/^#([0-9a-f]{6})$/i); if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = s.match(/^rgba?\(([^)]+)\)$/); if (m) { const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
  m = s.match(/^color\(srgb ([^)]+)\)$/); if (m) { const p = m[1].split(/[ \/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
  return null;
}
const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const over = (fg, bg) => { const a = fg[3] ?? 1; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)).concat(1); };
function oklch(c) {
  const [r, g, b] = c.slice(0, 3).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L: +L.toFixed(3), C: +Math.hypot(A, B).toFixed(3) };
}

// ── static checks (no browser) ────────────────────────────────────────────────────────────────────────────────
function staticChecks() {
  const css = fs.readFileSync(path.join(ROOT, 'apps/design.css'), 'utf8');
  const lines = css.split('\n');
  // blocks: selector line → the declarations up to the closing brace at the same nesting
  const block = startLine => { const out = {}; let depth = 0, started = false; for (let i = startLine - 1; i < lines.length; i++) { const L = lines[i]; for (const ch of L) { if (ch === '{') { depth++; started = true; } if (ch === '}') depth--; } for (const m of L.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[m[1]] = m[2].trim().replace(/\s+/g, ' '); if (started && depth <= (startLine === 177 ? 0 : 0)) return out; } return out; };
  const find = re => lines.findIndex(l => re.test(l)) + 1;
  const at = {
    hearth: find(/^:root \{/), parchment: find(/^:root\[data-theme="parchment"\]/), frost: find(/^:root\[data-theme="frost"\]/),
    midnight: find(/^:root\[data-theme="midnight"\]/), systemDark: find(/^\s+:root:not\(\[data-theme\]\) \{/), forest: find(/^:root\[data-theme="forest"\]/),
    tpForest: find(/^\.tp\[data-preview="forest"\] \{/), tpNight: find(/^\.tp\[data-preview="system"\] \.tp-half/),
  };
  const B = Object.fromEntries(Object.entries(at).map(([k, l]) => [k, { line: l, tokens: block(l) }]));
  const colourish = v => /#[0-9a-f]{3,8}\b|rgba?\(|color-mix|\d+%$/i.test(v) && !/^var\(/.test(v);
  const hearthColour = Object.entries(B.hearth.tokens).filter(([, v]) => colourish(v)).map(([k]) => k);
  const missing = {}; for (const k of ['parchment', 'frost', 'midnight', 'systemDark', 'forest']) missing[k] = hearthColour.filter(t => !(t in B[k].tokens));
  const drift = (a, b) => Object.keys(B[a].tokens).filter(t => B[b].tokens[t] !== undefined && B[a].tokens[t].replace(/\s/g, '') !== B[b].tokens[t].replace(/\s/g, '')).map(t => ({ t, [a]: B[a].tokens[t], [b]: B[b].tokens[t] }));
  const literalCopies = { midnightSurface241E19: lines.map((l, i) => /--surface:\s*#241E19/i.test(l) ? i + 1 : 0).filter(Boolean), forestSurface182225: lines.map((l, i) => /--surface:\s*#182225/i.test(l) ? i + 1 : 0).filter(Boolean) };
  // art
  const svgs = []; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.svg')) svgs.push(p); } }; walk(path.join(ROOT, 'art'));
  const art = svgs.map(f => { const t = fs.readFileSync(f, 'utf8'); return { f: path.relative(ROOT, f).replace(/\\/g, '/'), currentColor: (t.match(/currentColor/g) || []).length, cssVar: (t.match(/var\(--/g) || []).length, pcs: (t.match(/prefers-color-scheme/g) || []).length }; });
  // midnight / forest palette math from the literal blocks
  const tok = (b, t) => parse(B[b].tokens[t]);
  const pal = {};
  for (const th of ['midnight', 'forest', 'hearth']) {
    const card = tok(th, '--surface'), page = tok(th, '--bg'), s2 = tok(th, '--surface-2');
    const soft = {}; for (const f of ['mocha', 'gold', 'olive', 'teal', 'terra', 'slate']) { const c = tok(th, `--${f}-soft`); soft[f] = { hex: hex(c), vsCard: ratio(c, card), ...oklch(c) }; }
    pal[th] = { cardVsPage: ratio(card, page), surface2VsCard: ratio(s2, card), surface2DarkerThanCard: lum(s2) < lum(card), soft };
  }
  return { blocks: Object.fromEntries(Object.entries(B).map(([k, v]) => [k, { line: v.line, count: Object.keys(v.tokens).length }])), hearthColourTokens: hearthColour.length, missing, drift: { 'midnight~systemDark': drift('midnight', 'systemDark'), 'midnight~tpNight': drift('midnight', 'tpNight'), 'forest~tpForest': drift('forest', 'tpForest') }, literalCopies, art: { total: art.length, withAnyAdaptive: art.filter(a => a.currentColor || a.cssVar || a.pcs).map(a => a.f) }, pal };
}

if (mode === 'static') {
  const r = staticChecks();
  fs.writeFileSync(path.join(OUT, 'remeasure-static.json'), JSON.stringify(r, null, 1));
  console.log(JSON.stringify({ blocks: r.blocks, hearthColourTokens: r.hearthColourTokens, missing: r.missing, drift: r.drift, literalCopies: r.literalCopies, art: r.art, pal: r.pal }, null, 1));
  process.exit(0);
}

// ── browser helpers ───────────────────────────────────────────────────────────────────────────────────────────
const L = await local({ variant: 'typical', clock: 'demo', engine: mode });
const results = [];
const log = (k, v) => { results.push({ k, ...v }); console.log(k, JSON.stringify(v)); };
async function setTheme(profile, theme) {
  // last write wins by updated_at: when the stored row is newer, write again one ms after it
  let r = await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme, updated_at: DEMO - 1000 } });
  if (r.body && r.body.applied === false) r = await L.apiAs(profile, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme, updated_at: r.body.updated_at + 1 } });
  return { status: r.status, applied: r.body && r.body.applied, value: r.body && r.body.value };
}
async function dev({ device = 'ipad-portrait', os = 'light', profile = 'eli', theme = 'system', localTheme = true } = {}) {
  const put = await setTheme(profile, theme);
  const extra = localTheme && theme !== 'system' ? { 'hub.theme': JSON.stringify(theme) } : null;
  const d = await L.device({ device, mode: os, profile, localStorage: extra });
  d.put = put; return d;
}
// median pixel of a page-space rect, decoded inside the page through a canvas
async function medianRect(page, rect, { inset = 4, skipRight = 0, fg = null } = {}) {
  const clip = { x: Math.max(0, rect.x + inset), y: Math.max(0, rect.y + inset), width: Math.max(1, rect.width - 2 * inset - skipRight), height: Math.max(1, rect.height - 2 * inset) };
  const buf = await page.screenshot({ clip, scale: 'css', animations: 'disabled', caret: 'hide' });
  return page.evaluate(async ([b64, fg]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; const ch = [[], [], []];
    for (let i = 0; i < d.length; i += 4) { ch[0].push(d[i]); ch[1].push(d[i + 1]); ch[2].push(d[i + 2]); }
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    let p10 = null;
    if (fg) { const lf = lum(fg); const rs = []; for (let i = 0; i < d.length; i += 4) { const lb = lum([d[i], d[i + 1], d[i + 2]]); rs.push((Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05)); } rs.sort((a, b) => a - b); p10 = +rs[Math.floor(rs.length * 0.1)].toFixed(2); }
    const med = ch.map(a => { a.sort((p, q) => p - q); return a[a.length >> 1]; });
    return fg ? { med, p10 } : med;
  }, [buf.toString('base64'), fg]);
}
// computed text colour of el vs its rendered background (text hidden)
async function textVsRendered(d, frame, sel, opts = {}) {
  const loc = frame.locator(sel).first();
  await loc.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  const info = await loc.evaluate((e, prop) => { const s = getComputedStyle(e); return { color: s[prop || 'color'], bg: s.backgroundColor, fs: s.fontSize, fw: s.fontWeight, text: (e.textContent || '').trim().slice(0, 40), scheme: document.documentElement.dataset.scheme, theme: document.documentElement.dataset.theme || null, cs: s.colorScheme, appearance: s.appearance || s.webkitAppearance }; }, opts.prop);
  const box = await loc.boundingBox();
  await loc.evaluate(e => { e.dataset.rmOld = e.getAttribute('style') || ''; e.style.setProperty('color', 'transparent', 'important'); e.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); e.style.setProperty('text-shadow', 'none', 'important'); for (const c of e.querySelectorAll('*')) { c.style.setProperty('color', 'transparent', 'important'); c.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); if (c.tagName === 'svg' || c.closest('svg')) c.style.setProperty('visibility', 'hidden', 'important'); } });
  await sleep(150);
  const fgc = parse(info.color);
  const m = await medianRect(d.page, box, { ...opts, fg: fgc.slice(0, 3) }); const fill = m.med;
  await loc.evaluate(e => { e.setAttribute('style', e.dataset.rmOld); delete e.dataset.rmOld; for (const c of e.querySelectorAll('*')) { c.style.removeProperty('color'); c.style.removeProperty('-webkit-text-fill-color'); c.style.removeProperty('visibility'); } });
  return { ...info, box: box && { w: Math.round(box.width), h: Math.round(box.height) }, renderedFill: hex(fill), ratio: ratio(over(fgc, fill), fill), p10: m.p10 };
}
const settle = ms => sleep(ms || 2500);

// ── WebKit / Chromium cases ───────────────────────────────────────────────────────────────────────────────────
async function selectCase(theme, os, { inject } = {}) {
  const d = await dev({ os, theme });
  const f = await d.openApp('leftovers', { wait: '#size' }); await settle();
  if (inject) await f.evaluate(cs => { const s = document.createElement('style'); s.textContent = `:root{color-scheme:${cs} !important}`; document.head.appendChild(s); }, inject);
  await sleep(300);
  const r = await textVsRendered(d, f, '#size', { inset: 4, skipRight: 28 });
  log(`larder #size ${mode} ${theme}/${os}${inject ? ' +color-scheme:' + inject : ''}`, { put: d.put, ...r });
  await d.close();
}

const ONLY = process.argv[3] || '';
if ((mode === 'webkit' || mode === 'chromium') && !ONLY) {
  for (const [t, os] of [['system', 'light'], ['system', 'dark'], ['midnight', 'light'], ['forest', 'light'], ['parchment', 'dark'], ['frost', 'dark']]) await selectCase(t, os);
  await selectCase('midnight', 'light', { inject: 'dark' });
  await selectCase('parchment', 'dark', { inject: 'light' });

  // F260 week-note Copy (UA button face): synthetic .wnbody .jft button in the F260 document
  for (const [t, os] of [['midnight', 'light'], ['parchment', 'dark'], ['midnight', 'dark']]) {
    const d = await dev({ os, theme: t });
    const f = await d.openApp('f260'); await settle();
    await f.evaluate(() => { const w = document.createElement('div'); w.className = 'wn on'; w.id = 'rmwn'; w.innerHTML = '<div class="wnbody"><div class="jft"><span class="jsaved">Saved</span><button type="button" id="rmcopy">Copy</button></div></div>'; (document.querySelector('main') || document.body).prepend(w); });
    const r = await textVsRendered(d, f, '#rmcopy', { inset: 3 });
    log(`f260 week-note Copy ${mode} ${t}/${os}`, r);
    await d.close();
  }
}

if (mode === 'webkit' && !ONLY) {
  // theme-color on a new device whose server row is Midnight (light OS, iPhone PWA, no local theme)
  {
    const d = await dev({ device: 'iphone-pwa', os: 'light', theme: 'midnight', localTheme: false });
    await d.goto('#home'); await settle(4000);
    const r = await d.page.evaluate(() => ({ metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content), bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), theme: document.documentElement.dataset.theme || null, scheme: document.documentElement.dataset.scheme, ls: localStorage.getItem('hub.theme') }));
    log('theme-color new device, server midnight, light OS', { put: d.put, ...r });
    await d.page.reload({ waitUntil: 'load' }); await settle(3000);
    const r2 = await d.page.evaluate(() => ({ metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content), bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() }));
    log('theme-color same device after reload', r2);
    await d.close();
  }

  // Prayer Kitchen .k-cat (Eli), Midnight and Hearth, light OS
  for (const t of ['midnight', 'hearth']) {
    const d = await dev({ os: 'light', theme: t });
    const f = await d.openApp('prayer'); await settle();
    const ok = await f.evaluate(() => { try { openKitchen(); return document.querySelectorAll('#kitchen .k-cat').length; } catch (e) { return 'err ' + e.message; } });
    await sleep(600);
    const r = typeof ok === 'number' && ok > 0 ? await textVsRendered(d, f, '#kitchen .k-cat', { inset: 0 }) : { error: ok };
    log(`prayer kitchen .k-cat eli ${t}`, { n: ok, ...r });
    await d.close();
  }

  // Timer dial arc: computed stroke vs the rendered pixels under the arc (fg hidden), Eli and David, Midnight
  for (const p of ['eli', 'dad']) {
    const d = await dev({ os: 'light', theme: 'midnight', profile: p });
    const f = await d.openApp('timer', { wait: '.dial' }); await settle();
    const g = await f.evaluate(() => { const fg = document.querySelector('.dial .ring .fg'); const s = getComputedStyle(fg); const r = fg.getBoundingClientRect(); return { stroke: s.stroke, sw: parseFloat(s.strokeWidth), op: s.opacity, r: { x: r.x, y: r.y, w: r.width, h: r.height }, surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() }; });
    const fe = await f.frameElement(); const fb = await fe.boundingBox();
    // hide the arc, sample a 6x6 patch at the top of the ring (the arc starts at 12 o'clock)
    await f.evaluate(() => { const fg = document.querySelector('.dial .ring .fg'); fg.style.setProperty('visibility', 'hidden', 'important'); });
    await sleep(200);
    const cx = fb.x + g.r.x + g.r.w / 2, top = fb.y + g.r.y;
    const px = await medianRect(d.page, { x: cx - 3, y: top + Math.max(1, g.sw / 4), width: 6, height: 6 }, { inset: 0 });
    const stroke = parse(g.stroke);
    log(`timer arc ${p} midnight`, { stroke: g.stroke, strokeOpacity: g.op, under: hex(px), rendered: ratio(stroke, px), vsSurface: ratio(stroke, parse(g.surface)) });
    await d.close();
  }

  // Park map walk time (.lv-item .d small): synthetic row inside the Nearby pane, Midnight, Eli / David / Mae
  for (const p of ['eli', 'dad', 'christian']) {
    const d = await dev({ os: 'light', theme: 'midnight', profile: p });
    const f = await d.openApp('dollywood-live'); await settle(4000);
    const real = await f.evaluate(() => document.querySelectorAll('.lv-item .d small').length);
    await f.evaluate(() => { const box = document.getElementById('lv-near'); const b = document.createElement('button'); b.className = 'lv-item'; b.id = 'rmrow'; b.innerHTML = '<span class="t"><b>Probe</b><span>x</span></span><span class="d">4 min<small id="rmsmall">3 min walk</small></span>'; box.prepend(b); const sh = document.getElementById('lv-sheet'); if (sh) sh.dataset.state = 'full'; });
    await sleep(800);
    const r = await textVsRendered(d, f, '#rmsmall', { inset: 0 });
    log(`park map walk time ${p} midnight`, { realRows: real, ...r });
    await d.close();
  }

}
if (mode === 'webkit' && (!ONLY || ONLY === 'hearthdark')) {
  // Hearth on a dark OS vs System dark: park map #lv-family and F260's Reset confirm button
  for (const t of ['hearth', 'system']) {
    const d = await dev({ os: 'dark', theme: t });
    const f = await d.openApp('dollywood-live'); await settle(4000);
    const r = await textVsRendered(d, f, '#lv-family', { inset: 2 });
    log(`park map #lv-family ${t}/dark-OS`, r);
    const f2 = await d.openApp('f260'); await settle();
    await f2.evaluate(() => document.getElementById('confirm').classList.add('on'));
    await sleep(600);
    const r2 = await textVsRendered(d, f2, '#doConfirm', { inset: 3 });
    log(`f260 #doConfirm ${t}/dark-OS`, r2);
    await d.close();
  }

}
if (mode === 'webkit' && (!ONLY || ONLY === 'lvstates')) {
  // the park map's Family tab under Hearth on a dark OS in each sheet state, and after tapping it (the rig's worst
  // states were the Nearby pane ones); System dark alongside
  for (const t of ['hearth', 'system']) {
    const d = await dev({ os: 'dark', theme: t });
    const f = await d.openApp('dollywood-live'); await settle(4000);
    for (const st of ['peek', 'half', 'full']) {
      await f.evaluate(st => { document.getElementById('lv-sheet').dataset.state = st; }, st); await sleep(700);
      log(`park map #lv-family ${t}/dark-OS sheet=${st}`, await textVsRendered(d, f, '#lv-family', { inset: 2 }));
    }
    await f.locator('#lv-family').click().catch(() => {}); await sleep(900);
    log(`park map #lv-family ${t}/dark-OS after tap`, await textVsRendered(d, f, '#lv-family', { inset: 2 }));
    await f.locator('#lv-search').click().catch(() => {}); await sleep(900);
    log(`park map #lv-family ${t}/dark-OS search pane`, await textVsRendered(d, f, '#lv-family', { inset: 2 }));
    await d.close();
  }
}
if (mode === 'webkit' && !ONLY) {
  // Token math resolved by the browser in a Midnight / Forest / Hearth document: raw accent, accent-soft, focus ring
  {
    const profiles = L.S.profiles.map(p => ({ id: p.id, name: p.name, color: p.color, kind: p.kind }));
    const d = await dev({ os: 'light', theme: 'midnight' });
    await d.goto('#home'); await settle();
    const out = {};
    for (const th of ['midnight', 'forest', 'hearth']) {
      out[th] = await d.page.evaluate(({ th, profiles }) => {
        const root = document.documentElement; if (th === 'hearth') delete root.dataset.theme; else root.dataset.theme = th;
        const probe = document.createElement('div'); document.body.appendChild(probe);
        const get = v => { probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color; };
        const surface = getComputedStyle(root).getPropertyValue('--surface').trim();
        const rows = profiles.map(p => { probe.style.setProperty('--accent', p.color); return { ...p, soft: get('color-mix(in srgb, var(--accent) 14%, var(--surface))'), focus: get('color-mix(in srgb, var(--accent) 38%, transparent)') }; });
        probe.remove(); return { surface, rows };
      }, { th, profiles });
    }
    const acc = {};
    for (const [th, o] of Object.entries(out)) {
      const card = parse(o.surface);
      acc[th] = o.rows.map(r => ({ id: r.id, color: r.color, rawVsCard: ratio(parse(r.color), card), softVsCard: ratio(parse(r.soft), card), softC: oklch(parse(r.soft)).C, focusVsCard: ratio(over(parse(r.focus), card), card) }));
    }
    log('accent math', acc);
    await d.close();
  }
}

fs.writeFileSync(path.join(OUT, `remeasure-${mode}${ONLY ? '-' + ONLY : ''}.json`), JSON.stringify({ only: ONLY || undefined, note: 'audits/tools/phase4/DARK/remeasure.mjs — independent re-measurement; see the script header for the method.', engine: mode, results }, null, 1));
await L.close();
