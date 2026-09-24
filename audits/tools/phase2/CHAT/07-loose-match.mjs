// CHAT 07 — finish_leftover's loose name matching (worker/src/chat.js:269-275) removes a DIFFERENT food when one word
// overlaps, with a ✓ chip, no confirmation and no undo. Each case runs on a freshly reset typical fridge.
//   node "audits/tools/phase2/CHAT/07-loose-match.mjs"
import { local } from '../../lib/local.mjs';
import { toolCall, data, save } from './lib.mjs';

const L = await local({ variant: 'typical', clock: 'real' });
const out = [];
try {
  // what a person might say about food that is NOT on the list
  for (const said of ['chicken noodle soup', 'sweet tea', 'meatball sub', 'pancake batter', 'pot pie']) {
    await L.reset('typical');
    const before = (await data(L, 'eli', 'leftovers', 'family')).filter(x => x.value).map(x => x.value.name);
    const r = await toolCall(L, 'eli', 'finish_leftover', { name: said }, { message: `we finished the ${said}` });
    const after = (await data(L, 'eli', 'leftovers', 'family')).filter(x => x.value).map(x => x.value.name);
    const removed = before.filter(n => !after.includes(n));
    out.push({ said, chip: r.chip, removed, ok: r.ok, result: r.toolResult && r.toolResult.content.slice(0, 160) });
    console.log(`"${said}" -> ${r.chip || '(no chip) ' + (r.toolResult && r.toolResult.content.slice(0, 120))}   removed: ${JSON.stringify(removed)}`);
  }
  console.log('fridge (typical):', JSON.stringify((await data(L, 'eli', 'leftovers', 'family')).filter(x => x.value).map(x => x.value.name)));
  console.log('evidence:', save('07-loose-match.json', out));
} finally { await L.close(); }
