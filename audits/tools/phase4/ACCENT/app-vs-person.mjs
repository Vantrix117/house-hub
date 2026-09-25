#!/usr/bin/env node
// Phase 4 ACCENT — app tile colours (apps.json "color", painted as --tint on Home tiles/cards: index.html:700, 1165-1188)
// against the people's colours (worker/seed.sql:4-11, index.html:449 swatches, seeded guests): CIEDE2000 of every app to its
// nearest person, normal and under protan/deutan/tritan.   node audits/tools/phase4/ACCENT/app-vs-person.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLOURS, hex2, de2000, CVD, sim } from './tokens.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8'));
const list = (apps.apps || apps).map(a => {
  const near = COLOURS.map(c => ({ person: c.id, hex: c.hex, de: de2000(hex2(a.color), hex2(c.hex)), worstCvd: Math.min(...Object.values(CVD).map(M => de2000(sim(hex2(a.color), M), sim(hex2(c.hex), M)))) })).sort((x, y) => x.de - y.de)[0];
  return { app: a.id, color: a.color, nearest: near.person, nearestHex: near.hex, de2000: near.de, worstCvd: near.worstCvd, identical: a.color.toUpperCase() === near.hex };
});
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/ACCENT/app-vs-person.json'), JSON.stringify({ note: 'Each app colour (apps.json) and the nearest profile/swatch colour. identical = same hex.', list }, null, 1));
for (const x of list) console.log(x.app.padEnd(15), x.color, '→', x.nearest.padEnd(12), x.nearestHex, 'dE00', x.de2000, 'worst CVD', x.worstCvd, x.identical ? 'IDENTICAL' : '');
