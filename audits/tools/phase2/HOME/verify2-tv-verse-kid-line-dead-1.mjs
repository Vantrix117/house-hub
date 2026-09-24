// Skeptic #1 for finding "tv-verse-kid-line-dead": can the TV verse pane's kid line (#tv-kidline, index.html:1056 reads
// wk.line || wk.kid || wk.text of the family kidverse 'week' row) ever show text in real use?
//
//   node "audits/tools/phase2/HOME/verify2-tv-verse-kid-line-dead-1.mjs"
//
//   1. TV (kiosk 'tv', 1920x1080) on the seeded household: what the verse pane and the week row hold.
//   2. The only UI writer: Eli opens Kid Verse and taps the week stepper (+) → setWeek (apps/kidverse.html:338). The row the
//      server then holds, and the TV's kid line after a pull + repaint.
//   3. Control: the same row written with a `line` field over the API (as scripts/test-tv.mjs seeds it) → the TV shows it,
//      so the reader works and only the writer lacks the field.
// Evidence: audits/evidence/p2/HOME/verify2-tv-kidline-*.png|json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const shot = (d, name) => d.page.screenshot({ path: path.join(OUT, name), scale: 'css', animations: 'disabled', caret: 'hide' });

const readTv = page => page.evaluate(() => {
  const k = document.querySelector('#tv-kidline');
  const wk = hub.get('week', { app: 'kidverse', scope: 'family' });
  return {
    verseHd: document.querySelector('#tv-verse-hd')?.textContent.trim(),
    refs: [...document.querySelectorAll('#tv-refs span')].map(s => s.textContent.trim()),
    kidlineText: k ? k.textContent : null,
    kidlineDisplay: k ? getComputedStyle(k).display : null,
    kidlineHeight: k ? k.getBoundingClientRect().height : null,
    weekRowSeenByTv: wk,
  };
});

const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const result = {};
try {
  const row = async () => { const r = await L.apiAs('eli', '/api/data/kidverse?scope=family&key=week'); return r.body && r.body.item; };
  result.seededRow = await row();
  console.log('seeded family kidverse week row (server):', JSON.stringify(result.seededRow));

  // 1. TV at rest
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  await tv.goto('#home');
  await tv.page.waitForSelector('#tv-kidline', { state: 'attached', timeout: 15000 });
  await tv.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  await tv.page.evaluate(() => window.__tv && window.__tv.paint());
  result.tvSeeded = await readTv(tv.page);
  console.log('[1] TV, seeded row:', JSON.stringify(result.tvSeeded));
  await shot(tv, 'verify2-tv-kidline-1-seeded.png');

  // 2. The real writer: Eli taps + in Kid Verse
  const eli = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await eli.goto('#home');
  const f = await eli.openApp('kidverse', { wait: '#week-up' });
  const before = await f.evaluate(() => document.querySelector('#week-now')?.textContent.trim());
  await f.click('#week-up');
  await sleep(300);
  const after = await f.evaluate(() => document.querySelector('#week-now')?.textContent.trim());
  const localRow = await f.evaluate(() => hub.get('week', { scope: 'family' }));
  let serverRow = null;
  for (let i = 0; i < 40; i++) { serverRow = await row(); if (serverRow && serverRow.value && localRow && serverRow.value.at === localRow.at) break; await sleep(250); }
  result.kidverseStepper = { before, after, localRowWritten: localRow, serverRow };
  console.log('[2] Kid Verse stepper', before, '→', after, '; row written:', JSON.stringify(localRow), '; server:', JSON.stringify(serverRow));
  await eli.page.screenshot({ path: path.join(OUT, 'verify2-tv-kidline-2-kidverse-stepper.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  await tv.page.evaluate(() => hub.pull());
  await tv.page.waitForFunction(w => { const v = hub.get('week', { app: 'kidverse', scope: 'family' }); return v && v.at === w; }, localRow && localRow.at, { timeout: 15000 }).catch(() => {});
  await tv.page.evaluate(() => window.__tv && window.__tv.paint());
  result.tvAfterStepper = await readTv(tv.page);
  console.log('[2] TV after the stepper write:', JSON.stringify(result.tvAfterStepper));
  await shot(tv, 'verify2-tv-kidline-2-after-stepper.png');

  // 3. Control: same row with a `line` field (API write, as test-tv.mjs seeds it)
  const wkNow = (serverRow && serverRow.value && serverRow.value.week) || 3;
  const put = await L.apiAs('eli', '/api/data/kidverse/week?scope=family', { method: 'PUT', body: { value: { week: wkNow, by: 'eli', at: Date.now(), line: 'CONTROL kid line from the row' }, updated_at: Date.now() + 1000 } });
  result.controlPut = put.status;
  await tv.page.evaluate(() => hub.pull());
  await tv.page.waitForFunction(() => { const v = hub.get('week', { app: 'kidverse', scope: 'family' }); return v && v.line; }, null, { timeout: 15000 }).catch(() => {});
  await tv.page.evaluate(() => window.__tv && window.__tv.paint());
  result.tvControl = await readTv(tv.page);
  console.log('[3] control PUT', put.status, '; TV:', JSON.stringify(result.tvControl));
  await shot(tv, 'verify2-tv-kidline-3-control-line.png');
} finally {
  fs.writeFileSync(path.join(OUT, 'verify2-tv-kidline.json'), JSON.stringify(result, null, 1));
  await L.close();
}
