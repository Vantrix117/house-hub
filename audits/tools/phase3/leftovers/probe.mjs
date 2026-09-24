// Probe: API row shape, the app's first render as Eli on the iPhone PWA (typical seed, demo clock).
import { local, openLarder, cards, serverItems } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  console.log('GET keys:', Object.keys(r.body), JSON.stringify(r.body).slice(0, 300));
  console.log('server live items:', JSON.stringify(await serverItems(L)));
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const f = await openLarder(d);
  console.log('cards:', JSON.stringify(await cards(f), null, 0));
  console.log('logs:', d.logs.slice(0, 10));
} finally { await L.close(); }
