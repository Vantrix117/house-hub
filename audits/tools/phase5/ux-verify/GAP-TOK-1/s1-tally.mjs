// s1: tally checked vs unchecked pair kinds/cases/fails from the Phase 4 token-pairs evidence, and count the guide's rows.
import fs from 'node:fs';
const j = JSON.parse(fs.readFileSync('audits/evidence/p4/TOK/token-pairs.json', 'utf8'));
const v = Object.values(j.byPair); const un = v.filter(p => !p.checkedByGuide), ch = v.filter(p => p.checkedByGuide);
const s = a => a.reduce((x, p) => x + p.cases, 0), f = a => a.reduce((x, p) => x + p.fails, 0);
const guide = fs.readFileSync('docs/design.html', 'utf8'); const PEOPLE = (guide.match(/const PEOPLE = \[(.*?)\];/) || [])[1] || '';
const out = { checkedKinds: ch.length, checkedCases: s(ch), checkedFails: f(ch), uncheckedKinds: un.length, uncheckedCases: s(un), uncheckedFails: f(un),
  failingUncheckedKinds: un.filter(p => p.fails).map(p => `${p.pair} ${p.fails}/${p.cases} min ${p.min_ratio}`),
  fileSummary: j.summary, guidePeopleColours: (PEOPLE.match(/#[0-9A-F]{6}/gi) || []) };
fs.writeFileSync('audits/evidence/p5/ux-verify/GAP-TOK-1/s1/tally.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
