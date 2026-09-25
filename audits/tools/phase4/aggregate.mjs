#!/usr/bin/env node
// Phase 4: turn the measurement rig's raw per-job JSON (audits/evidence/p4/measure/raw/<run>/<area>/*.json, written by
// measure.mjs) into small committed summaries in audits/evidence/p4/measure/. Reads only; runs no browser.
//
//   node audits/tools/phase4/aggregate.mjs [--out DIR]
//
// Writes (see audits/tools/phase4/README.md for every field):
//   coverage.json        jobs per run/area: planned, ok, failed, missing; failures; go() errors; theme actually applied
//   pairs.json           per area × theme: text colour / rendered background bucket / size class pairs (summary);
//                        the full lists in pairs/<area>.json
//   failing-pairs.json   every text below AA, grouped by area, theme and selector (+ colour)
//   nontext.json         icons (svg/img/emoji), control boundaries and information-bearing graphics below 3:1, per area
//   type.json            distinct font combinations per area (+ everything under 11 px, families, Dynamic Type fit)
//   radii.json           distinct radii per area; concentricity violations
//   shadows.json         distinct box-shadow values per area
//   spacing.json         distinct padding/margin/gap values per area, share on the 4 px and 8 px grid; side margins per device
//   glass.json           backdrop-filter layers per job and per area, navigation chrome vs content
//   motion.json          distinct transitions/animations per area (computed) + declared in each document's CSS
//   targets.json         interactive elements under 44 px per area
//   tells.json           web tells per area (tap highlight, selection/callout on chrome, overscroll, scrollbars, native controls, links)
//   tokens-resolved.json every design.css token resolved per theme × scheme (and kind), page vs frame differences
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const OUT = path.join(ROOT, 'audits', 'evidence', 'p4', 'measure');
const RAW = path.join(OUT, 'raw');
const OUTARG = process.argv.indexOf('--out'); const WOUT = OUTARG > 0 ? path.resolve(process.argv[OUTARG + 1]) : OUT;   // --out DIR: write the summaries elsewhere (a dry run)
const w = (name, obj) => { const f = path.join(WOUT, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj, null, 1) + '\n'); return f; };
const hex = c => c ? '#' + c.slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase() + (c.length > 3 && c[3] < 1 ? `/${(+c[3]).toFixed(2)}` : '') : null;
const bucket = c => c ? '#' + c.slice(0, 3).map(v => (Math.min(15, Math.round(v / 17))).toString(16).repeat(2)).join('').toUpperCase() : null;   // 16 levels per channel
const themeKey = j => j.theme === 'system' ? `system-${j.mode}` : j.theme === 'hearth' ? `hearth-${j.mode}` : j.theme;
const THEME_ORDER = ['system-light', 'system-dark', 'hearth-dark', 'parchment', 'frost', 'midnight', 'forest'];
const EXPECT = { 'system-light': [null, 'light'], 'system-dark': [null, 'dark'], 'hearth-dark': [null, 'light'], parchment: ['parchment', 'light'], frost: ['frost', 'light'], midnight: ['midnight', 'dark'], forest: ['forest', 'dark'] };
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pushEx = (arr, v, n = 3) => { if (v != null && arr.length < n && !arr.includes(v)) arr.push(v); };
const jobId = j => `${j.run}/${j.area}/${j.name}`;
const r1 = v => Math.round(v * 10) / 10;
const RIG_V = 2;   // raw files written by an older rig version are stale: counted in coverage.stale, not aggregated

// ── plan (from measure.mjs itself) and raw ──
let plan = [];
try { plan = JSON.parse(execFileSync(process.execPath, [path.join(HERE, 'measure.mjs'), '--run', 'themes,devices,states', '--plan-json'], { encoding: 'utf8', maxBuffer: 64 << 20 })); } catch (e) { console.error('plan failed', e.message); }
const files = [];
if (fs.existsSync(RAW)) for (const run of fs.readdirSync(RAW)) { if (run.startsWith('_')) continue; for (const area of fs.readdirSync(path.join(RAW, run))) for (const f of fs.readdirSync(path.join(RAW, run, area))) if (f.endsWith('.json')) files.push(path.join(RAW, run, area, f)); }
console.log(`${files.length} raw job files, ${plan.length} planned`);

// accumulators
const cov = { generatedAt: new Date().toISOString(), rig: 'audits/tools/phase4/measure.mjs v' + RIG_V + ' (Playwright WebKit, 1x CSS sampling)', runs: {}, failures: [], goErrors: [], stale: [], themeApplied: {}, sweepTruncated: [], unmeasuredShare: {}, occlusion: {} };
const pairs = {};            // area -> tk -> key -> rec
const failing = {};          // area -> tk -> key -> rec
const nontext = {};          // area -> {icons:{key->rec}, controls:{key->rec}, counts}
const type = {};             // area -> combos, small
const radii = {}, conc = {}, shadows = {}, spacing = {}, margins = {}, glassA = {}, motionA = {}, targets = {}, tells = {};
const tokens = {};           // tk|kind -> {page:{}, frames:{}}  first seen
const cssFiles = {};
const done = new Set();

