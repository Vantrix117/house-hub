(function(d){try{var g=function(k,f){try{var v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(e){return f}},
m=function(q){return !!(window.matchMedia&&matchMedia(q).matches)},c=g('hub.theme','system'),t=c==='light'?'hearth':c==='dark'?'midnight':c,
S={hearth:'light',parchment:'light',frost:'light',midnight:'dark',forest:'dark',graphite:'dark'},
B={hearth:'#F4F1EC',parchment:'#ECE2CD',frost:'#F2F2F7',midnight:'#0B0A09',forest:'#070F0D',graphite:'#000000'},
H={'#4f5d8c':'periwinkle','#bc5a38':'bubblegum','#137f77':'aqua','#b4861b':'butter','#8a6a4b':'peach','#3d5a3d':'sky','#5b8143':'mint','#4c4c58':'graphite','#8c4f7a':'lavender','#4c7b6a':'lavender'};
if(!S[t])t=m('(prefers-color-scheme: dark)')?'midnight':'hearth';
var s=g('hub.session',null),p=s&&s.profile,r=g('hub.prefs',{})||{};d.setAttribute('data-theme',t);d.setAttribute('data-theme-choice',c);
d.setAttribute('data-scheme',S[t]);d.style.colorScheme=S[t];
var ms=document.querySelectorAll('meta[name="theme-color"]'),i;if(!ms.length){var mt=document.createElement('meta');mt.setAttribute('name','theme-color');document.head.appendChild(mt);ms=[mt]}
for(i=0;i<ms.length;i++){ms[i].removeAttribute('media');ms[i].setAttribute('content',B[t])}
if(p){d.setAttribute('data-kind',p.kind);d.setAttribute('data-accent',p.hue||H[String(p.color||'').toLowerCase()]||'graphite')}
['textSize:data-text-size','contrast:data-contrast','transparency:data-transparency','motion:data-motion'].forEach(function(x){x=x.split(':');if(r[x[0]])d.setAttribute(x[1],r[x[0]])})}catch(e){}})(document.documentElement)
