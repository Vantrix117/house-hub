// Skeptic s1 for VIS-PRAYER-1: token-level WCAG contrast of the cited pairs, computed from apps/design.css values
// (flat colours, no rendering) to cross-check the rendered p10 numbers in audits/evidence/p3/prayer/contrast.json.
// Run: node audits/tools/phase5/ux-verify/VIS-PRAYER-1/s1-contrast-calc.mjs -> audits/evidence/p5/ux-verify/VIS-PRAYER-1/s1/calc.json
import fs from 'node:fs';
const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = rgb => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const cr = (a, b) => { const x = L(typeof a === 'string' ? hex(a) : a), y = L(typeof b === 'string' ? hex(b) : b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const mix = (a, b, t) => hex(a).map((v, i) => Math.round(v * t + hex(b)[i] * (1 - t)));
const T = {
  hearth:   { bg: '#F7F2EB', surface: '#FFFCF8', s2: '#EFE7DC', muted: '#75675B', gold: '#B4861B', goldSoft: '#F6EBD0', teal: '#137F77', tealSoft: '#DCECEA', terra: '#BC5A38' },
  parchment:{ bg: '#E7D9BE', surface: '#F1E7D2', s2: '#DDCBA9', muted: '#6A5641', gold: '#9A6F0E', goldSoft: '#E8D5A2', teal: '#0F6E67', tealSoft: '#CFDCCF', terra: '#A84B2C' },
  frost:    { bg: '#EDF0F5', surface: '#FAFBFD', s2: '#E2E7EE', muted: '#5C6879', gold: '#A07A1F', goldSoft: '#F2EAD3', teal: '#137F77', tealSoft: '#DAEDEA', terra: '#B25538' },
  midnight: { bg: '#1A1512', surface: '#241E19', s2: '#15110E', muted: '#A2948A', gold: '#E0B25A', goldSoft: '#2C2416', teal: '#5EC2B8', tealSoft: '#12241F', terra: '#E28A66' },
  forest:   { bg: '#10171A', surface: '#182225', s2: '#0C1214', muted: '#9C9484', gold: '#D9B25E', goldSoft: '#2A2618', teal: '#62C3B8', tealSoft: '#132925', terra: '#E08E6B' },
};
const out = {};
for (const [n, t] of Object.entries(T)) {
  out[n] = {
    answeredRecently_gold_on_goldSoft: cr(t.gold, t.goldSoft),
    recordDate_gold_on_bg: cr(t.gold, t.bg),
    anniv_gold_on_bg: cr(t.gold, t.bg),
    sharedPill_teal_on_tealSoft: cr(t.teal, t.tealSoft),
    cold_terra_on_bg: cr(t.terra, t.bg),
    switchUnpressed_muted_on_s2: cr(t.muted, t.s2),
    doneTitle_muted_on_bg: cr(t.muted, t.bg),
    navLabel_muted_on_glassStrongOverBg: cr(t.muted, mix(t.surface, t.bg, 0.84)),
  };
}
fs.writeFileSync('audits/evidence/p5/ux-verify/VIS-PRAYER-1/s1/calc.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