for (const f of files) {
  let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { cov.failures.push({ job: path.relative(RAW, f), error: 'unreadable: ' + e.message }); continue; }
  const run = j.run, area = j.area, tk = themeKey(j), id = jobId(j);
  if ((j.v || 1) < RIG_V) { cov.stale.push(id); continue; }
  done.add(`${run}/${area}/${j.name}`);
  const R = cov.runs[run] ||= { planned: 0, ok: 0, failed: 0, missing: 0, byArea: {} };
  const RA = R.byArea[area] ||= { planned: 0, ok: 0, failed: 0, missing: 0 };
  if (!j.ok) { R.failed++; RA.failed++; cov.failures.push({ job: id, error: j.error, attempts: j.attempts }); continue; }
  R.ok++; RA.ok++;
  if (j.goError) cov.goErrors.push({ job: id, error: j.goError });
  if (j.sweep && j.sweep.truncated) cov.sweepTruncated.push(id);
  // theme applied
  const TA = cov.themeApplied[tk] ||= { jobs: 0, asExpected: 0, observed: {}, mismatches: [] };
  TA.jobs++;
  let good = true;
  for (const d of j.docs || []) {
    const m = d.meta || {}; const bg = d.tokens && d.tokens.design['--bg'] ? d.tokens.design['--bg'].raw : null;
    const k = `${d.name === 'page' ? 'page' : 'frame'} theme=${m.theme} scheme=${m.scheme} --bg=${bg}${m.kind === 'kiosk' ? ' (kiosk)' : ''}`;
    TA.observed[k] = (TA.observed[k] || 0) + 1;
    const [et, es] = EXPECT[tk] || [];
    if (m.url && !/about:blank/.test(m.url) && (m.theme !== et || m.scheme !== es)) good = false;
  }
  if (good) TA.asExpected++; else if (TA.mismatches.length < 25) TA.mismatches.push(id);

  // ── text ──
  const texts = j.text || [];
  const U = cov.unmeasuredShare[area] ||= { texts: 0, measured: 0 };
  const own = t => (area === 'shell' || area === 'tv') ? t.doc === 'page' : t.doc !== 'page';
  U.texts += texts.filter(own).length; U.measured += texts.filter(t => own(t) && t.measured).length;
  const OC = cov.occlusion[area] ||= { measuredPartlyCovered: 0, occludedNeverMeasured: 0, examples: [] };
  for (const t of texts) { if (!own(t)) continue; if (t.measured && t.cover > 0) OC.measuredPartlyCovered++; if (!t.measured && t.occluded) { OC.occludedNeverMeasured++; pushEx(OC.examples, `${t.sel} "${(t.text || '').slice(0, 30)}" (${id})`, 5); } }
  for (const t of texts) {
    const stack = j.stacks ? j.stacks[t.stack] : null;
    // text of another area's document that was never on screen (the shell's Apps view behind an app's viewer) is not this area's type
    const ownDoc = area === 'shell' || area === 'tv' ? t.doc === 'page' : t.doc !== 'page';
    if (!t.measured && !ownDoc) continue;
    // type inventory: every text in the DOM that is displayed (measured or not)
    const T = type[area] ||= { combos: {}, under11: {}, families: {}, resolved: {}, sizes: {}, n: 0 };
    T.n++;
    const ck = [t.ffr, t.ff, t.fs, t.fw, t.lh, t.ls, t.tt].join('|');
    const C = T.combos[ck] ||= { resolved: t.ffr, family: t.ff, fs: t.fs, fw: t.fw, lh: t.lh, ls: t.ls, tt: t.tt, n: 0, sels: [], texts: [], jobs: [] };
    C.n++; pushEx(C.sels, t.sel); pushEx(C.texts, t.text, 2); pushEx(C.jobs, id, 2);
    T.families[stack || t.ff] = (T.families[stack || t.ff] || 0) + 1; T.resolved[t.ffr] = (T.resolved[t.ffr] || 0) + 1;
    T.sizes[t.fs] = (T.sizes[t.fs] || 0) + 1;
    if (t.fs < 11) { const u = T.under11[t.sel + '|' + t.fs] ||= { sel: t.sel, fs: t.fs, fw: t.fw, text: t.text, n: 0, jobs: [] }; u.n++; pushEx(u.jobs, id); }
    if (!t.measured || t.p10 == null) continue;
    // pairs
    const P = (pairs[area] ||= {})[tk] ||= {};
    const pk = [hex(t.color), bucket(t.bgMed), t.large ? 'large' : 'normal'].join('|');
    const p = P[pk] ||= { color: hex(t.color), colorTok: t.tok || [], bg: bucket(t.bgMed), bgTok: (t.bg && t.bg.tok) || [], size: t.large ? 'large' : 'normal', fsMin: t.fs, fsMax: t.fs, minP10: t.p10, meds: [], n: 0, fail: 0, sels: [], jobs: [] };
    p.n++; p.minP10 = Math.min(p.minP10, t.p10); p.meds.push(t.med); p.fsMin = Math.min(p.fsMin, t.fs); p.fsMax = Math.max(p.fsMax, t.fs); if (t.aa === false) p.fail++;
    pushEx(p.sels, t.sel, 4); pushEx(p.jobs, id, 3);
    if (t.aa === false) {
      const F = (failing[area] ||= {})[tk] ||= {};
      const fk = t.doc.split(':')[0] + '|' + t.sel + '|' + hex(t.color);
      const x = F[fk] ||= { doc: t.doc, sel: t.sel, color: hex(t.color), colorTok: t.tok || [], texts: [], fs: t.fs, fw: t.fw, large: t.large, req: t.req, interactive: t.ia, minP10: t.p10, meds: [], bgAtMin: hex(t.bgP10), bgMed: hex(t.bgMed), bgDecl: t.bg ? (t.bg.c ? hex(t.bg.c) : null) : null, bgImage: !!(t.bg && t.bg.img), bgTok: (t.bg && t.bg.tok) || [], n: 0, medAlsoFails: 0, partlyCovered: 0, jobs: [] };
      x.n++; x.meds.push(t.med); if (t.aaMed === false) x.medAlsoFails++; if (t.cover > 0) x.partlyCovered++; pushEx(x.texts, t.text, 3); pushEx(x.jobs, id, 4);
      if (t.p10 < x.minP10) { x.minP10 = t.p10; x.bgAtMin = hex(t.bgP10); }
    }
  }

  // ── non-text ──
  const N = nontext[area] ||= { icons: {}, controls: {}, graphics: {}, iconIdentified: {}, counts: { icons: 0, iconFail: 0, controls: 0, controlNeedsBoundary: 0, controlFail: 0, iconIdentified: 0, graphics: 0, graphicFail: 0, graphicsByKind: {}, graphicFailByKind: {} } };
  const ICONS = (j.nontext && j.nontext.icons) || [];
  // the icon(s) inside a control: same document, icon centre inside the control's rect
  const iconsIn = c => ICONS.filter(ic => ic.doc === c.doc && ic.rect && c.rect && ic.rect.x + ic.rect.w / 2 >= c.rect.x && ic.rect.x + ic.rect.w / 2 <= c.rect.x + c.rect.w && ic.rect.y + ic.rect.h / 2 >= c.rect.y && ic.rect.y + ic.rect.h / 2 <= c.rect.y + c.rect.h);
  for (const ic of (j.nontext && j.nontext.icons) || []) {
    N.counts.icons++;
    if (ic.ratio == null) continue;
    if (ic.ratio >= 3) continue;
    N.counts.iconFail++;
    const k = [tk, ic.kind, ic.sel].join('|');
    const r = N.icons[k] ||= { theme: tk, kind: ic.kind, sel: ic.sel, inControl: ic.inControl, label: ic.label, w: ic.w, h: ic.h, minRatio: ic.ratio, n: 0, ink: hex(ic.inkRgb), bg: hex(ic.bgMed), text: ic.text, jobs: [] };
    r.n++; if (ic.ratio < r.minRatio) { r.minRatio = ic.ratio; r.ink = hex(ic.inkRgb); r.bg = hex(ic.bgMed); } pushEx(r.jobs, id);
  }
  for (const c of (j.nontext && j.nontext.controls) || []) {
    N.counts.controls++;
    // WCAG 1.4.11 needs a visible boundary where the shape identifies the control: fields and toggles always; buttons and
    // chips only when nothing else identifies them: no text label and no icon that itself reaches 3:1 (an icon-only
    // button whose icon passes is identified by the icon, so a missing boundary is not a failure: iconIdentified)
    const inner = c.kind === 'field' || c.kind === 'toggle' || c.hasText ? [] : iconsIn(c);
    const iconOk = inner.some(ic => ic.pass === true);
    const needs = c.kind === 'field' || c.kind === 'toggle' || (!c.hasText && !iconOk);
    if (!c.hasText && iconOk && c.kind !== 'field' && c.kind !== 'toggle') {
      N.counts.iconIdentified++;
      if (c.boundary != null && c.boundary < 3) { const k = [tk, c.kind, c.sel].join('|'); const r = N.iconIdentified[k] ||= { theme: tk, kind: c.kind, sel: c.sel, minBoundary: c.boundary, iconRatio: Math.max(...inner.filter(ic => ic.pass).map(ic => ic.ratio)), n: 0, jobs: [] }; r.n++; r.minBoundary = Math.min(r.minBoundary, c.boundary); pushEx(r.jobs, id); }
    }
    if (!needs) continue;
    N.counts.controlNeedsBoundary++;
    if (c.boundary == null || c.boundary >= 3) continue;
    N.counts.controlFail++;
    const k = [tk, c.kind, c.sel].join('|');
    const r = N.controls[k] ||= { theme: tk, kind: c.kind, sel: c.sel, hasText: c.hasText, icon: inner.length ? { n: inner.length, bestRatio: Math.max(...inner.map(ic => ic.ratio || 0)) } : null, w: c.w, h: c.h, minBoundary: c.boundary, fillRatio: c.fillRatio, borderRatio: c.borderRatio, border: c.bw ? `${c.bw}px ${hex(c.bc)}` : null, fill: hex(c.fill), inside: hex(c.innerMed), outside: hex(c.outerMed), n: 0, jobs: [] };
    r.n++; if (c.boundary < r.minBoundary) { r.minBoundary = c.boundary; r.inside = hex(c.innerMed); r.outside = hex(c.outerMed); } pushEx(r.jobs, id);
  }
  for (const g of (j.nontext && j.nontext.graphics) || []) {
    N.counts.graphics++; N.counts.graphicsByKind[g.kind] = (N.counts.graphicsByKind[g.kind] || 0) + 1;
    if (g.ratio == null || g.ratio >= 3) continue;
    N.counts.graphicFail++; N.counts.graphicFailByKind[g.kind] = (N.counts.graphicFailByKind[g.kind] || 0) + 1;
    const k = [tk, g.kind, g.sel].join('|');
    const adj = Object.entries(g.per || {}).map(([n, v]) => `${n} ${hex(v.adj)} ${v.ratio}`).join(', ');
    const r = N.graphics[k] ||= { theme: tk, kind: g.kind, sel: g.sel, doc: g.doc, w: g.rect && g.rect.w, h: g.rect && g.rect.h, paint: g.gradient ? `gradient ${hex(g.paintDark)}..${hex(g.paintLight)}` : hex(g.paint), alpha: g.alpha, minRatio: g.ratio, maxRatio: g.ratio, adjacentAtMin: adj, n: 0, jobs: [] };
    r.n++; r.maxRatio = Math.max(r.maxRatio, g.ratio); if (g.ratio < r.minRatio) { r.minRatio = g.ratio; r.adjacentAtMin = adj; r.paint = g.gradient ? `gradient ${hex(g.paintDark)}..${hex(g.paintLight)}` : hex(g.paint); }
    for (const f of ['ratioBest', 'ratioInside', 'vsTrack', 'trackVsSurround', 'fillShare', 'drawn', 'text', 'ia', 'spread', 'svgSel', 'trackSel', 'shadow']) if (g[f] != null && r[f] == null) r[f] = g[f];
    pushEx(r.jobs, id);
  }

  // ── per document static inventories ──
  const frameVisible = (j.docs || []).some(d => d.name !== 'page' && d.offset && d.offset.visible);
  for (const d of j.docs || []) {
    const b = d.boxes || {};
    const RA2 = radii[area] ||= { values: {}, pills: 0, elements: 0 };
    for (const r of b.radii || []) {
      RA2.elements++;
      if (r.pill) { RA2.pills++; continue; }
      const v = Array.isArray(r.r) ? r.r.join('/') : String(r.r);
      const o = RA2.values[v] ||= { r: v, sels: [], n: 0, jobs: [] }; o.n++; pushEx(o.sels, r.sel, 6); pushEx(o.jobs, id, 2);
    }
    const CO = conc[area] ||= {};
    for (const c of b.concentric || []) { if (c.ok) continue; const k = c.outer + '|' + c.inner; const o = CO[k] ||= { ...c, n: 0, jobs: [] }; o.n++; pushEx(o.jobs, id, 3); }
    const SH = shadows[area] ||= {};
    for (const s of b.shadows || []) { const o = SH[s.v] ||= { v: s.v, n: 0, sels: [], themes: [] }; o.n += s.n; for (const e of s.ex) pushEx(o.sels, e, 5); pushEx(o.themes, tk, 7); }
    const SP = spacing[area] ||= {};
    for (const s of b.spacing || []) { const k = s.prop.replace(/-(top|right|bottom|left)$/, '') + '|' + s.v; const o = SP[k] ||= { prop: s.prop.replace(/-(top|right|bottom|left)$/, ''), v: s.v, n: 0, sels: [] }; o.n += s.n; for (const e of s.ex) pushEx(o.sels, e, 4); }
    if (d.margins && d.margins.left != null) {
      const M = ((margins[area] ||= {})[j.device] ||= {})[d.name === 'page' ? 'page' : 'frame'] ||= { left: [], right: [], vw: d.margins.vw, examples: [] };
      M.left.push(d.margins.left); M.right.push(d.margins.right); pushEx(M.examples, `${d.margins.left}/${d.margins.right} ${j.screen} (${d.margins.leftSel} … ${d.margins.rightSel})`, 4);
    }
    const G = glassA[area] ||= { jobs: [], values: {}, content: {}, chrome: {} };
    const layers = (d.glass || []).filter(g => g.bf);
    if (d.name === 'page' || layers.length) {
      const vis = layers.filter(g => g.visArea > 0);
      G.jobs.push({ job: id, doc: d.name, layers: layers.length, visible: vis.length, visArea: vis.reduce((a, g) => a + g.visArea, 0), viewport: (d.meta && d.meta.vw * d.meta.vh) || null, chrome: vis.filter(g => g.chrome).length, content: vis.filter(g => !g.chrome).length });
    }
    for (const g of layers) {
      G.values[g.bf] = (G.values[g.bf] || 0) + 1;
      const bag = g.chrome ? G.chrome : G.content; const o = bag[g.sel] ||= { sel: g.sel, bf: g.bf, position: g.position, why: g.why, maxArea: 0, n: 0, jobs: [] }; o.n++; o.maxArea = Math.max(o.maxArea, g.visArea); pushEx(o.jobs, id, 2);
    }
    const MO = motionA[area] ||= { transitions: {}, animations: {} };
    for (const t of (d.motion && d.motion.transitions) || []) { const k = t.dur + ' | ' + t.ease; const o = MO.transitions[k] ||= { dur: t.dur, ease: t.ease, props: [], n: 0, sels: [] }; o.n += t.n; pushEx(o.props, t.prop, 4); for (const e of t.ex) pushEx(o.sels, e, 4); }
    for (const a of (d.motion && d.motion.animations) || []) { const k = a.name + ' | ' + a.dur + ' | ' + a.ease + ' | ' + a.iter; const o = MO.animations[k] ||= { name: a.name, dur: a.dur, ease: a.ease, iter: a.iter, n: 0, sels: [] }; o.n += a.n; for (const e of a.ex) pushEx(o.sels, e, 4); }
    const TG = targets[area] ||= { total: 0, small: {} };
    const kind = d.meta && d.meta.kind;
    for (const t of d.targets || []) {
      TG.total++;
      if (!t.small || t.disabled) continue;
      // not a target anyone can reach: covered where it sits (under a sheet), or the shell behind an open app viewer
      if (t.visible === false && (t.onscreen || (d.name === 'page' && frameVisible))) continue;
      const k = t.sel; const o = TG.small[k] ||= { sel: t.sel, tag: t.tag, label: t.label, minW: t.effW, minH: t.effH, inline: t.inline, kids: false, devices: [], n: 0, jobs: [] };
      o.n++; o.minW = Math.min(o.minW, t.effW); o.minH = Math.min(o.minH, t.effH); if (kind === 'kid') o.kids = true; pushEx(o.devices, j.device, 6); pushEx(o.jobs, id, 3);
    }
    const TE = tells[area] ||= { tapHighlight: {}, userSelect: {}, touchCallout: {}, touchAction: {}, offenders: { tapHighlight: {}, userSelect: {}, touchCallout: {} }, overscroll: {}, rootBg: {}, scrollers: {}, scrollbarCss: false, forms: {}, links: {}, docs: 0 };
    const tl = d.tells; if (!tl) continue;
    TE.docs++;
    for (const h of ['tapHighlight', 'userSelect', 'touchCallout', 'touchAction']) for (const [k, v] of Object.entries(tl.hist[h] || {})) TE[h][k] = (TE[h][k] || 0) + v;
    for (const h of ['tapHighlight', 'userSelect', 'touchCallout']) for (const o of tl.offenders[h] || []) { const r = TE.offenders[h][o.sel] ||= { sel: o.sel, v: o.v, rule: o.rule || null, n: 0 }; r.n++; }
    const os = x => x ? `${x.overscrollX}/${x.overscrollY}${x.overscrollSrc === 'declared' ? '' : ' (' + (x.overscrollSrc || '?') + ')'}` : null;
    const ok = `${d.name === 'page' ? 'page' : 'frame'} html=${os(tl.root.html)} body=${os(tl.root.body)}`; TE.overscroll[ok] = (TE.overscroll[ok] || 0) + 1;
    const bgk = `${tk} ${d.name === 'page' ? 'page' : 'frame'} html=${hex(tl.root.html.c)}${tl.root.html.img ? '+img' : ''} body=${tl.root.body ? hex(tl.root.body.c) + (tl.root.body.img ? '+img' : '') : '-'}`; TE.rootBg[bgk] = (TE.rootBg[bgk] || 0) + 1;
    for (const s of tl.scrollers || []) { const k = `${s.sel} overscroll=${s.overscrollX}/${s.overscrollY} vbar=${s.vbar} hbar=${s.hbar}`; const o = TE.scrollers[k] ||= { sel: s.sel, overscroll: `${s.overscrollX}/${s.overscrollY}`, vbar: s.vbar, hbar: s.hbar, x: s.x, y: s.y, n: 0, devices: [] }; o.n++; pushEx(o.devices, j.device, 6); }
    if (tl.scrollbarCss) TE.scrollbarCss = true;
    for (const fm of tl.forms || []) { if (!fm.visible) continue; const k = fm.sel + '|' + fm.type + '|' + fm.appearance; const o = TE.forms[k] ||= { ...fm, n: 0 }; o.n++; }
    for (const l of tl.links || []) { const k = l.sel + '|' + hex(l.color) + '|' + l.underline; const o = TE.links[k] ||= { sel: l.sel, text: l.text, color: hex(l.color), underline: l.underline, blue: l.blue, tell: l.tell, n: 0 }; o.n++; }
    // tokens
    const kk = `${tk}|${kind || 'none'}`;
    const TK = tokens[kk] ||= { theme: tk, kind: kind || null, page: null, frames: {}, from: {}, prio: -1 };
    // the reference page for a theme: the shell Home on the iPad in the themes run, when there is one
    const prio = (j.run === 'themes' ? 2 : 0) + (j.area === 'shell' && j.screen === 'home' ? 4 : 0) + (j.device === 'ipad-portrait' ? 1 : 0);
    if (d.name === 'page' && d.tokens && prio > TK.prio) { TK.page = null; TK.prio = prio; }
    if (d.name === 'page' && !TK.page && d.tokens) { TK.page = d.tokens.design; TK.from.page = id; TK.accent = d.meta && d.meta.accent; TK.profile = j.profile; }
    if (d.name !== 'page' && !TK.frames[d.name] && d.tokens) { TK.frames[d.name] = { design: d.tokens.design, local: d.tokens.local, from: id }; }
  }
}
for (const p of plan) {
  const R = cov.runs[p.run] ||= { planned: 0, ok: 0, failed: 0, missing: 0, byArea: {} };
  const RA = R.byArea[p.area] ||= { planned: 0, ok: 0, failed: 0, missing: 0 };
  R.planned++; RA.planned++;
  if (!done.has(`${p.run}/${p.area}/${p.name}`)) { R.missing++; RA.missing++; }
}
if (fs.existsSync(path.join(RAW, '_css'))) for (const f of fs.readdirSync(path.join(RAW, '_css'))) { try { const o = JSON.parse(fs.readFileSync(path.join(RAW, '_css', f), 'utf8')); cssFiles[o.url] = o; } catch {} }

