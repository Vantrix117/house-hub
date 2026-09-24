// Skeptic #1 for "critic-count-not-sanitised-3": does Tally show and count from any non-integer value chat's set_data writes?
// Code: apps/tally.html:150-152 (n() = Number(v)||0, show() prints it raw, set() clamps with Math.max(0, v) only on write);
//       worker/src/chat.js:29-30 (set_data value: {} — any JSON), 52 (kids may call set_data), 173-179 (no value check).
// For each value: the scripted model sends one set_data as Ezra (person scope, tally/count); the server row is read; Ezra's
// Tally is opened in a fresh iPad context, #n read; then + tapped once (or − for one case); #n and the server row re-read.
// A final case writes -13 through raw PUT /api/data as Ezra's session to check the "raw API has the same effect" line.
// Run: node "audits/tools/phase3/tally/verify-critic-count-not-sanitised-3-1.mjs"
//   -> audits/evidence/p3/tally/verify-critic-count-not-sanitised-3-1.json (+ -minus13.png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
import { toolCall, put } from '../../phase2/CHAT/lib.mjs';

const OUT = 'audits/evidence/p3/tally';
const TAG = 'verify-critic-count-not-sanitised-3-1';
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = [];
const server = async () => {
  const r = await L.apiAs('ezra', '/api/data/tally?scope=person');
  const it = (r.body.items || []).find(i => i.key === 'count');
  return it ? it.value : '(no row)';
};
const cases = [
  { value: -13, via: 'chat', tap: 'plus', shot: true },
  { value: -13, via: 'chat', tap: 'minus' },
  { value: 12.5, via: 'chat', tap: 'plus' },
  { value: 1e21, via: 'chat', tap: 'plus' },
  { value: 'twelve', via: 'chat', tap: 'plus' },
  { value: '15', via: 'chat', tap: 'plus' },
  { value: 7, via: 'chat', tap: 'plus' },            // control: a normal integer
  { value: -13, via: 'rawPUT', tap: 'plus' },
];
try {
  for (const c of cases) {
    let chip = null, ok = null, putStatus = null;
    if (c.via === 'chat') {
      const t = await toolCall(L, 'ezra', 'set_data', { app_id: 'tally', scope: 'person', key: 'count', value: c.value }, { message: 'change my tally' });
      chip = t.chip; ok = t.ok;
    } else {
      const r = await put(L, 'ezra', 'tally', 'person', 'count', c.value); putStatus = r.status;
    }
    const serverBefore = await server();
    const d = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
    try {
      const f = await d.openApp('tally');
      await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 10000 });
      await sleep(1000);
      const shown = await f.evaluate(() => document.getElementById('n').textContent);
      await f.locator('#' + c.tap).click();
      await sleep(2000);
      const afterShown = await f.evaluate(() => document.getElementById('n').textContent);
      const afterServer = await server();
      if (c.shot) await d.page.screenshot({ path: `${OUT}/${TAG}-minus13-after-plus.png`, scale: 'css', animations: 'disabled', caret: 'hide' }).catch(e => console.log('shot failed', e.message));
      const r = { value: c.value, via: c.via, chip, toolOk: ok, putStatus, serverBefore, shown, tap: c.tap, afterShown, afterServer };
      res.push(r); console.log(JSON.stringify(r));
    } finally { await d.close(); }
  }
} finally {
  fs.writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(res, null, 2));
  await L.close();
}
