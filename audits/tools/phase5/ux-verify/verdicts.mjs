// Phase 5 step 3: turns the two-skeptic workflow's result into the record build-findings.mjs reads.
//   in:  audits/evidence/p5/ux-verify/workflow-result.json  ({ tally, results: [{ id, group, rated, s1, s2, tie, final }] })
//        audits/evidence/p5/ux-verify/targets.json          (targets.mjs: the items that had to be verified)
//   out: audits/evidence/p5/ux-verify/verdicts.json         (the same results, checked: one per target, each with a final)
//        audits/evidence/p5/ux-verify/verdicts.md           (a readable table and every vote in full)
// Exit 1 if a target has no result or no final verdict.
//   node audits/tools/phase5/ux-verify/verdicts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const D = p => path.join(ROOT, 'audits/evidence/p5/ux-verify', p);
const wf = JSON.parse(fs.readFileSync(D('workflow-result.json'), 'utf8'));
const targets = JSON.parse(fs.readFileSync(D('targets.json'), 'utf8')).groups.flatMap(g => g.items.map(i => ({ ...i, group: g.key, file: g.file })));
const byId = Object.fromEntries(wf.results.map(r => [r.id, r]));
const bad = targets.filter(t => !byId[t.id] || !byId[t.id].final).map(t => t.id);
if (bad.length) { console.error('no final verdict:', bad.join(' ')); process.exit(1); }

const SEV = ['critical', 'high', 'medium', 'low', 'info'];
const results = targets.map(t => ({ ...byId[t.id], kind: t.kind, source: `${t.file}:${t.line}` }));
fs.writeFileSync(D('verdicts.json'), JSON.stringify({ count: results.length, results }, null, 1));

const one = s => (s || '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
const vote = x => x ? (x.holds === 'refuted' ? 'refuted' : x.severity + (x.holds === 'partly' ? ' (partly)' : '')) + (x.reproduced ? ', reproduced' : '') : '—';
const fin = r => r.final.holds === 'refuted' ? '**refuted**' : `**${r.final.severity}**${r.final.holds === 'partly' ? ' (partly)' : ''}`;
const moved = r => r.final.holds === 'refuted' ? 'refuted' : r.final.severity === r.rated ? 'kept' : SEV.indexOf(r.final.severity) < SEV.indexOf(r.rated) ? 'raised' : 'lowered';
const tally = results.reduce((m, r) => (m[moved(r)] = (m[moved(r)] || 0) + 1, m), {});
const to = results.reduce((m, r) => { const k = r.final.holds === 'refuted' ? 'refuted' : r.final.severity; m[k] = (m[k] || 0) + 1; return m; }, {});

const L = [];
const P = s => L.push(s);
P('# Step 3: two-skeptic verification of the high and medium UX, VIS, CONS and GAP items');
P('');
P(`The household asked that every usability, visual, consistency and gap item rated high or medium be checked by two skeptics before Phase 6 (\`audits/05-decisions.md\`, "Other items"). ${results.length} items qualified (\`targets.mjs\`). Two independent skeptics checked each one against primary evidence: the code, the full-size captures, the measurement output, or a run of their own. They applied the severity rule of \`audits/02-shell.md:25-37\`. Where they disagreed on whether the item holds or on its severity, a tie-breaker read both, checked the point in dispute and gave the final verdict. The skeptics' scripts are in \`audits/tools/phase5/ux-verify/<ID>/\` and their outputs in \`audits/evidence/p5/ux-verify/<ID>/\`.`);
P('');
P(`**Result.** ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(', ')}. Final ratings: ${SEV.concat('refuted').filter(k => to[k]).map(k => `${to[k]} ${k}`).join(', ')}. ${results.filter(r => r.tie).length} items went to a tie-breaker. \`build-findings.mjs\` carries these into \`audits/05-findings.md\`.`);
P('');
P('| ID | Source | Was | Skeptic 1 | Skeptic 2 | Tie-break | Final | Change |');
P('|---|---|---|---|---|---|---|---|');
for (const r of results) P(`| ${r.id} | \`${r.source}\` | ${r.rated} | ${vote(r.s1)} | ${vote(r.s2)} | ${r.tie ? vote(r.tie) : '—'} | ${fin(r)} | ${moved(r)} |`);
P('');
P('## Every vote');
for (const r of results) {
  P('');
  P(`### ${r.id} — was ${r.rated}, final ${r.final.holds === 'refuted' ? 'refuted' : r.final.severity}${r.final.holds === 'partly' ? ' (partly)' : ''}`);
  P('');
  P(`Source: \`${r.source}\`; item text: \`audits/evidence/p5/ux-verify/items/${r.id}.md\`.`);
  for (const [who, x] of [['Skeptic 1', r.s1], ['Skeptic 2', r.s2], ['Tie-breaker', r.tie]]) {
    if (!x) { if (who !== 'Tie-breaker') P(`- **${who}:** no verdict returned.`); continue; }
    P(`- **${who}: ${x.holds}, ${x.severity}**${x.reproduced ? ' (reproduced)' : ' (from the evidence, not reproduced)'}.`);
    P(`  - Method: ${one(x.method)}`);
    P(`  - Observed: ${one(x.observed)}`);
    P(`  - Severity: ${one(x.rationale)}`);
    if (one(x.correction)) P(`  - Correction: ${one(x.correction)}`);
    if (x.citations && x.citations.length) P(`  - Cited: ${x.citations.map(c => '`' + one(c) + '`').join(', ')}`);
  }
}
fs.writeFileSync(D('verdicts.md'), L.join('\n') + '\n');
console.log(results.length, 'verdicts;', JSON.stringify(tally), JSON.stringify(to));

// Evidence hygiene (as in Phases 3-4): commit only PNGs a verdict cites, up to 1 MB each; the rest (uncited, or large
// full-page captures) are git-ignored here and regenerate from the skeptic's committed script.
const EV = path.join(ROOT, 'audits/evidence/p5/ux-verify');
const txt = JSON.stringify(results);
const pngs = [];
(function scan(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) scan(p); else if (p.endsWith('.png')) pngs.push(p); } })(EV);
const rel = p => path.relative(EV, p).split(path.sep).join('/');
const keep = p => (txt.includes(rel(p)) || txt.includes(path.basename(p))) && fs.statSync(p).size <= 1e6;
const drop = pngs.filter(p => !keep(p)).map(rel).sort();
fs.writeFileSync(path.join(EV, '.gitignore'), '# written by audits/tools/phase5/ux-verify/verdicts.mjs: PNGs no verdict cites, or over 1 MB (rerun the skeptic\'s script to regenerate)\n' + drop.join('\n') + '\n');
const mb = a => (a.reduce((t, p) => t + fs.statSync(p).size, 0) / 1e6).toFixed(1);
console.log(`evidence PNGs: ${pngs.length - drop.length} kept (${mb(pngs.filter(keep))} MB), ${drop.length} ignored`);