// ── write ──
const areas = [...new Set([...Object.keys(pairs), ...Object.keys(type), ...Object.keys(radii)])].sort();
for (const [tk, v] of Object.entries(cov.themeApplied)) v.observed = Object.fromEntries(Object.entries(v.observed).sort((a, b) => b[1] - a[1]));
for (const [a, u] of Object.entries(cov.unmeasuredShare)) u.share = +(1 - u.measured / Math.max(1, u.texts)).toFixed(3);
cov.note = 'unmeasuredShare (over the own document of the area: the shell page for shell and tv, the app frame otherwise) = DOM text never on screen and uncovered during the sweep (behind the app viewer, under a sheet, rows past the 10-step sweep cap, closed menus). goErrors: the screen script threw but the screen was still measured, as capture.mjs still shot it.';
w('coverage.json', cov);

// pairs: summary + per-area lists
const pairsSummary = { note: 'Per area and theme: unique (text colour, rendered background bucket (16 levels/channel), size class). minP10 = worst p10 contrast of any occurrence; medMedian = median of the occurrence medians. Full lists: pairs/<area>.json.', areas: {} };
for (const a of Object.keys(pairs).sort()) {
  const outA = {};
  pairsSummary.areas[a] = {};
  for (const tk of THEME_ORDER.filter(t => pairs[a][t])) {
    const list = Object.values(pairs[a][tk]).map(p => ({ ...p, medMedian: median(p.meds), meds: undefined })).sort((x, y) => x.minP10 - y.minP10);
    outA[tk] = list;
    pairsSummary.areas[a][tk] = { pairs: list.length, failingPairs: list.filter(p => p.fail > 0).length, occurrences: list.reduce((s, p) => s + p.n, 0), failingOccurrences: list.reduce((s, p) => s + p.fail, 0), worst: list.slice(0, 3).map(p => `${p.color} on ${p.bg} (${p.size}) p10 ${p.minP10} — ${p.sels[0]}`) };
  }
  w(`pairs/${a}.json`, outA);
}
w('pairs.json', pairsSummary);

