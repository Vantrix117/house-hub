// SYNC e2h — hub.migrate() decides "the server has nothing yet" from the LOCAL cache only (apps/hub.js:406-407), although its
// comment says "only if that key is still empty on the server" (apps/hub.js:391-392). A phone that still holds the pre-hub
// standalone F260's localStorage (f260.done, f260.week, f260.log …) and whose first F260 pull is slower than hub.ready's 6 s wait
// migrates that old copy over Eli's real progress.
//   node "audits/tools/phase2/SYNC/e2h-migrate-race.mjs"
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, shot, writeEvidence } from './_util.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const legacyDone = {}; for (let w = 1; w <= 3; w++) for (let d = 0; d < 5; d++) legacyDone[w + '-' + d] = true;   // the old app: weeks 1-3 read
  const legacy = { 'f260.done': legacyDone, 'f260.week': 4, 'f260.log': { '2026-01-20': true, '2026-01-21': true }, 'f260.mem': { '1-0': true } };
  out.before = { done: Object.keys((await serverRow(L, 'eli', 'f260', 'f260.done')).value).length, week: (await serverRow(L, 'eli', 'f260', 'f260.week')).value, mem: Object.keys((await serverRow(L, 'eli', 'f260', 'f260.mem')).value).length };
  log('server before:', JSON.stringify(out.before));
  const ph = await L.newDevice({ name: 'Eli old phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph, localStorage: legacy });
  let holdUntil = Date.now() + 60000;
  await phone.ctx.route(/\/api\/data\/f260\?/, async route => { if (route.request().method() === 'GET' && Date.now() < holdUntil) await sleep(8000); route.continue().catch(() => {}); });
  const f = await phone.openApp('f260');
  await sleep(7000); holdUntil = 0; await sleep(12000);
  out.after = { done: Object.keys((await serverRow(L, 'eli', 'f260', 'f260.done')).value).length, week: (await serverRow(L, 'eli', 'f260', 'f260.week')).value, mem: Object.keys((await serverRow(L, 'eli', 'f260', 'f260.mem')).value).length, log: (await serverRow(L, 'eli', 'f260', 'f260.log')).value };
  out.migratedMark = await phone.page.evaluate(() => localStorage.getItem('hub.migrated'));
  out.phoneUi = { today: await f.textContent('#todayTitle'), count: await f.textContent('#doneCount') };
  out.shot = await shot(phone.page, 'e2h-phone-f260-after-migrate.png');
  log('server after:', JSON.stringify({ ...out.after, log: Object.keys(out.after.log).length + ' days' }), '| hub.migrated =', out.migratedMark);
  log('phone F260 now:', JSON.stringify(out.phoneUi));
  log('evidence', writeEvidence('e2h-migrate-race.json', out));
} finally { await L.close(); }
