// Skeptic #2 for "finish-leftover-wrong-item": does finish_leftover (worker/src/chat.js:263-282) remove a DIFFERENT food
// when the spoken name is not on the list?  Independent of 07-loose-match.mjs: a fresh local instance on the DEMO clock
// (so no seeded row sits in the rig's future and wins LWW over the tombstone), controls that SHOULD match loosely, the
// tool_result the model gets back, the 8 am morning job's due list before/after, and whether chat can put it back.
//   node "audits/tools/phase2/CHAT/verify-finish-leftover-wrong-item-2.mjs"
import { local } from '../../lib/local.mjs';
import { toolCall, data, save, feed } from './lib.mjs';

const L = await local({ variant: 'typical', clock: 'demo' });
const out = { cases: [], morning: {}, restore: {} };
const live = async () => (await data(L, 'eli', 'leftovers', 'family')).filter(x => x.value).map(x => x.value);
try {
  const fridge0 = await live();
  console.log('typical fridge:', JSON.stringify(fridge0.map(i => `${i.name} (${i.size}, ${i.dateLogged})`)));
  const cases = [
    // [what the person said, kind]
    ['chicken noodle soup', 'not on list'], ['sweet tea', 'not on list'], ['meatball sub', 'not on list'],
    ['mac and cheese', 'not on list (stopword "and")'], ['the soup', 'not on list (stopword "the")'],
    ['pancake batter', 'not on list'], ['pot pie', 'not on list (2 hits)'],
    ['alfredo', 'control: loose, intended'], ['the chili', 'control: loose, intended'], ['meatballs', 'control: loose, intended'],
    ['Chicken alfredo', 'control: exact'],
  ];
  for (const [said, kind] of cases) {
    await L.reset('typical');
    const before = (await live()).map(i => i.name);
    const r = await toolCall(L, 'eli', 'finish_leftover', { name: said }, { message: `we finished the ${said}` });
    const after = (await live()).map(i => i.name);
    const removed = before.filter(n => !after.includes(n));
    const f = await feed(L, 'eli', 1);
    const rec = { said, kind, ok: r.ok, chip: r.chip, removed, toolResultToModel: r.toolResult && String(r.toolResult.content).slice(0, 200), feedTop: JSON.stringify(f).slice(0, 200) };
    out.cases.push(rec);
    console.log(`[${kind}] "${said}" -> chip=${JSON.stringify(r.chip)} removed=${JSON.stringify(removed)} model_sees=${rec.toolResultToModel && rec.toolResultToModel.slice(0, 110)}`);
  }

  // Consequence + recovery: morning job due list before, after the wrong removal, after re-adding through chat.
  await L.reset('typical');
  const orig = (await live()).find(i => i.name === 'Chicken alfredo');
  const due = async () => { const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'morning' } }); return r.body && r.body.due; };
  out.morning.before = await due();
  await toolCall(L, 'eli', 'finish_leftover', { name: 'chicken noodle soup' }, { message: 'we finished the chicken noodle soup' });
  out.morning.afterWrongRemoval = await due();
  const re = await toolCall(L, 'eli', 'add_list_item', { app_id: 'leftovers', item: { name: orig.name, size: orig.size, dateLogged: orig.dateLogged } }, { message: 'put the chicken alfredo back, logged ' + orig.dateLogged });
  const back = (await live()).find(i => i.name === 'Chicken alfredo');
  out.morning.afterReAdd = await due();
  out.restore = { original: orig, reAddChip: re.chip, restored: back };
  console.log('morning job due, before          :', JSON.stringify(out.morning.before));
  console.log('morning job due, after wrong hit :', JSON.stringify(out.morning.afterWrongRemoval));
  console.log('re-add via chat add_list_item    :', re.chip, '->', JSON.stringify(back));
  console.log('morning job due, after re-add    :', JSON.stringify(out.morning.afterReAdd));
  console.log('evidence:', save('verify-finish-leftover-wrong-item-2.json', out));
} finally { await L.close(); }