const failFull = {};
const failOut = { note: 'Every measured text whose p10 rendered contrast is below AA (4.5:1, or 3:1 for large text: >= 24 px, or >= 18.66 px bold). Grouped by area, theme, document, selector and colour. medAlsoFails = occurrences where even the median sample fails (solid backgrounds: p10 = median). Rig v2 samples only the columns of each line box where the text is the topmost element (partlyCovered = occurrences sampled with some columns masked; text more than half covered at every sweep step is not measured). p10Only = no occurrence fails at the median; suspect = p10Only on a solid declared background: file those only after checking the screenshot; the 8-group index lists non-suspect groups first.', totals: {}, areas: {} };
for (const a of Object.keys(failing).sort()) {
  failOut.areas[a] = {};
  for (const tk of THEME_ORDER.filter(t => failing[a][t])) {
    const list = Object.values(failing[a][tk]).map(x => ({ ...x, medMedian: median(x.meds), meds: undefined, p10Only: x.medAlsoFails === 0, suspect: x.medAlsoFails === 0 && !x.bgImage })).sort((x, y) => x.minP10 - y.minP10);
    // the index ranks groups whose median also fails (or whose background is a gradient/photo) first; p10-only groups on a
    // solid declared background (possible sampling edge: an overlapping edge, an antialiased neighbour) come last
    const ranked = [...list.filter(x => !x.suspect), ...list.filter(x => x.suspect)];
    failOut.areas[a][tk] = ranked.slice(0, 8).map(x => ({ ...x, texts: x.texts.slice(0, 1), jobs: x.jobs.slice(0, 1), colorTok: x.colorTok.slice(0, 2), bgTok: x.bgTok.slice(0, 2) }));   // index: 1 example text, 1 job, 2 tokens (all in the per-area file)
    ((failFull[a] ||= {})[tk] = list);
    (failOut.totals[a] ||= {})[tk] = { selectors: list.length, occurrences: list.reduce((s, x) => s + x.n, 0), interactive: list.filter(x => x.interactive).length, medAlsoFailsSelectors: list.filter(x => x.medAlsoFails > 0).length, suspectSelectors: list.filter(x => x.suspect).length };
  }
}
for (const [a, v] of Object.entries(failFull)) w(`failing-pairs/${a}.json`, v);
failOut.note += ' This file keeps the 8 worst groups per area and theme; every group (with up to 4 job ids) is in failing-pairs/<area>.json.';
w('failing-pairs.json', failOut);

