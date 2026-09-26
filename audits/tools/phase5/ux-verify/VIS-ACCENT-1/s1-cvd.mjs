// s1: CIEDE2000 between the raw household profile colours under Machado (2009) full-severity CVD simulation.
import fs from 'node:fs';
const P = { Eli: '#4F5D8C', Mae: '#BC5A38', Ezra: '#137F77', Kiara: '#B4861B', Elizabeth: '#8A6A4B', David: '#3D5A3D', Mea: '#5B8143' };
const M = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const clamp = v => Math.min(1, Math.max(0, v));
function lab(rgbLin) {
  const [r, g, b] = rgbLin;
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function de00([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (a, b) => { const t = Math.atan2(b, a) / rad; return t < 0 ? t + 360 : t; }, h1 = h(a1p, b1), h2 = h(a2p, b2);
  let dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * rad / 2), Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hb = h1 + h2; if (Math.abs(h1 - h2) > 180) hb = hb < 360 ? hb + 360 : hb - 360; hb /= 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const dT = 30 * Math.exp(-(((hb - 275) / 25) ** 2)), RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + 0.015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T, RT = -Math.sin(2 * dT * rad) * RC;
  return Math.sqrt(((L2 - L1) / SL) ** 2 + ((C2p - C1p) / SC) ** 2 + (dH / SH) ** 2 + RT * ((C2p - C1p) / SC) * (dH / SH));
}
const out = {};
for (const [k, m] of Object.entries({ normal: null, ...M })) {
  const labs = Object.fromEntries(Object.entries(P).map(([n, h]) => { let c = hex(h).map(lin); if (m) c = m.map(row => clamp(row[0] * c[0] + row[1] * c[1] + row[2] * c[2])); return [n, lab(c)]; }));
  const n = Object.keys(P), pairs = [];
  for (let i = 0; i < n.length; i++) for (let j = i + 1; j < n.length; j++) pairs.push([n[i] + '/' + n[j], +de00(labs[n[i]], labs[n[j]]).toFixed(2)]);
  pairs.sort((a, b) => a[1] - b[1]); out[k] = { under5: pairs.filter(p => p[1] < 5).length, closest: pairs.slice(0, 5) };
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1)); console.log(JSON.stringify(out));
