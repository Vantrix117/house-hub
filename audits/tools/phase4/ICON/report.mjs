// Phase 4 ICON — roll-up of measure-<theme>.json into the area × metric table and the failure lists.
//   node audits/tools/phase4/ICON/report.mjs
// → audits/evidence/p4/ICON/rollup.json (per area metrics), below3.json (every icon under 3:1, by theme),
//   small-targets.json (icon-only controls under 44 × 44), and a table on stdout.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('audits/evidence/p4/ICON');
const THEMES = ['hearth', 'parchment', 'frost', 'midnight', 'forest'];
const areaOf = s => s.startsWith('shell-') ? 'shell' : s.replace(/^kid-/, '').replace(/-phone$/, '');
const data = {};
for (const t of THEMES) { const f = path.join(DIR, `measure-${t}.json`); if (fs.existsSync(f)) data[t] = JSON.parse(fs.readFileSync(f, 'utf8')); }

const areas = {};
const below = [], small = [];
const keyOf = (sname, it) => `${sname}|${it.sel}|${it.sprite || ''}|${it.text || ''}|${it.ctl ? it.ctl.name : ''}`;
for (const [t, d] of Object.entries(data)) {
  for (const [sname, s] of Object.entries(d.surfaces)) {
    if (!s.items) continue;
    const A = areas[areaOf(sname)] ||= { svg: new Map(), glyph: new Map(), glyphLabel: new Map(), emojiAvatar: 0, rings: new Map(), theme: {} };
    const T = A.theme[t] ||= { n: 0, min: null, minItem: null, under3: 0, under3Keys: new Set() };
    for (const it of s.items) {
      const k = keyOf(sname, it);
      // not icons: the build guide's minimap; an unticked mark drawn at 6-8 px in the background colour is a hidden state by design
      if (/#mini/.test(it.sel)) continue;
      if (it.kind === 'svg' && it.declared != null && it.declared < 1.1 && it.rect.w <= 10) { (A.hiddenState ||= new Set()).add(k); continue; }
      if (it.kind === 'svg') A.svg.set(k, it);
      else if (it.kind === 'glyph' || it.kind === 'map-glyph') A.glyph.set(k, it);
      else if (it.kind === 'glyph-in-label') A.glyphLabel.set(k, it);
      else if (it.kind === 'emoji-avatar') { if (t === 'hearth') A.emojiAvatar++; continue; }
      else if (it.kind === 'ring') { A.rings.set(k, it); continue; }
      if ((it.kind === 'svg' || it.kind === 'glyph' || it.kind === 'map-glyph') && it.declared != null && !it.occluded) {
        const isEmoji = /\p{Extended_Pictographic}/u.test(it.text || '') && !/^[←-➿⬀-⯿−×]+$/u.test(it.text || '');
        if (isEmoji) continue; // colour emoji draw their own colours: the declared text colour is not what shows
        T.n++;
        const r = Math.max(it.declared, 0);
        if (T.min == null || r < T.min) { T.min = r; T.minItem = { surface: sname, sel: it.sel, sprite: it.sprite, text: it.text, ctl: it.ctl && it.ctl.name, declared: it.declared, peak: it.peak, size: it.rect.w }; }
        if (it.declared < 3 && !T.under3Keys.has(k)) { T.under3++; T.under3Keys.add(k); below.push({ theme: t, surface: sname, kind: it.kind, sel: it.sel, sprite: it.sprite, text: it.text, ctl: it.ctl && it.ctl.name, size: `${Math.round(it.rect.w)}x${Math.round(it.rect.h)}`, swPx: it.swPx, fg: it.fgRgb, bg: it.bg, declared: it.declared, peak: it.peak }); }
      }
      if (t === 'hearth' && (it.kind === 'svg' || it.kind === 'glyph') && it.ctl && (!it.ctl.text || it.ctl.text === (it.text || '')) && (it.ctl.w < 44 || it.ctl.h < 44))
        small.push({ surface: sname, sel: it.sel, sprite: it.sprite, text: it.text, ctl: it.ctl });
    }
  }
}

const uniq = a => [...new Set(a)].sort((x, y) => (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))));
const rows = {};
for (const [a, A] of Object.entries(areas)) {
  const svgs = [...A.svg.values()], gl = [...A.glyph.values()], gll = [...A.glyphLabel.values()];
  const sw = uniq(svgs.filter(s => s.paint !== 'fill').map(s => s.sw));
  const swPx = svgs.filter(s => s.paint !== 'fill' && s.swPx != null).map(s => s.swPx);
  const sizes = uniq(svgs.map(s => Math.round(s.rect.w)));
  const vbs = uniq(svgs.map(s => s.vb ? s.vb.slice(2).join('x') : 'none'));
  const paints = {}; for (const s of svgs) paints[s.paint] = (paints[s.paint] || 0) + 1;
  const caps = uniq(svgs.filter(s => s.paint !== 'fill').map(s => s.cap));
  rows[a] = {
    svgIcons: svgs.length, distinctSvgSelectors: uniq(svgs.map(s => s.sel + '|' + (s.sprite || ''))).length,
    strokeWidthsVbUnits: sw, strokePxMin: swPx.length ? Math.min(...swPx) : null, strokePxMax: swPx.length ? Math.max(...swPx) : null,
    renderedSizesPx: sizes, viewBoxes: vbs, paint: paints, linecaps: caps,
    duoDeclared: svgs.filter(s => s.duo).length, duoRendered: svgs.filter(s => s.duoRendered).length,
    textGlyphIcons: gl.length, textGlyphs: uniq(gl.map(g => g.text)), glyphInLabels: gll.length, glyphLabels: uniq(gll.map(g => g.text)).slice(0, 30),
    glyphFontSizes: uniq(gl.map(g => g.fontSize)), hiddenStateMarks: A.hiddenState ? A.hiddenState.size : 0, emojiAvatars: A.emojiAvatar, rings: A.rings.size,
    contrast: Object.fromEntries(Object.entries(A.theme).map(([t, T]) => [t, { measured: T.n, min: T.min, under3: T.under3, minItem: T.minItem }])),
  };
}
fs.writeFileSync(path.join(DIR, 'rollup.json'), JSON.stringify(rows, null, 1));
fs.writeFileSync(path.join(DIR, 'below3.json'), JSON.stringify(below, null, 1));
fs.writeFileSync(path.join(DIR, 'small-targets.json'), JSON.stringify(small, null, 1));
const order = ['shell', 'f260', 'leftovers', 'prayer', 'tally', 'timer', 'dollywood', 'dollywood-live', 'kidverse', 'verses'];
console.log('area | svg | sw(vb) | strokePx | sizes | glyphs | duo decl/rend | min ratio H/P/F/M/Fo | <3:1 H/P/F/M/Fo');
for (const a of order) { const r = rows[a]; if (!r) { console.log(a, '— no data'); continue; }
  const c = THEMES.map(t => r.contrast[t] ? r.contrast[t].min : '-').join('/'), u = THEMES.map(t => r.contrast[t] ? r.contrast[t].under3 : '-').join('/');
  console.log([a, r.svgIcons, r.strokeWidthsVbUnits.join(','), `${r.strokePxMin}-${r.strokePxMax}`, r.renderedSizesPx.join(','), r.textGlyphIcons + ' ' + r.textGlyphs.join(''), `${r.duoDeclared}/${r.duoRendered}`, c, u].join(' | ')); }
console.log('below3', below.length, 'small', small.length);