const ntOut = { note: 'Icons: p90 contrast of the icon pixels (those that change when the icon is hidden) against the pixels under them; below 3:1 listed. Emoji and photos are listed by kind (their contrast is informational). Controls: boundary = max(fill vs surround, border vs surround), sampled 2-4 px inside and 3 px outside each edge; a boundary is needed (WCAG 1.4.11) for fields and toggles, and for buttons/chips with no text label AND no icon inside them that reaches 3:1 (controlNeedsBoundary). Icon-only controls identified by a passing icon are counted in iconIdentified (their low boundaries are listed apart, not as failures). Graphics (rig v2): information-bearing shapes that are not icons or controls: ring = a solid spread box-shadow/outline state cue (vs 3 px outside it; ratioInside = vs the shape it rings); bar = a fill in a track (vs the visible track; trackVsSurround = track vs 3 px outside it); dot = a small painted state shape (day dots, grid cells, heat squares, stripes, --p columns) vs 3 px outside each side; stroke = an svg circle/path of a ring/dial/progress graphic vs 3 px outside and inside the stroke (vsTrack = an arc vs the track under it; drawn = share of the arc drawn). ratio = the best adjacent side (the shape is told apart from at least one neighbour), paint = computed colour alpha-composited (gradients: median of the paint pixels; ratioBest = its most contrasting pixel).', areas: {} };
for (const a of Object.keys(nontext).sort()) { const N = nontext[a]; const full = { counts: N.counts, icons: Object.values(N.icons).sort((x, y) => x.minRatio - y.minRatio), controls: Object.values(N.controls).sort((x, y) => x.minBoundary - y.minBoundary), graphics: Object.values(N.graphics).sort((x, y) => x.minRatio - y.minRatio), iconIdentified: Object.values(N.iconIdentified).sort((x, y) => y.n - x.n) }; w(`nontext/${a}.json`, full); ntOut.areas[a] = { counts: N.counts, iconGroups: full.icons.length, controlGroups: full.controls.length, graphicGroups: full.graphics.length, iconIdentifiedGroups: full.iconIdentified.length, svgIcons: full.icons.filter(x => x.kind === 'svg').slice(0, 20), controls: full.controls.slice(0, 20), graphics: full.graphics.slice(0, 20).map(x => ({ ...x, jobs: x.jobs.slice(0, 2) })) }; }
ntOut.note += ' This file keeps the 20 worst svg-icon, control and graphic groups per area; every group (img and emoji too, and iconIdentified) is in nontext/<area>.json.';
w('nontext.json', ntOut);

