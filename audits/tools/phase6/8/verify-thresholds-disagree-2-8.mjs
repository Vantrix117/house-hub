// Batch 8 copy of verify-thresholds-disagree-2.mjs (see _thr8.mjs): an empty fridge seeded with one dish at each age 3..8 days
// (the demo date is Tue 22 Sep 2026, New York), read through the Larder, Home, the Apps badge and the forced 8 am job. The
// edges are the claim: 3 fresh; 4, 5, 6 eat soon; 7, 8 use it up -- on every surface alike.
import path from 'node:path';
import { local, seedAges, serverItems, surfaces, agree, finish, EV8, ok } from './_thr8.mjs';
const L = await local({ variant: 'empty', clock: 'demo' });
try {
  const w = await seedAges(L, [3, 4, 5, 6, 7, 8]);
  ok(w.status === 200, 'seeded six dishes, ages 3..8', w.status);
  const s = await surfaces(L, { device: 'ipad-portrait', profile: 'eli' });
  await s.d.page.screenshot({ path: path.join(EV8, 'verify-thresholds-disagree-2-8.png'), scale: 'css' });
  console.log(JSON.stringify({ larder: s.larder, home: s.home, badge: s.badge, push: { due: s.push.due, body: s.push.body } }, null, 1));
  agree(s, await serverItems(L), 'ages 3..8: ');
} finally { await L.close(); }
finish('verify-thresholds-disagree-2-8');
