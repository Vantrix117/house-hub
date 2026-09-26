// s1 independent recompute: token contrasts straight from apps/design.css hex values (color-mix in gamma sRGB).
import fs from 'node:fs';
const hex = h => { h = h.replace('#',''); if (h.length===3) h=[...h].map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)); };
const lin = c => { c/=255; return c<=0.04045? c/12.92 : ((c+0.055)/1.055)**2.4; };
const L = rgb => 0.2126*lin(rgb[0])+0.7152*lin(rgb[1])+0.0722*lin(rgb[2]);
const cr = (a,b) => { const x=L(a), y=L(b); return +(((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)).toFixed(2)); };
const mix = (a,p,b) => a.map((v,i)=>Math.round(v*p/100 + b[i]*(100-p)/100)); // color-mix(a p%, b)
const T = {
  hearth:   {surface:'#FFFCF8', s2:'#EFE7DC', muted:'#75675B', decor:'#A79B8E', gold:'#B4861B', olive:'#5B8143', teal:'#137F77', terra:'#BC5A38', onacc:'#FFFCF8', deep:[72,'black']},
  parchment:{surface:'#F1E7D2', s2:'#DDCBA9', muted:'#6A5641', decor:'#9E8A70', gold:'#9A6F0E', olive:'#4E7038', teal:'#0F6E67', terra:'#A84B2C', onacc:'#FFF8EC', deep:[66,'black']},
  frost:    {surface:'#FAFBFD', s2:'#E2E7EE', muted:'#5C6879', decor:'#98A2B0', gold:'#A07A1F', olive:'#547A40', teal:'#137F77', terra:'#B25538', onacc:'#FFFFFF', deep:[72,'black']},
  midnight: {surface:'#241E19', s2:'#15110E', muted:'#A2948A', decor:'#6E6258', gold:'#E0B25A', olive:'#9DC183', teal:'#5EC2B8', terra:'#E28A66', onacc:'#17120E', deep:[58,'white']},
  forest:   {surface:'#182225', s2:'#0C1214', muted:'#9C9484', decor:'#66625A', gold:'#D9B25E', olive:'#9CC486', teal:'#62C3B8', terra:'#E08E6B', onacc:'#0E1412', deep:[58,'white']},
};
const W=hex('#FFFFFF');
const out = {};
for (const [n,t] of Object.entries(T)) {
  const s=hex(t.surface);
  out[n] = {
    badge_white_on_danger: cr(W,hex(t.terra)),
    switch_knob_white_on_ok: cr(W,hex(t.olive)),
    placeholder_decor_on_surface: cr(hex(t.decor),s),
    muted_on_surface2: cr(hex(t.muted),hex(t.s2)),
    onaccent_on_gold: cr(hex(t.onacc),hex(t.gold)),
    onaccent_on_terra: cr(hex(t.onacc),hex(t.terra)),
    onaccent_on_olive: cr(hex(t.onacc),hex(t.olive)),
    onaccent_on_teal: cr(hex(t.onacc),hex(t.teal)),
    white_on_olive_f260: cr(W,hex(t.olive)),
    gold_on_surface: cr(hex(t.gold),s),
  };
  // Kiara accent-deep on accent-tint
  const acc=hex('#B4861B'); const deep=mix(acc,t.deep[0],hex(t.deep[1]==='black'?'#000000':'#FFFFFF')); const tint=mix(acc,26,s);
  out[n].kiara_deep_on_tint = cr(deep,tint);
}
console.log(JSON.stringify(out,null,1));
fs.writeFileSync(process.argv[2]||'audits/evidence/p5/ux-verify/GAP-TOK-2/s1/contrast.json', JSON.stringify(out,null,1));
