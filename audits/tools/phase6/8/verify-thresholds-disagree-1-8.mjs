// Batch 8 copy of verify-thresholds-disagree-1.mjs (see _thr8.mjs): one typical fridge on an iPhone as Mom, read through the
// Larder, the Home card, the Apps badge and the 8 am push job (the phone's Home card shows both counts).
import path from 'node:path';
import { local, surfaces, serverItems, agree, finish, EV8 } from './_thr8.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const s = await surfaces(L, { device: 'iphone-pwa', profile: 'mom' });
  await s.d.page.screenshot({ path: path.join(EV8, 'verify-thresholds-disagree-1-8.png'), scale: 'css' });
  console.log(JSON.stringify({ larder: s.larder, home: s.home, badge: s.badge, push: { due: s.push.due, body: s.push.body } }, null, 1));
  agree(s, await serverItems(L), 'iPhone, Mom: ');
} finally { await L.close(); }
finish('verify-thresholds-disagree-1-8');
