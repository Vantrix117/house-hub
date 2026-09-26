// s1: recompute glyph-on-tile (tint on color-mix(tint p%, --surface)) and ring-on-surface for apps.json + SWATCHES.
import fs from 'node:fs';
const hex = h => [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const lin = c => { c/=255; return c<=0.04045? c/12.92 : ((c+0.055)/1.055)**2.4; };
const L = p => 0.2126*lin(p[0])+0.7152*lin(p[1])+0.0722*lin(p[2]);
const cr = (a,b) => { const x=L(a), y=L(b); return +(((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)).toFixed(2)); };
const mix = (a,p,b) => a.map((v,i)=>Math.round(v*p/100 + b[i]*(100-p)/100));
const surf = { hearth:'#FFFCF8', parchment:'#F1E7D2', frost:'#FAFBFD', midnight:'#241E19', forest:'#182225' };
const apps = JSON.parse(fs.readFileSync('apps.json','utf8')); const list = (apps.apps||apps).map(a=>[a.id,a.color]);
const SW = ['#4F5D8C','#BC5A38','#137F77','#B4861B','#8A6A4B','#3D5A3D','#5B8143','#4C4C58','#8C4F7A','#4C7B6A'].map((c,i)=>['SW'+i,c]);
const all = [...list, ...SW]; const res = {};
for (const [t,s] of Object.entries(surf)) {
  const S=hex(s); const r = { g22:[], g15:[], ring:[] };
  for (const [id,c] of all) { const C=hex(c);
    if (cr(C,mix(C,22,S))<3) r.g22.push(id); if (cr(C,mix(C,15,S))<3) r.g15.push(id); if (cr(C,S)<3) r.ring.push(id+':'+cr(C,S)); }
  res[t] = { n: all.length, glyph22Under3: r.g22.length, glyph15Under3: r.g15.length, appsGlyph22Under3: r.g22.filter(x=>!x.startsWith('SW')).length, ringUnder3: r.ring, ids22: r.g22 };
}
console.log(JSON.stringify(res,null,1));
fs.writeFileSync('audits/evidence/p5/ux-verify/GAP-TOK-3/s1/recompute.json', JSON.stringify(res,null,1));