const DT = [34, 28, 22, 20, 17, 16, 15, 13, 12, 11];
const typeOut = { note: 'Every displayed text box (measured or not), all runs. resolved = the first family of the stack this WebKit build on Windows actually has (so SF Pro / ui-rounded fall back to Segoe UI etc.; on Apple devices the stack resolves differently). combos: distinct resolved family / declared first family / size / weight / line-height / letter-spacing / transform. dynamicType: share of text boxes whose size is exactly an iOS Dynamic Type size.', dynamicTypeSizes: DT, areas: {} };
for (const a of Object.keys(type).sort()) {
  const T = type[a]; const combos = Object.values(T.combos).sort((x, y) => y.n - x.n);
  const sizes = Object.entries(T.sizes).map(([fs, n]) => [+fs, n]).sort((x, y) => x[0] - y[0]);
  const onDT = sizes.filter(([fs]) => DT.includes(fs)).reduce((s, [, n]) => s + n, 0);
  typeOut.areas[a] = { texts: T.n, distinctCombos: combos.length, distinctSizes: sizes.length, sizes: Object.fromEntries(sizes), dynamicTypeShare: +(onDT / T.n).toFixed(3), under11: Object.values(T.under11).sort((x, y) => x.fs - y.fs), families: T.families, resolved: T.resolved, combos: combos.slice(0, 60), moreCombos: Math.max(0, combos.length - 60) };
}
w('type.json', typeOut);

