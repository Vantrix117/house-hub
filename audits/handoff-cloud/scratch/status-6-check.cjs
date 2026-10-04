const fs = require('fs'), path = require('path');
const SCRATCH = __dirname;
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const data = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'status-6.json'), 'utf8'));
const md = fs.readFileSync(path.join(SCRATCH, 'b6.md'), 'utf8');
const mdIds = [...md.matchAll(/^#### (\S+)/gm)].map(m => m[1]);
const CARRY = ['CONS-TYPE-1', 'CONS-TYPE-2', 'GAP-TOK-4', 'P4-SHAPE-01', 'CONS-ICON-1', 'CONS-ICON-2', 'GAP-ICON-2', 'CONS-TELL-1', 'CONS-MOTION-1', 'CONS-DARK-1', 'CONS-ACCENT-2', 'P4-ICON-01', 'GAP-TOK-3', 'VIS-COLOR-1'];
const ok = [], fail = [];
const check = (c, msg) => (c ? ok : fail).push(msg);
check(JSON.stringify(data.entries.map(e => e[0])) === JSON.stringify(mdIds), `entries equal b6.md in order (${data.entries.length} vs ${mdIds.length})`);
check(JSON.stringify((data.work || []).map(e => e[0])) === JSON.stringify(['IMP-TIMER-I2']), 'work = IMP-TIMER-I2');
check(JSON.stringify((data.carry || []).map(e => e[0])) === JSON.stringify(CARRY), 'carry = the 14 ids in order');
const STATUSES = ['FIXED', 'PARTIAL', 'DEFERRED', 'NEEDS DEVICE CHECK'];
const counts = {};
for (const [sec, rows] of [['entries', data.entries], ['work', data.work || []], ['carry', data.carry || []]]) for (const [id, status, note, after] of rows) {
  check(STATUSES.includes(status), `${id}: status ${status}`);
  counts[sec + ' ' + status] = (counts[sec + ' ' + status] || 0) + 1;
  check(typeof note === 'string' && note.length > 0 && note.length <= 760, `${id}: note ${note.length} chars`);
  check(Array.isArray(after) && after.length >= 1 && after.length <= 4, `${id}: ${after.length} paths`);
  for (const p of after) check((p.startsWith('audits/evidence/p6/6/') || p.startsWith('audits/screens-after/6/')) && fs.existsSync(path.join(REPO, p)), `${id}: exists ${p}`);
  check(!/[A-Za-z0-9_+/=]{24,}/.test(note) && !/pairing code is|PIN is \d/i.test(note), `${id}: no key-like strings or codes`);
}
console.log(fail.length ? 'FAIL:\n' + fail.join('\n') : 'all ' + ok.length + ' checks pass');
console.log(counts);
