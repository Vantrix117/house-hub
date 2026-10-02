// Batch 5 review round 1, fix 5: the Worker's rule for Verses' household text rows (worker/src/policy.js). On the local
// rig: only text:<week>-<i> keys (week 1-52, i 0|1) in Verses' family scope; the value null (cleared) or
// { text: 1-4000 characters, by: the writer's own id, at }; written by a grown-up (a household adult or a guest), never
// by a kid, the TV or the kitchen. Placeholder text only.
//   node "audits/tools/phase6/5/text-policy-5.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p6/5'); fs.mkdirSync(EV, { recursive: true });
let pass = 0, fail = 0; const out = {};
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); } out[n] = { pass: !!c, got: x }; };
const L = await local({ variant: 'typical', clock: 'real' });
const put = (who, key, value) => L.apiAs(who, '/api/data/verses/' + encodeURIComponent(key) + '?scope=family', { method: 'PUT', body: { value, updated_at: Date.now() } });
const del = (who, key) => L.apiAs(who, '/api/data/verses/' + encodeURIComponent(key) + '?scope=family', { method: 'DELETE' });
const why = r => r.body && (r.body.rejected || r.body.error);
const T = (by, extra = {}) => ({ text: 'Placeholder words - test text, not Scripture.', by, at: Date.now(), ...extra });
try {
  await L.reset('typical');
  const sess = Object.keys(L.S.info.sessions);
  const guest = (L.S.profiles || []).find(p => p.is_guest && sess.includes(p.id));
  out.sessions = sess;
  let r = await put('eli', 'text:12-0', T('eli'));
  ok(r.status === 200, 'a household adult writes text:12-0 = { text, by: self, at }', [r.status, why(r)]);
  r = await put('mom', 'text:52-1', T('mom'));
  ok(r.status === 200, 'another adult writes the last verse, text:52-1', [r.status, why(r)]);
  if (guest) { r = await put(guest.id, 'text:3-1', T(guest.id)); ok(r.status === 200, 'a guest writes a text row', [guest.id, r.status, why(r)]); }
  else ok(false, 'a guest session on the rig', sess);
  for (const k of ['text:0-0', 'text:53-0', 'text:12-2', 'text:12', 'note:12-0', 'TEXT:12-0', 'text:12-0x', 'summary']) { r = await put('eli', k, T('eli')); ok(r.status === 403 && why(r) === 'bad_key', 'key "' + k + '" is refused', [r.status, why(r)]); }
  const bad = [['by someone else', T('mom')], ['no by', { text: 'x', at: 1 }], ['empty text', T('eli', { text: '   ' })], ['4001 characters', T('eli', { text: 'a'.repeat(4001) })], ['not text', { text: 12, by: 'eli', at: 1 }], ['a string', 'just words'], ['an extra field', T('eli', { html: '<b>' })], ['at not a number', T('eli', { at: 'soon' })]];
  for (const [n, v] of bad) { r = await put('eli', 'text:12-0', v); ok(r.status === 403 && why(r) === 'bad_value', 'a value ' + n + ' is refused', [r.status, why(r)]); }
  r = await put('eli', 'text:12-0', T('eli', { text: 'a'.repeat(4000) }));
  ok(r.status === 200, 'exactly 4000 characters is allowed', [r.status, why(r)]);
  // (the kitchen signs in only on the kitchen device, so the rig has no session for it here; Verses is not one of its four
  // apps, so canOpen() refuses it before this rule — test-kitchen.mjs covers the kitchen's family writes)
  for (const who of ['ezra', 'kiara', 'tv'].filter(p => sess.includes(p))) { r = await put(who, 'text:12-0', T(who)); ok(r.status === 403, who + ' cannot write a text row', [r.status, why(r)]); }
  r = await del('ezra', 'text:12-0');
  ok(r.status === 403, 'a kid cannot clear one either', [r.status, why(r)]);
  r = await del('eli', 'text:12-0');
  ok(r.status === 200, 'a grown-up clears one (null)', [r.status, why(r)]);
  r = await L.apiAs('ezra', '/api/data/verses?scope=family');
  ok(r.status === 200, 'a kid still reads the family rows', r.status);
} catch (e) { fail++; console.log('  ✗ crashed:', e.stack || e); }
finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'text-policy-5.json'), JSON.stringify(out, null, 1));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
