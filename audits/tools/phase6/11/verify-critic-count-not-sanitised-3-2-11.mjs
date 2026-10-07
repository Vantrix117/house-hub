// Batch 11 copy of audits/tools/phase3/tally/verify-critic-count-not-sanitised-3-2.mjs: changed on purpose, because the off buttons (- at 0 and + at 999 999, Reset at 0: P3-TALLY-04, P3-TALLY-08) are aria-disabled, which Playwright will not click; the clicks are forced ({ force: true }) to prove that a forced tap on an off button writes nothing. Everything else is the original.
// Skeptic 2 for critic-count-not-sanitised-3: does Tally show/count from a non-integer or negative count?
// Two writers: chat set_data as Ezra (scripted model, via phase2/CHAT/lib.mjs toolCall) and raw PUT /api/data as Ezra.
// For each case: open Ezra's Tally on the iPad (fresh device), read #n, tap + once, read #n and the server row.
// Run: node "audits/tools/phase3/tally/verify-critic-count-not-sanitised-3-2.mjs"
//   -> audits/evidence/p3/tally/verify-critic-count-not-sanitised-3-2.json (+ one PNG of the -13 case before +)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
import { toolCall } from '../../phase2/CHAT/lib.mjs';
const OUT = 'audits/evidence/p6/11/p3copies';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = [];
const server = async () => { const r = await L.apiAs('ezra', '/api/data/tally?scope=person&key=count'); return r.body.item ? r.body.item.value : null; };
const cases = [
  { via: 'chat', value: -13 }, { via: 'chat', value: 12.5 }, { via: 'raw', value: 1e21 }, { via: 'raw', value: -4 },
];
try {
  for (const c of cases) {
    let w;
    if (c.via === 'chat') { const t = await toolCall(L, 'ezra', 'set_data', { app_id: 'tally', scope: 'person', key: 'count', value: c.value }, { message: 'take some off my tally' }); w = { ok: t.ok, chip: t.chip }; }
    else { const r = await L.apiAs('ezra', '/api/data/tally/count?scope=person', { method: 'PUT', body: { value: c.value, updated_at: Date.now() } }); w = { status: r.status, body: r.body }; }
    const stored = await server();
    const d = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
    const f = await d.openApp('tally');
    await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
    await sleep(1000);
    const shown = await f.evaluate(() => document.getElementById('n').textContent);
    if (c.value === -13) await d.page.screenshot({ path: OUT + '/verify-critic-count-not-sanitised-3-2-minus13-ipad.png', scale: 'css', animations: 'disabled', caret: 'hide' }).catch(e => console.log('shot', e.message));
    await f.locator('#plus').click({ force: true }); await sleep(1800);
    const r = { ...c, write: w, stored, shown, afterPlusShown: await f.evaluate(() => document.getElementById('n').textContent), afterPlusServer: await server() };
    res.push(r); console.log(JSON.stringify(r));
    await d.close();
  }
} finally {
  fs.writeFileSync(OUT + '/verify-critic-count-not-sanitised-3-2.json', JSON.stringify(res, null, 2));
  await L.close();
}
