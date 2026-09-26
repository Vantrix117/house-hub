// s2: recompute token-pair contrast for VIS-F260-1 / VIS-F260-2 from apps/design.css hexes (no browser).
const hex=h=>{h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16))};
const lin=c=>{c/=255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4};
const L=rgb=>.2126*lin(rgb[0])+.7152*lin(rgb[1])+.0722*lin(rgb[2]);
const cr=(a,b)=>{const x=L(a),y=L(b);return +((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)};
const mix=(fg,bg,a)=>fg.map((v,i)=>Math.round(v*a+bg[i]*(1-a)));
const T={
 hearth:{bg:'#F7F2EB',surface:'#FFFCF8',s2:'#EFE7DC',text:'#2E251D',muted:'#75675B',gold:'#B4861B',goldsoft:'#F6EBD0'},
 parchment:{bg:'#E7D9BE',surface:'#F1E7D2',s2:'#DDCBA9',text:'#3A2A1A',muted:'#6A5641',gold:'#9A6F0E',goldsoft:'#E8D5A2'},
 frost:{bg:'#EDF0F5',surface:'#FAFBFD',s2:'#E2E7EE',text:'#1E2430',muted:'#5C6879',gold:'#A07A1F',goldsoft:'#F2EAD3'},
 midnight:{bg:'#1A1512',surface:'#241E19',s2:'#15110E',text:'#F3EDE5',muted:'#A2948A',gold:'#E0B25A',goldsoft:'#2C2416'},
 forest:{bg:'#10171A',surface:'#182225',s2:'#0C1214',text:'#EFE7D6',muted:'#9C9484',gold:'#D9B25E',goldsoft:'#2A2618'},
};
const out={};
for(const [n,t] of Object.entries(T)){const g=k=>hex(t[k]);
 out[n]={
  gold_on_bg:cr(g('gold'),g('bg')), gold_on_surface:cr(g('gold'),g('surface')), gold_on_goldsoft:cr(g('gold'),g('goldsoft')),
  muted_on_bg:cr(g('muted'),g('bg')), muted_on_surface:cr(g('muted'),g('surface')),
  pastweek_span_muted_op60_on_bg:cr(mix(g('muted'),g('bg'),.6),g('bg')),
  pastweek_num_text_op60_on_bg:cr(mix(g('text'),g('bg'),.6),g('bg')),
  sunk_vs_bg:cr(g('s2'),g('bg')), sunk_vs_surface:cr(g('s2'),g('surface')),
 };}
console.log(JSON.stringify(out,null,1));
