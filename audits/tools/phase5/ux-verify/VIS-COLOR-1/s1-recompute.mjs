// s1 independent recompute for VIS-COLOR-1: parses apps/design.css tokens directly (no reuse of phase4 tools)
// and computes OKLCH chroma of the soft fills, tile stops, tile-icon contrast, card/page and well/page steps, bar start vs track.
import fs from 'node:fs';
const css = fs.readFileSync(new URL('../../../../../apps/design.css', import.meta.url), 'utf8');
const apps = JSON.parse(fs.readFileSync(new URL('../../../../../apps.json', import.meta.url), 'utf8')).apps;
function block(sel) {
  const i = css.indexOf(sel); const s = css.indexOf('{', i); const e = css.indexOf('\n}', s);
  const out = {}; for (const m of css.slice(s, e).matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2]; return out;
}
const root = block(':root {');
const themes = { hearth: root,
  parchment: { ...root, ...block(':root[data-theme="parchment"]') }, frost: { ...root, ...block(':root[data-theme="frost"]') },
  midnight: { ...root, ...block(':root[data-theme="midnight"]') }, forest: { ...root, ...block(':root[data-theme="forest"]') } };
const hex = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255);
const toHex = c => '#' + c.map(v => Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join('');
const lin = v => v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4;
const lum = c => { const [r,g,b] = c.map(lin); return 0.2126*r+0.7152*g+0.0722*b; };
const cr = (a,b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
const mix = (a,b,p) => a.map((v,i) => v*p + b[i]*(1-p));
function oklch(c) { const [r,g,b] = c.map(lin);
  const l = Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b), m = Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b), s = Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
  const L = 0.2104542553*l+0.7936177850*m-0.0040720468*s, A = 1.9779984951*l-2.4285922050*m+0.4505937099*s, B = 0.0259040371*l+0.7827717662*m-0.8086757660*s;
  let H = Math.atan2(B,A)*180/Math.PI; if (H<0) H+=360; return { L:+L.toFixed(3), C:+Math.hypot(A,B).toFixed(3), H:Math.round(H) }; }
const fams = ['mocha','gold','olive','teal','terra','slate'];
const out = {};
for (const [t, v] of Object.entries(themes)) {
  const surf = hex(v.surface), bg = hex(v.bg);
  const soft = Object.fromEntries(fams.map(f => [f, { hex: v[f+'-soft'], ...oklch(hex(v[f+'-soft'])) }]));
  const tiles = Object.fromEntries(apps.map(a => { const c = hex(a.color); const s22 = mix(c,surf,.22), s8 = mix(c,surf,.08);
    return [a.id, { color: a.color, stop22: { hex: toHex(s22), C: oklch(s22).C }, stop8: { hex: toHex(s8), C: oklch(s8).C },
      iconVs22: +cr(c,s22).toFixed(2), iconVs8: +cr(c,s8).toFixed(2), iconVsSurface: +cr(c,surf).toFixed(2) }]; }));
  const bars = Object.fromEntries(fams.map(f => { const c = hex(v[f]); const start = mix(c,[1,1,1],.75); const track = hex(v['surface-2']);
    return [f, { startVsTrack: +cr(start,track).toFixed(2), endVsTrack: +cr(c,track).toFixed(2) }]; }));
  out[t] = { page: { hex: v.bg, ...oklch(bg) }, surface: v.surface, cardVsPage: +cr(surf,bg).toFixed(3), wellVsPage: +cr(hex(v['surface-2']),bg).toFixed(3),
    wellDarkerThanPage: lum(hex(v['surface-2'])) < lum(bg), softChromaRange: [Math.min(...fams.map(f=>soft[f].C)), Math.max(...fams.map(f=>soft[f].C))], soft,
    familyHues: Object.fromEntries(fams.map(f => [f, oklch(hex(v[f])).H])), tiles, bars };
}
out.iosRef = { F2F2F7: oklch(hex('#F2F2F7')), cardWhiteVsF2F2F7: +cr([1,1,1],hex('#F2F2F7')).toFixed(3), dark1C1C1EVs000: +cr(hex('#1C1C1E'),[0,0,0]).toFixed(3) };
fs.writeFileSync(new URL('../../../../evidence/p5/ux-verify/VIS-COLOR-1/s1/recompute.json', import.meta.url), JSON.stringify(out, null, 1));
for (const [t,o] of Object.entries(out)) { if (t==='iosRef') { console.log('ios', JSON.stringify(o)); continue; }
  console.log(t, 'page', JSON.stringify(o.page), 'card/page', o.cardVsPage, 'well/page', o.wellVsPage, 'wellDarker', o.wellDarkerThanPage, 'softC', o.softChromaRange.join('-'), 'hues', JSON.stringify(o.familyHues));
  console.log('  tiles', Object.entries(o.tiles).map(([k,x]) => `${k}:C${x.stop22.C}->${x.stop8.C} icon ${x.iconVs22}/${x.iconVs8}`).join(' | '));
  console.log('  bars start/track', Object.entries(o.bars).map(([k,x]) => `${k}:${x.startVsTrack}`).join(' '));
}
