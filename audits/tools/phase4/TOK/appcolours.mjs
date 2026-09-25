// Phase 4 TOK: the colours that live OUTSIDE design.css — the nine apps.json tile colours, the ten profile swatches
// (index.html:449; worker/seed.sql:4-11) and the #8A6A4B fallbacks — are single light-theme hex values. design.css re-tunes
// every hue family per theme (e.g. --olive #5B8143 → #9DC183 in Midnight) but these never change, so wherever they are
// painted as a FOREGROUND on a dark theme (tile glyphs, rings, avatar rings, the timer ring) they sink.
// Computes, per theme surface (from tokens-resolved.json), each colour's contrast as a glyph on its own .app-icon tile
// (color-mix(tint 22%, surface), design.css:607-608) and against the plain surface, and whether it equals a token.
//   node audits/tools/phase4/TOK/appcolours.mjs   → audits/evidence/p4/TOK/appcolours.json   (needs tokens.mjs first)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT, parseColor, contrast, hex, parseDesignCss } from './lib-tok.mjs';

const R = JSON.parse(fs.readFileSync(path.join(OUT, 'tokens-resolved.json'), 'utf8')).resolved;
const { tokens } = parseDesignCss();
const hearthHex = {}; for (const t of Object.values(tokens)) { const c = parseColor(t.values.hearth || ''); if (c && c.a === 1) (hearthHex[hex(c)] ||= []).push(t.name); }
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ kind: 'app tile', id: a.id, color: a.color }));
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = (idx.match(/const SWATCHES = \[([^\]]*)\]/) || ['', ''])[1].match(/#[0-9A-Fa-f]{6}/g) || [];
const cols = [...apps, ...sw.map((c, i) => ({ kind: 'profile swatch', id: 'SWATCHES[' + i + ']', color: c }))];
const mix = (a, b, p) => ({ r: a.r * p + b.r * (1 - p), g: a.g * p + b.g * (1 - p), b: a.b * p + b.b * (1 - p), a: 1 });
const themes = ['hearth', 'parchment', 'frost', 'midnight', 'forest'];
const surf = t => parseColor((R[t]['--surface'].resolved || R[t]['--surface'].raw || R[t]['--surface']));
const rows = cols.map(c => {
  const col = parseColor(c.color); const out = { ...c, isToken: hearthHex[hex(col)] || null };
  for (const t of themes) { const s = surf(t); const tile = mix(col, s, 0.22); out[t] = { glyphOnTile: contrast(col, tile), onSurface: contrast(col, s) }; }
  return out;
});
const under = t => rows.filter(r => r[t].glyphOnTile < 3).map(r => r.id);
const summary = Object.fromEntries(themes.map(t => [t, { glyphOnTileUnder3: under(t).length, of: rows.length, ids: under(t), ringUnder3: rows.filter(r => r[t].onSurface < 3).map(r => r.id) }]));
fs.writeFileSync(path.join(OUT, 'appcolours.json'), JSON.stringify({ method: 'sRGB color-mix(tint 22%, --surface) = the .app-icon tile; glyph = the tint itself (design.css:607-608)', summary, rows }, null, 1));
for (const t of themes) console.log(t.padEnd(10), 'glyph-on-tile < 3:1:', summary[t].glyphOnTileUnder3 + '/' + rows.length, summary[t].ids.join(' '), '| on surface < 3:1:', summary[t].ringUnder3.join(' '));
console.log('not a design.css token:', rows.filter(r => !r.isToken).map(r => r.id + ' ' + r.color).join(', '));
