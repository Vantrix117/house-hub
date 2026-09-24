// Visual-score checker: WCAG contrast of the wait-tile inks (apps/dollywood-live.html:497-501).
// Pure computation from the literal colours in the CSS; no browser, no server.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const src = readFileSync('apps/dollywood-live.html', 'utf8').split('\n');
const l500 = src[499], l501 = src[500], l497 = src[496];
const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
const lum = c => { const [r, g, b] = hex(c).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const bands = [...l501.matchAll(/\.wtile\[data-w=(\w+)\]\{background:(#[0-9A-Fa-f]{6})\}/g)].map(m => ({ band: m[1], bg: m[2] }));
const small = (l500.match(/\.wtile small\{font-size:([\d.]+)px/) || [])[1];
const big = (l500.match(/\.wtile b\{font-size:([\d.]+)px;font-weight:(\d+)/) || []).slice(1);
const out = {
  source: 'apps/dollywood-live.html:500-501 (.wtile), :497 (.wt chip)',
  numeral: { fontPx: +big[0], weight: +big[1], note: 'large text (>=18.66px bold) needs 3:1' },
  minLabel: { fontPx: +small, note: 'normal text needs 4.5:1; house floor is 11px' },
  bands: bands.map(b => ({ ...b, fg: '#FFFFFF', ratio: cr('#FFFFFF', b.bg), numeralPass3: cr('#FFFFFF', b.bg) >= 3, minLabelPass45: cr('#FFFFFF', b.bg) >= 4.5 })),
  chip: { line497: l497.slice(0, 200), fg: '#1C1714', bg: '#E5E1DA', ratio: cr('#1C1714', '#E5E1DA') },
};
mkdirSync('audits/evidence/p3/dollywood-live', { recursive: true });
writeFileSync('audits/evidence/p3/dollywood-live/vischeck-contrast.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
