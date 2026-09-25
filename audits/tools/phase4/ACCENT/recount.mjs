// Phase 4 ACCENT — section writer's recount of runtime-summary.json (no browser, no server).
// Prints, per area, the accent-bearing groups by type, with non-text failures counted under BOTH
// background models the runtime recorded: vsDecl (paint vs the nearest opaque declared background,
// the `fails` field) and vsOutside (paint vs the pixels 3-5 px outside, the `failsMed` field).
// The re-measure showed vsDecl overstates rings that sit on a card inside a --surface halo; vsOutside
// can overstate thin strokes next to same-hue fills. Neither is used for severity.
// Usage: node audits/tools/phase4/ACCENT/recount.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../../evidence/p4/ACCENT/runtime-summary.json');
const j = JSON.parse(readFileSync(src, 'utf8'));

const areas = {};
for (const g of j.groups) {
  const a = areas[g.area] ??= { text: [0, 0, 0, 0], nontext: [0, 0, 0, 0, 0, 0], decor: 0, fill: 0, collision: 0, bySigned: {} };
  const w = (a.bySigned[g.who] ??= { textCases: 0, textFail: 0, ntCases: 0, ntFailDecl: 0, ntFailOut: 0 });
  if (g.type === 'text') {
    a.text[0]++; if (g.fails) a.text[1]++; a.text[2] += g.cases; a.text[3] += g.fails;
    w.textCases += g.cases; w.textFail += g.fails;
  } else if (g.type === 'nontext') {
    a.nontext[0]++; if (g.fails) a.nontext[1]++; if (g.failsMed) a.nontext[2]++;
    a.nontext[3] += g.cases; a.nontext[4] += g.fails; a.nontext[5] += g.failsMed ?? 0;
    w.ntCases += g.cases; w.ntFailDecl += g.fails; w.ntFailOut += g.failsMed ?? 0;
  } else if (g.type === 'decor') a.decor++;
  else if (g.type === 'fill') a.fill++;
  else if (g.type.startsWith('collision')) a.collision++;
}

console.log('jobs', JSON.stringify({ ok: j.jobs.ok, fail: j.jobs.fail, goErrors: j.jobs.goErrors.length }));
console.log('area | text groups (failing) | text cases failing | non-text groups (failing vsDecl / vsOutside) | non-text cases failing vsDecl / vsOutside | decor | fill | collision');
for (const [k, a] of Object.entries(areas).sort()) {
  console.log(`${k} | ${a.text[0]} (${a.text[1]}) | ${a.text[3]}/${a.text[2]} | ${a.nontext[0]} (${a.nontext[1]} / ${a.nontext[2]}) | ${a.nontext[4]} / ${a.nontext[5]} of ${a.nontext[3]} | ${a.decor} | ${a.fill} | ${a.collision}`);
}
console.log('\nsplit by whose colour (signed-in = the viewer\'s accent tokens; person = another person\'s or an app\'s inline --tint)');
for (const [k, a] of Object.entries(areas).sort()) {
  for (const [who, w] of Object.entries(a.bySigned)) {
    console.log(`${k} | ${who} | text ${w.textFail}/${w.textCases} | non-text ${w.ntFailDecl} (vsDecl) / ${w.ntFailOut} (vsOutside) of ${w.ntCases}`);
  }
}