const radOut = { note: 'Distinct non-pill border radii of painted elements per area (pills: radius >= half the short side, counted apart). concentric: a rounded child whose nearest corner sits inside a rounded painted ancestor\'s curve; want = outer radius − inset; listed when |r − want| > max(3 px, 25 % of R).', areas: {} };
for (const a of Object.keys(radii).sort()) radOut.areas[a] = { elements: radii[a].elements, pills: radii[a].pills, distinct: Object.keys(radii[a].values).length, values: Object.values(radii[a].values).sort((x, y) => parseFloat(x.r) - parseFloat(y.r)), concentricViolations: Object.values(conc[a] || {}).sort((x, y) => Math.abs(y.off) - Math.abs(x.off)).slice(0, 60) };
w('radii.json', radOut);

const shOut = { note: 'Distinct computed box-shadow values per area (they differ per theme because the elevation tokens are tinted), with the themes each was seen in.', areas: {} };
for (const a of Object.keys(shadows).sort()) { const v = Object.values(shadows[a]).sort((x, y) => y.n - x.n); shOut.areas[a] = { distinct: v.length, values: v.slice(0, 50), more: Math.max(0, v.length - 50) }; }
w('shadows.json', shOut);

const spOut = { note: 'Distinct padding / margin / row-gap / column-gap values (px) of visible layout containers (elements with visible element children) and margins of every visible element, per area; n counts element occurrences over all jobs. grid4/grid8 = share of occurrences on the 4 px / 8 px grid. sideMargins: per device, the left/right distance from the viewport edge to the outermost non-full-bleed content (page = the shell document, frame = the app document), min/median/max over jobs.', areas: {} };
for (const a of Object.keys(spacing).sort()) {
  const vals = Object.values(spacing[a]); const byProp = {};
  for (const v of vals) { const P = byProp[v.prop] ||= { values: [], n: 0, on4: 0, on8: 0 }; P.values.push(v); P.n += v.n; if (Math.abs(v.v) % 4 === 0) P.on4 += v.n; if (Math.abs(v.v) % 8 === 0) P.on8 += v.n; }
  const props = {};
  for (const [p, P] of Object.entries(byProp)) props[p] = { distinct: P.values.length, grid4: +(P.on4 / P.n).toFixed(3), grid8: +(P.on8 / P.n).toFixed(3), values: P.values.sort((x, y) => x.v - y.v).map(v => ({ v: v.v, n: v.n, sels: v.sels, off4: Math.abs(v.v) % 4 !== 0 })) };
  const sm = {};
  for (const [dev, docs] of Object.entries(margins[a] || {})) { sm[dev] = {}; for (const [dn, M] of Object.entries(docs)) sm[dev][dn] = { vw: M.vw, left: { min: Math.min(...M.left), median: median(M.left), max: Math.max(...M.left) }, right: { min: Math.min(...M.right), median: median(M.right), max: Math.max(...M.right) }, jobs: M.left.length, examples: M.examples }; }
  spOut.areas[a] = { props, sideMargins: sm };
}
w('spacing.json', spOut);

const glOut = { note: 'Elements with a computed backdrop-filter (this WebKit build computes it but paints no blur, see lib/check-backdrop-filter.mjs). layers = all with a backdrop-filter in the document; visible = intersecting the viewport; visArea = their on-screen px² summed (overlaps counted twice). chrome = fixed/sticky (self or ancestor), a chrome name (tabbar, topbar, sheet, pill, toolbar, nav …), a nav/header/dialog tag or a dialog/navigation/toolbar/tablist role; everything else is content.', areas: {} };
for (const a of Object.keys(glassA).sort()) {
  const G = glassA[a]; const js = G.jobs;
  glOut.areas[a] = { jobs: js.length, maxVisibleLayers: Math.max(0, ...js.map(x => x.visible)), medianVisibleLayers: median(js.map(x => x.visible)), maxVisAreaShare: +Math.max(0, ...js.filter(x => x.viewport).map(x => x.visArea / x.viewport)).toFixed(3), jobsWithContentGlass: js.filter(x => x.content > 0).length, backdropValues: G.values, chrome: Object.values(G.chrome).sort((x, y) => y.n - x.n), content: Object.values(G.content).sort((x, y) => y.maxArea - x.maxArea), heaviest: [...js].sort((x, y) => y.visible - x.visible || y.visArea - x.visArea).slice(0, 5) };
}
w('glass.json', glOut);

const moOut = { note: 'Computed transitions / animations on visible elements per area (durations and easings as the browser resolved them). declared: every transition / animation / pressed-state transform in each document\'s stylesheets (raw/_css), which covers :active and :hover rules computed style cannot see. outOfRange = durations outside 200-350 ms (the house style), excluding 0 s.', areas: {}, declared: {} };
const durs = s => String(s).split(',').map(x => x.trim()).map(x => x.endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000);
for (const a of Object.keys(motionA).sort()) {
  const tr = Object.values(motionA[a].transitions).sort((x, y) => y.n - x.n).map(t => ({ ...t, outOfRange: durs(t.dur).some(d => d > 0 && (d < 200 || d > 350)) }));
  const an = Object.values(motionA[a].animations).sort((x, y) => y.n - x.n).map(t => ({ ...t, outOfRange: durs(t.dur).some(d => d > 0 && (d < 200 || d > 350)) }));
  moOut.areas[a] = { transitions: tr.slice(0, 40), animations: an.slice(0, 40), distinctDurations: [...new Set([...tr, ...an].flatMap(t => durs(t.dur)))].sort((x, y) => x - y), distinctEasings: [...new Set([...tr, ...an].flatMap(t => String(t.ease).split(/,\s*(?![^(]*\))/)))] };
}
for (const [u, o] of Object.entries(cssFiles)) moOut.declared[u] = { keyframes: o.keyframes, rules: o.css.length, durations: [...new Set(o.css.flatMap(c => (c.v.match(/(\d*\.?\d+)(ms|s)\b/g) || []).map(x => x.endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000)))].sort((x, y) => x - y), varRefs: [...new Set(o.css.flatMap(c => c.v.match(/var\(--[\w-]+\)/g) || []))], sample: o.css.slice(0, 30) };
w('motion.json', moOut);

