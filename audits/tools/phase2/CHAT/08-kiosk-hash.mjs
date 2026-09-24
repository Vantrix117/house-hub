// CHAT 08 — lead check: #chat on the TV kiosk. On load the kiosk always lands on Home (index.html:627), but a later
// hashchange runs showTab('chat') (index.html:650-653), which un-hides the composer for any profile (index.html:636).
//   node "audits/tools/phase2/CHAT/08-kiosk-hash.mjs"
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { EVID, save } from './lib.mjs';

const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const tv = await L.device({ device: 'tv', profile: 'tv' });
  const form = () => tv.page.evaluate(() => { const f = document.querySelector('#chat-form'); const r = f.getBoundingClientRect(); return { hidden: f.hidden, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], chatViewOn: document.querySelector('#view-chat').classList.contains('on') }; });
  await tv.goto('#chat'); await sleep(2000);
  out.loadWithHash = await form();
  await tv.page.evaluate(() => { location.hash = '#chat'; }); await sleep(300);
  await tv.page.evaluate(() => { location.hash = '#home'; }); await sleep(300);
  await tv.page.evaluate(() => { location.hash = '#chat'; }); await sleep(1500);
  out.afterHashchange = await form();
  let status = null, body = null;
  tv.page.on('response', async r => { if (r.url().endsWith('/api/chat')) { status = r.status(); body = await r.text().catch(() => null); } });
  if (!out.afterHashchange.hidden) { await tv.page.fill('#chat-in', 'hello from the tv'); await tv.page.press('#chat-in', 'Enter'); await sleep(1500); }
  out.post = { status, body };
  out.errBubble = await tv.page.evaluate(() => { const e = document.querySelector('#chat-log .msg.err'); if (!e) return null; const r = e.getBoundingClientRect(); return { text: e.innerText, top: Math.round(r.top), bottom: Math.round(r.bottom), viewportH: innerHeight, inViewport: r.top < innerHeight && r.bottom > 0 }; });
  const f = path.join(EVID, '08-kiosk-hashchange-chat-tv-light.png');
  await tv.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' });
  out.shot = 'audits/evidence/p2/CHAT/08-kiosk-hashchange-chat-tv-light.png';
  console.log(JSON.stringify(out, null, 1));
  console.log('evidence:', save('08-kiosk-hash.json', out));
} finally { await L.close(); }
