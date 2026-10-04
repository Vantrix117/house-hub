const fs = require('fs');
const SP = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/';
const F = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub/audits/tools/phase6/status.mjs';
const S = JSON.parse(fs.readFileSync(SP + 'status-6.json', 'utf8'));
let t = fs.readFileSync(F, 'utf8');
if (t.includes("'6': {")) throw new Error('already applied');
const rep = (a, b) => { if (!t.includes(a)) throw new Error('missing ' + a.slice(0, 60)); t = t.replace(a, b); };
rep(`  '5': { commit: '2f699c2', date: '2026-10-01' },\n};`, `  '5': { commit: '2f699c2', date: '2026-10-01' },\n  '6': { commit: 'PENDING', date: '2026-10-02' },\n};`);
const line = fn => ([id, st, note, after]) => `  ${fn}(${JSON.stringify(id)}, ${JSON.stringify(note)}, ${JSON.stringify(after)}${st === 'FIXED' ? '' : ', ' + JSON.stringify(st)}),`;
rep(`\nexport const WORK_STATUS = {`, `
// Batch 6 (the Kitchen timer, its shell pill, Home card, Kitchen and TV views, the timer push, and the shared SDK's
// per-document write queues): after-evidence under audits/evidence/p6/6/ (the finding scripts' outputs in p2/ p3/ p4/,
// every script's console output before and after in tests/ incl. the copies and claims checks in audits/tools/phase6/6/,
// the checks in checks/, the timer, shell and TV re-measured in measure/, the Phase 4 tools before and after in p4tools/,
// the pixel diffs in capture/, the workers' evidence in workers/, the review in review/, the Timer rescore in rescore.md).
// IMP-TIMER-I2 is in WORK_STATUS below.
const W6 = (id, note, after, status = 'FIXED') => [id, { status, batch: '6', note, after }];
// an earlier batch's carry-over advanced here: it stays in its home section (batch 1 for every one of them)
const W6c = (id, note, after, status = 'FIXED', home = '1') => [id, { status, batch: '6', home, note, after }];
const S6 = [
${S.entries.map(line('W6')).join('\n')}
${S.carry.map(line('W6c')).join('\n')}
];
const S6work = [
${S.work.map(line('W6')).join('\n')}
];

export const WORK_STATUS = {`);
rep(`for (const [id, s] of S5work) WORK_STATUS[id] = s;`, `for (const [id, s] of S5work) WORK_STATUS[id] = s;\nfor (const [id, s] of S6) STATUS[id] = s;\nfor (const [id, s] of S6work) WORK_STATUS[id] = s;`);
fs.writeFileSync(F, t);
console.log('ok', S.entries.length, S.carry.length, S.work.length);
