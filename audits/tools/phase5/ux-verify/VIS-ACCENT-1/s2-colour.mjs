// s2 independent colour maths: contrast, OKLCH, CIEDE2000, color-mix(in srgb), Brettel/Vienot CVD.
export const hex2rgb = h => { h = h.replace('#',''); return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)/255); };
export const rgb2hex = c => '#' + c.map(v => Math.round(Math.min(1,Math.max(0,v))*255).toString(16).padStart(2,'0')).join('').toUpperCase();
const lin = v => v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4;
export const lum = h => { const [r,g,b] = hex2rgb(h).map(lin); return 0.2126*r+0.7152*g+0.0722*b; };
export const cr = (a,b) => { const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
export const mix = (a,b,p) => { const A=hex2rgb(a), B=hex2rgb(b); return rgb2hex(A.map((v,i)=>v*p+B[i]*(1-p))); };
export const oklch = h => { const [r,g,b] = hex2rgb(h).map(lin);
  const l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b), m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b), s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
  const L=0.2104542553*l+0.7936177850*m-0.0040720468*s, A=1.9779984951*l-2.4285922050*m+0.4505937099*s, B=0.0259040371*l+0.7827717662*m-0.8086757660*s;
  return { L, C: Math.hypot(A,B), H: (Math.atan2(B,A)*180/Math.PI+360)%360 }; };
export const lab = h => { const [r,g,b] = hex2rgb(h).map(lin);
  let X=(0.4124564*r+0.3575761*g+0.1804375*b)/0.95047, Y=(0.2126729*r+0.7151522*g+0.0721750*b), Z=(0.0193339*r+0.1191920*g+0.9503041*b)/1.08883;
  const f=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116; X=f(X);Y=f(Y);Z=f(Z); return [116*Y-16,500*(X-Y),200*(Y-Z)]; };
export const de00 = (h1,h2) => { const [L1,a1,b1]=lab(h1),[L2,a2,b2]=lab(h2); const rad=Math.PI/180;
  const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cb=(C1+C2)/2,G=0.5*(1-Math.sqrt(Cb**7/(Cb**7+25**7)));
  const a1p=a1*(1+G),a2p=a2*(1+G),C1p=Math.hypot(a1p,b1),C2p=Math.hypot(a2p,b2);
  const h1p=(Math.atan2(b1,a1p)/rad+360)%360,h2p=(Math.atan2(b2,a2p)/rad+360)%360;
  const dL=L2-L1,dC=C2p-C1p; let dh=h2p-h1p; if(C1p*C2p===0)dh=0; else if(dh>180)dh-=360; else if(dh<-180)dh+=360;
  const dH=2*Math.sqrt(C1p*C2p)*Math.sin(dh*rad/2); const Lb=(L1+L2)/2,Cbp=(C1p+C2p)/2;
  let hb=h1p+h2p; if(C1p*C2p!==0){ if(Math.abs(h1p-h2p)>180) hb += (h1p+h2p<360?360:-360); hb/=2; }
  const T=1-0.17*Math.cos((hb-30)*rad)+0.24*Math.cos(2*hb*rad)+0.32*Math.cos((3*hb+6)*rad)-0.20*Math.cos((4*hb-63)*rad);
  const dth=30*Math.exp(-(((hb-275)/25)**2)),Rc=2*Math.sqrt(Cbp**7/(Cbp**7+25**7)),Sl=1+0.015*(Lb-50)**2/Math.sqrt(20+(Lb-50)**2),Sc=1+0.045*Cbp,Sh=1+0.015*Cbp*T,Rt=-Math.sin(2*dth*rad)*Rc;
  return Math.sqrt((dL/Sl)**2+(dC/Sc)**2+(dH/Sh)**2+Rt*(dC/Sc)*(dH/Sh)); };
// Vienot 1999 dichromat simulation (linear RGB)
const CVD = { protan:[[0.11238,0.88762,0],[0.11238,0.88762,0],[0.00401,-0.00401,1]], deutan:[[0.29275,0.70725,0],[0.29275,0.70725,0],[-0.02234,0.02234,1]] };
const enc = v => v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055;
export const cvd = (h,t) => { const c=hex2rgb(h).map(lin), M=CVD[t]; return rgb2hex(M.map(r=>enc(Math.max(0,r[0]*c[0]+r[1]*c[1]+r[2]*c[2])))); };
