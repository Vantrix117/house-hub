// VIS-COLOR-1 skeptic s2: independent recomputation from apps/design.css hex values (no reuse of palette.json).
// OKLCH per Ottosson; contrast WCAG 2.x; color-mix in srgb (gamma-encoded, as browsers do for `in srgb`).
import fs from 'node:fs';
const css = fs.readFileSync(new URL('../../../../../apps/design.css', import.meta.url), 'utf8').split('\n');
const hex = h => { h = h.replace('#',''); return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)/255); };
const toHex = c => '#' + c.map(v => Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join('').toUpperCase();
const lin = v => v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4;
const lum = c => { const [r,g,b] = c.map(lin); return 0.2126*r+0.7152*g+0.0722*b; };
const cr = (a,b) => { const x=lum(a), y=lum(b); return +((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)).toFixed(2); };
const oklch = c => { const [r,g,b]=c.map(lin);
  const l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b), m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b), s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
  const L=0.2104542553*l+0.7936177850*m-0.0040720468*s, A=1.9779984951*l-2.4285922050*m+0.4505937099*s, B=0.0259040371*l+0.7827717662*m-0.8086757660*s;
  let H=Math.atan2(B,A)*180/Math.PI; if(H<0)H+=360; return {L:+L.toFixed(3), C:+Math.hypot(A,B).toFixed(3), H:+H.toFixed(1)}; };
const mix = (a,p,b) => a.map((v,i)=>v*p+b[i]*(1-p));
// theme blocks: parse by line ranges of each theme's declarations
const grab = (from,to) => { const o={}; for (let i=from-1;i<to;i++) for (const m of css[i].matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) o[m[1]]=m[2]; return o; };
const themes = { hearth: grab(39,84), parchment: grab(116,130), frost: grab(136,150), midnight: grab(156,170), forest: grab(198,212) };
for (const k of ['parchment','frost','midnight','forest']) for (const [a,b] of Object.entries(themes.hearth)) if(!(a in themes[k])) themes[k][a]=b;
const fam = ['mocha','gold','olive','teal','terra','slate'];
const house = { Bubblegum:'#FFC8DD', Peach:'#FFD6B8', Butter:'#FFF1A8', Mint:'#B9F2D0', Aqua:'#B5EEF0', Sky:'#BFDDFF', Periwinkle:'#CCD3FF', Lavender:'#E0CCFF' };   // audits/HUB-AUDIT-PROMPT.md:57-64
const out = { note: 'recomputed from apps/design.css by s2', house:{}, themes:{} };
for (const [n,h] of Object.entries(house)) out.house[n] = oklch(hex(h));
const swatches = ['#4F5D8C','#BC5A38','#137F77','#B4861B','#8A6A4B','#3D5A3D','#5B8143','#4C4C58','#8C4F7A','#4C7B6A'];
const apps = { f260:'#4F5D8C', leftovers:'#3D5A3D', prayer:'#8A6A4B', tally:'#4C7B6A', timer:'#B8623A', dollywood:'#7A4FA3', 'dollywood-live':'#1F6FB2', kidverse:'#B4861B', verses:'#5B8143' };
for (const [t,v] of Object.entries(themes)) {
  const surf = hex(v.surface), bg = hex(v.bg), s2 = hex(v['surface-2']);
  const soft = Object.fromEntries(fam.map(f => [f, { hex: v[f+'-soft'], ...oklch(hex(v[f+'-soft'])), inkOnSoft: cr(hex(v[f+'-ink']), hex(v[f+'-soft'])) }]));
  const fams = Object.fromEntries(fam.map(f => [f, oklch(hex(v[f]))]));
  const accentSoft = swatches.map(s => oklch(mix(hex(s),0.14,surf)).C);
  const tiles = Object.fromEntries(Object.entries(apps).map(([id,c]) => { const s1=mix(hex(c),0.22,surf), s2t=mix(hex(c),0.08,surf); return [id, { stop1: toHex(s1), C1: oklch(s1).C, stop2: toHex(s2t), C2: oklch(s2t).C, inkOnStop1: cr(hex(c),s1), inkOnStop2: cr(hex(c),s2t) }]; }));
  // .bar: fill starts at 75% tint + white, track surface-2; Larder uses --warn (gold) / --danger (terra)
  const bars = Object.fromEntries(['gold','terra'].map(f => { const st = mix(hex(v[f]),0.75,[1,1,1]); return [f, { startVsTrack: cr(st,s2), endVsTrack: cr(hex(v[f]),s2) }]; }));
  const softC = Object.values(soft).map(x=>x.C);
  out.themes[t] = { softCrange:[Math.min(...softC),Math.max(...softC)], softLrange:[Math.min(...Object.values(soft).map(x=>x.L)),Math.max(...Object.values(soft).map(x=>x.L))], accentSoftC:[Math.min(...accentSoft),Math.max(...accentSoft)], cardVsBg: cr(surf,bg), wellVsBg: cr(s2,bg), bgOKLCH: oklch(bg), familyHues: Object.fromEntries(Object.entries(fams).map(([k,x])=>[k,x.H])), soft, tiles, bars };
}
fs.writeFileSync(new URL('../../../../evidence/p5/ux-verify/VIS-COLOR-1/s2/recompute.json', import.meta.url), JSON.stringify(out,null,1));
for (const [t,v] of Object.entries(out.themes)) console.log(t, 'softC', v.softCrange, 'softL', v.softLrange, 'accentSoftC', v.accentSoftC, 'card/bg', v.cardVsBg, 'well/bg', v.wellVsBg, 'bg', JSON.stringify(v.bgOKLCH), 'hues', JSON.stringify(v.familyHues), '\n  kidverse', JSON.stringify(v.tiles.kidverse), '\n  leftovers', JSON.stringify(v.tiles.leftovers), '\n  f260', JSON.stringify(v.tiles.f260), '\n  bars', JSON.stringify(v.bars), '\n  inkOnSoft', Object.values(v.soft).map(x=>x.inkOnSoft).join(','));
console.log('house', JSON.stringify(out.house));
