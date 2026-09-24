// Probe: what Eli's Verses shows on the typical seed, and the raw rows behind it.
import { local, DEMO } from '../../lib/local.mjs';
import { openVerses, state, serverRow } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
  const f = await openVerses(ipad);
  console.log(JSON.stringify(await state(f), null, 1));
  const rc = await serverRow(L, 'eli', 'f260', 'f260.recall');
  const lg = await serverRow(L, 'eli', 'verses', 'log');
  const sm = await serverRow(L, 'eli', 'verses', 'summary');
  console.log('recall ids', Object.keys(rc.value).length, JSON.stringify(Object.entries(rc.value).slice(0, 3)));
  console.log('log', JSON.stringify(lg)); console.log('summary', JSON.stringify(sm));
  console.log('ezra recall', JSON.stringify(await serverRow(L, 'ezra', 'f260', 'f260.recall')));
  console.log('ezra log', JSON.stringify(await serverRow(L, 'ezra', 'verses', 'log')));
  console.log('family week', JSON.stringify(await serverRow(L, 'eli', 'kidverse', 'week', 'family')));
  console.log(ipad.logs.slice(0, 10));
} finally { await L.close(); }
