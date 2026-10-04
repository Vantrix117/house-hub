// Batch 8 copy of audits/tools/phase3/leftovers/thresholds.mjs (see _thr8.mjs for why: the original crashes on
// document.getElementById('alert'), an id removed in an earlier batch). The same typical fridge, through the four surfaces:
// the Larder's groups and red banner, Home's "In the fridge" card, the Apps tile badge and the 8 am push (forced as admin).
//   node "audits/tools/phase6/8/thresholds-8.mjs"   (run from the repo root; also on the pre-batch archive for the "before")
import path from 'node:path';
import { local, surfaces, serverItems, agree, finish, EV8 } from './_thr8.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const s = await surfaces(L, { device: 'ipad-portrait', profile: 'eli' });
  await s.d.page.screenshot({ path: path.join(EV8, 'thresholds-8-larder.png'), scale: 'css' });
  console.log(JSON.stringify({ larder: s.larder, home: s.home, badge: s.badge, push: { due: s.push.due, body: s.push.body } }, null, 1));
  agree(s, await serverItems(L), 'typical fridge: ');
} finally { await L.close(); }
finish('thresholds-8');
