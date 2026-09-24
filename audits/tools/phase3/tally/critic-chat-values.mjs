// Completeness critic: Tally trusts whatever number is in app_data(person,'tally','count'). The chat's set_data tool
// (worker/src/chat.js:29-30, 173-179; kids included, chat.js:52) writes ANY JSON value there, with no integer check.
// tally.html:150-154 shows Number(value) as-is, and + / − compute from it; Math.max(0, …) is applied only on the write.
// For each value the scripted model sends one set_data call as Ezra, then Ezra's Tally is opened and + tapped once.
// Run: node "audits/tools/phase3/tally/critic-chat-values.mjs"  -> audits/evidence/p3/tally/critic-chat-values.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
import { toolCall } from '../../phase2/CHAT/lib.mjs';
const OUT = 'audits/evidence/p3/tally';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = [];
const server = async pid => { const r = await L.apiAs(pid, '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
const ready = f => f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
try {
  for (const value of [-13, 12.5, 1e21, 'twelve', '15']) {
    const t = await toolCall(L, 'ezra', 'set_data', { app_id: 'tally', scope: 'person', key: 'count', value }, { message: 'set my tally' });
    const d = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
    const f = await d.openApp('tally'); await ready(f); await sleep(800);
    const shown = await f.evaluate(() => document.getElementById('n').textContent);
    await f.locator('#plus').click(); await sleep(1500);
    const r = { value, chip: t.chip, toolOk: t.ok, shown, afterPlusShown: await f.evaluate(() => document.getElementById('n').textContent), afterPlusServer: await server('ezra') };
    if (value === -13) await d.page.screenshot({ path: OUT + '/critic-chat-values-minus13-after-plus-ipad.png', scale: 'css', animations: 'disabled', caret: 'hide' }).catch(() => {});
    res.push(r); console.log(JSON.stringify(r));
    await d.close();
  }
} finally {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(OUT + '/critic-chat-values.json', JSON.stringify(res, null, 2));
  await L.close();
}
