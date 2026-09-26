import { cr, mix, oklch, de00, cvd } from './s2-colour.mjs';
const P = { Eli:'#4F5D8C', Mae:'#BC5A38', Ezra:'#137F77', Kiara:'#B4861B', Elizabeth:'#8A6A4B', David:'#3D5A3D', Mea:'#5B8143' }; // worker/seed.sql:4-11 (TV excluded)
const S = { hearth:'#FFFCF8', parchment:'#F1E7D2', frost:'#FAFBFD', midnight:'#241E19', forest:'#182225' };
const out = {};
out.raw = Object.fromEntries(Object.entries(P).map(([n,h])=>[n,{hex:h,...oklch(h)}]));
out.soft = {}; for (const [t,s] of Object.entries(S)) out.soft[t] = Object.fromEntries(Object.entries(P).map(([n,h])=>{const f=mix(h,s,0.14);return [n,{hex:f,C:+oklch(f).C.toFixed(3),L:+oklch(f).L.toFixed(3),crVsSurface:+cr(f,s).toFixed(2)}]}));
out.deepDark = Object.fromEntries(Object.entries(P).map(([n,h])=>{const d=mix(h,'#FFFFFF',0.58);return [n,{hex:d,...oklch(d),crOnMidnight:+cr(d,S.midnight).toFixed(2)}]}));
out.deepLight = Object.fromEntries(Object.entries(P).map(([n,h])=>{const d=mix(h,'#000000',0.72);return [n,{hex:d,C:+oklch(d).C.toFixed(3)}]}));
const names = Object.keys(P); const pairs=[];
for (let i=0;i<names.length;i++) for (let j=i+1;j<names.length;j++){ const a=names[i],b=names[j];
  pairs.push({pair:a+'/'+b, raw:+de00(P[a],P[b]).toFixed(2), softHearth:+de00(out.soft.hearth[a].hex,out.soft.hearth[b].hex).toFixed(2), softMidnight:+de00(out.soft.midnight[a].hex,out.soft.midnight[b].hex).toFixed(2), deutan:+de00(cvd(P[a],'deutan'),cvd(P[b],'deutan')).toFixed(2), protan:+de00(cvd(P[a],'protan'),cvd(P[b],'protan')).toFixed(2)}); }
out.pairs = pairs;
out.counts = { n:pairs.length, rawUnder5:pairs.filter(p=>p.raw<5).length, softHearthUnder5:pairs.filter(p=>p.softHearth<5).length, softMidnightUnder5:pairs.filter(p=>p.softMidnight<5).length, deutanUnder5:pairs.filter(p=>p.deutan<5).length, protanUnder5:pairs.filter(p=>p.protan<5).length };
console.log(JSON.stringify(out,null,1));
