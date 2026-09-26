// GAP-CHAT-02 skeptic s2: a chat write lands with no confirm step, and nothing in the Chat tab or the Larder undoes it.
// Eli on the iPhone PWA (WebKit), scripted upstream asks for finish_leftover. Local rig only.
//   node "audits/tools/phase5/ux-verify/GAP-CHAT-02/s2-no-confirm-no-undo.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/GAP-CHAT-02/s2');
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const before = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  const rows = (before.body && (before.body.items || before.body.rows || before.body)) || [];
  const list = Array.isArray(rows) ? rows : Object.values(rows);
  const live = list.filter(r => r && String(r.key || '').startsWith('item:') && r.value && !r.deleted);
  out.liveBefore = live.map(r => r.value.name);
  const target = live[0] && live[0].value.name;
  out.target = target;
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const dialogs = []; d.page.on('dialog', async dl => { dialogs.push(dl.message()); await dl.dismiss(); });
  const sse = []; d.page.on('response', async r => { if (r.url().endsWith('/api/chat')) { try { sse.push(await r.text()); } catch {} } });
  await d.goto('#chat');
  await d.page.waitForFunction(() => document.querySelector('#chat-log') && !document.querySelector('#chat-log .skeleton'), null, { timeout: 15000 });
  await L.anthropic([{ tools: [{ name: 'finish_leftover', input: { name: target } }] }, { text: 'Done, it is off the list.' }]);
  await d.page.fill('#chat-in', 'we finished the ' + target); await d.page.press('#chat-in', 'Enter');
  await d.page.waitForFunction(() => !document.querySelector('#chat-log .typing'), null, { timeout: 30000 }); await sleep(800);
  out.sseEvents = (sse.join('').match(/^event: *\w+/gm) || []).map(s => s.replace(/event: */, ''));
  out.dialogs = dialogs;
  out.lastBot = await d.page.evaluate(() => { const m = [...document.querySelectorAll('#chat-log .mrow.bot .msg')].pop(); return { text: m.innerText, buttons: m.querySelectorAll('button,a,[role=button]').length, chipTags: [...m.querySelectorAll('.chip')].map(c => c.tagName + ':' + c.textContent) }; });
  await d.page.screenshot({ path: path.join(OUT, 'chat-after-finish-iphone-light.png'), scale: 'css', caret: 'hide' });
  const after = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  const rows2 = (after.body && (after.body.items || after.body.rows || after.body)) || [];
  const list2 = Array.isArray(rows2) ? rows2 : Object.values(rows2);
  out.liveAfter = list2.filter(r => r && String(r.key || '').startsWith('item:') && r.value && !r.deleted).map(r => r.value.name);
  // the Larder: any restore / undo / recently-finished control?
  const f = await d.openApp('leftovers'); await sleep(1500);
  out.larderUndoControls = await f.evaluate(() => [...document.querySelectorAll('button,a,[role=button]')].map(b => (b.getAttribute('aria-label') || b.textContent || '').trim()).filter(t => /undo|restore|bring back|recent/i.test(t)));
  await d.page.screenshot({ path: path.join(OUT, 'larder-after-finish-iphone-light.png'), scale: 'css', caret: 'hide' });
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'no-confirm-no-undo.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