const tgOut = { note: 'Interactive elements (buttons, links, inputs, [role=button|switch|tab…], [data-open], .tile, .pcard, …) whose effective size (including an absolutely positioned ::before/::after hit area) is under 44 px on either axis, not disabled. inline = a link inside running text (WCAG 2.5.8 exception). kids = seen in kid mode (where the house style wants larger than 44).', areas: {} };
for (const a of Object.keys(targets).sort()) { const v = Object.values(targets[a].small).sort((x, y) => Math.min(x.minW, x.minH) - Math.min(y.minW, y.minH)); tgOut.areas[a] = { measured: targets[a].total, smallSelectors: v.length, small: v }; }
w('targets.json', tgOut);

const teOut = { note: 'Web tells per area over every document of every job. tapHighlight / touchCallout: this WebKit build does not compute either property, so the value is the DECLARED one from the stylesheet source (declared:(UA default) = no rule, i.e. Safari\'s grey highlight / the callout). userSelect on interactive chrome (text = selectable on long-press). overscroll: html/body overscroll-behavior. rootBg: html/body backgrounds per theme (what rubber-band overscroll reveals). scrollers: vbar/hbar = classic scrollbar px (0 = overlay/none). forms: native-looking controls (appearance not none). links: tell = blue and underlined.', areas: {} };
for (const a of Object.keys(tells).sort()) { const T = tells[a]; teOut.areas[a] = { docs: T.docs, tapHighlight: T.tapHighlight, userSelect: T.userSelect, touchCallout: T.touchCallout, touchAction: T.touchAction, offenders: Object.fromEntries(Object.entries(T.offenders).map(([k, v]) => [k, Object.values(v).sort((x, y) => y.n - x.n).slice(0, 25)])), overscroll: T.overscroll, rootBg: T.rootBg, scrollers: Object.values(T.scrollers).sort((x, y) => y.n - x.n).slice(0, 20), scrollbarCss: T.scrollbarCss, nativeForms: Object.values(T.forms).filter(f => f.native), styledForms: Object.values(T.forms).filter(f => !f.native).length, links: Object.values(T.links) }; }
w('tells.json', teOut);

// tokens: every design.css token per theme (adult page = the shell for Eli), + kid/kiosk and frame differences
const tokOut = { note: 'Every design.css custom property resolved on :root of the shell page (getComputedStyle, var() substituted; colours probed through `color: var(--x)`, lengths through margin-left, times through transition-duration). Columns = theme keys (system-light/-dark = no data-theme on a light/dark OS; hearth-dark = Hearth chosen on a dark OS; the named ones on a light OS). kinds: tokens whose value differs for a kid or kiosk profile. frameDiffs: tokens an app document resolves differently from the shell in the same job (app-local overrides).', themes: [], tokens: {}, kinds: {}, frameDiffs: {}, sources: {} };
const adult = THEME_ORDER.map(t => tokens[`${t}|adult`] || tokens[`${t}|none`]).filter(Boolean);
tokOut.themes = adult.map(x => x.theme);
const val = o => { if (!o) return null; if (o.rgba) return hex(o.rgba); const raw = o.raw || ''; if (o.ms != null && /^[\d.]+m?s$/.test(raw)) return o.ms + 'ms'; if (o.px != null) return /^-?[\d.]+px$|^0$/.test(raw) ? o.px + 'px' : `${raw} (=${o.px}px here)`; return raw; };
for (const x of adult) { tokOut.sources[x.theme] = { page: x.from.page, profile: x.profile, accent: x.accent }; for (const [n, o] of Object.entries(x.page || {})) (tokOut.tokens[n] ||= {})[x.theme] = val(o); }
for (const [n, byT] of Object.entries(tokOut.tokens)) if (new Set(Object.values(byT)).size === 1) tokOut.tokens[n] = { all: Object.values(byT)[0] };
for (const t of THEME_ORDER) {
  const base = tokens[`${t}|adult`] || tokens[`${t}|none`]; if (!base || !base.page) continue;
  for (const k of ['kid', 'kiosk']) { const o = tokens[`${t}|${k}`]; if (!o || !o.page) continue; const diff = {}; for (const [n, v] of Object.entries(o.page)) if (val(v) !== val(base.page[n])) diff[n] = { [k]: val(v), adult: val(base.page[n]) }; ((tokOut.kinds[k] ||= {})[t] = { from: o.from.page, diff }); }
  for (const [kk, T] of Object.entries(tokens)) { if (!kk.startsWith(t + '|') || !T.page) continue; for (const [fn, F] of Object.entries(T.frames)) { const diff = {}; for (const [n, v] of Object.entries(F.design)) if (val(v) !== val(T.page[n])) diff[n] = { frame: val(v), page: val(T.page[n]) }; if (Object.keys(diff).length) ((tokOut.frameDiffs[fn] ||= {})[kk] = { from: F.from, diff }); } }
}
tokOut.localTokens = {}; for (const T of Object.values(tokens)) for (const [fn, F] of Object.entries(T.frames)) { const names = Object.keys(F.local || {}); if (names.length) tokOut.localTokens[fn] = [...new Set([...(tokOut.localTokens[fn] || []), ...names])]; }
w('tokens-resolved.json', tokOut);

// sizes
const sizes = fs.readdirSync(WOUT).filter(f => f.endsWith('.json')).map(f => `${f} ${(fs.statSync(path.join(WOUT, f)).size / 1024).toFixed(0)} KB`);
console.log('wrote', sizes.join(', '));
for (const [r, v] of Object.entries(cov.runs)) console.log(`${r}: planned ${v.planned}, ok ${v.ok}, failed ${v.failed}, missing ${v.missing}`);
