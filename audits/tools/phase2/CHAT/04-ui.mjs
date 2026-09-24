// CHAT 04 — what the Chat tab shows (WebKit, iPhone PWA 430×932 unless noted) when things go wrong or right:
// upstream 500, the reload after it, an upstream that hangs (is there a timeout? can you send again?), a toggle that
// unticked, the cap reached, an offline send, a kid hearing (or not hearing) replies, and #chat on the TV kiosk.
//   node "audits/tools/phase2/CHAT/04-ui.mjs"            (about 3 minutes: the hang is held for 130 s)
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { EVID, save } from './lib.mjs';

const out = {};
const shot = async (d, name) => { const f = path.join(EVID, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return 'audits/evidence/p2/CHAT/' + name; };
const ready = d => d.page.waitForFunction(() => document.querySelector('#chat-log') && !document.querySelector('#chat-log .skeleton') && document.querySelector('#chat-log').children.length > 0, null, { timeout: 15000 });
const send = async (d, text) => { await d.page.fill('#chat-in', text); await d.page.press('#chat-in', 'Enter'); };
const settled = d => d.page.waitForFunction(() => !document.querySelector('#chat-log .typing'), null, { timeout: 30000 });
const lastBubbles = (d, n = 2) => d.page.evaluate(n => [...document.querySelectorAll('#chat-log .mrow')].slice(-n).map(r => ({ who: r.classList.contains('user') ? 'user' : 'bot', text: r.querySelector('.msg').innerText.trim(), err: r.querySelector('.msg').classList.contains('err'), chips: [...r.querySelectorAll('.chip')].map(c => c.className + ' | ' + c.textContent) })), n);
const state = d => d.page.evaluate(() => ({ sendDisabled: document.querySelector('#chat-send').disabled, inputDisabled: document.querySelector('#chat-in').disabled, inputValue: document.querySelector('#chat-in').value, placeholder: document.querySelector('#chat-in').placeholder, typing: !!document.querySelector('#chat-log .typing'), cap: document.querySelector('#chat-cap').textContent }));
const speechStub = () => { window.__spoken = []; const fake = { speak(u) { window.__spoken.push(u.text); }, cancel() {}, getVoices() { return []; }, speaking: false }; try { Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true }); } catch {} if (!window.SpeechSynthesisUtterance) window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } }; };

let L = await local({ variant: 'typical', clock: 'demo' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await d.goto('#chat'); await ready(d);

  // 1. upstream HTTP 500
  await L.anthropic([{ status: 500, message: 'Internal server error' }]);
  await send(d, 'Is the chili still good to eat?'); await settled(d);
  out.upstream500 = { bubbles: await lastBubbles(d), shot: await shot(d, '04-upstream-500-iphone-light.png') };
  // 2. reload: what the history shows for that exchange
  await d.goto('#chat'); await ready(d);
  out.afterReload = { bubbles: await lastBubbles(d), shot: await shot(d, '04-after-reload-iphone-light.png') };

  // 3. "tick it off" on a day already ticked → green ✓ chip that says "unchecked"
  await L.anthropic([{ tools: [{ name: 'toggle_f260_reading', input: { week: 38, day: 1 } }] }, { text: 'OK.' }]);
  await send(d, 'I read week 38 day 1, tick it off'); await settled(d);
  out.toggleUnchecked = { bubbles: await lastBubbles(d, 1), shot: await shot(d, '04-toggle-unchecked-iphone-light.png') };

  // 4. offline send
  await d.setOffline(true);
  await send(d, 'Add yogurt to the fridge list'); await settled(d);
  out.offlineSend = { bubbles: await lastBubbles(d), state: await state(d), shot: await shot(d, '04-offline-send-iphone-light.png') };
  await d.setOffline(false);

  // 5. an upstream that hangs for 130 s
  await L.anthropic([{ hangMs: 130000, text: 'Finally answered.' }]);
  const t0 = Date.now();
  await send(d, 'What is for dinner?');
  await sleep(30000);
  const at30 = await state(d);
  out.hang = { at30s: at30, shot30: await shot(d, '04-hang-30s-iphone-light.png') };
  await d.page.fill('#chat-in', 'hello? second message'); await d.page.press('#chat-in', 'Enter'); await sleep(500);
  out.hang.secondSendWhileHung = { state: await state(d), userBubbles: await d.page.evaluate(() => [...document.querySelectorAll('#chat-log .mrow.user')].slice(-2).map(r => r.innerText.trim())) };
  await sleep(90000);
  out.hang.at120s = await state(d);
  await d.page.waitForFunction(() => !document.querySelector('#chat-log .typing'), null, { timeout: 60000 });
  out.hang.replyAfterMs = Date.now() - t0;
  out.hang.final = await lastBubbles(d, 1);
  console.log('hang:', JSON.stringify(out.hang));
} finally { await L.close(); }

// 6. the cap reached (overflow: Eli has sent 60 today)
L = await local({ variant: 'overflow', clock: 'demo' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await d.goto('#chat'); await ready(d);
  const s = await state(d);
  const capVisible = await d.page.evaluate(() => { const r = document.querySelector('#chat-cap').getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
  await d.page.click('#chat-send'); await sleep(500);
  out.cap = { state: s, capCounterInViewport: capVisible, afterTappingSend: await state(d), bubbleCountUnchanged: true, shot: await shot(d, '04-cap-reached-iphone-light.png') };
  const r429 = await L.apiAs('eli', '/api/chat', { method: 'POST', body: { message: 'one more', apps: [] } });
  out.cap.serverAnswer = { status: r429.status, body: r429.body };
} finally { await L.close(); }

// 7. a kid: which replies are spoken, and a refused tool
L = await local({ variant: 'typical', clock: 'demo' });
try {
  const k = await L.device({ device: 'ipad-portrait', profile: 'ezra' });
  await k.ctx.addInitScript(speechStub);
  await k.goto('#chat'); await ready(k);
  await L.anthropic([{ tools: [{ name: 'read_todays_verse', input: {} }] }, { text: "This week's verse is Acts 2:42: the first believers kept learning, sharing meals and praying together." }]);
  await send(k, "what's today's verse"); await settled(k);
  const spokenAfterVerse = await k.page.evaluate(() => window.__spoken.slice());
  await L.anthropic([{ text: 'Great job, Ezra! Do you want to hear a story about Noah?' }]);
  await send(k, 'i fed the dog'); await settled(k);
  const spokenAfterPlain = await k.page.evaluate(() => window.__spoken.slice());
  await L.anthropic([{ tools: [{ name: 'finish_leftover', input: { name: 'pizza' } }] }, { text: 'A grown-up can help with the fridge!' }]);
  await send(k, 'we ate the pizza'); await settled(k);
  out.kid = { spokenAfterVerse, spokenAfterPlainReply: spokenAfterPlain, refusedToolBubble: await lastBubbles(k, 1), shot: await shot(k, '04-kid-refused-tool-ipad-light.png') };
  console.log('kid:', JSON.stringify(out.kid));

  // 8. #chat on the TV kiosk (lead: a working composer over the board, 403 hidden below)
  const tv = await L.device({ device: 'tv', profile: 'tv' });
  await tv.goto('#chat'); await sleep(2500);
  const form = await tv.page.evaluate(() => { const f = document.querySelector('#chat-form'); const r = f.getBoundingClientRect(); return { hidden: f.hidden, display: getComputedStyle(f).display, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }; });
  let status = null;
  tv.page.on('response', r => { if (r.url().endsWith('/api/chat')) status = r.status(); });
  if (!form.hidden && form.display !== 'none') { await tv.page.fill('#chat-in', 'hello from the tv'); await tv.page.press('#chat-in', 'Enter'); await sleep(1500); }
  const errBubble = await tv.page.evaluate(() => { const e = document.querySelector('#chat-log .msg.err'); if (!e) return null; const r = e.getBoundingClientRect(); return { text: e.innerText, top: Math.round(r.top), inViewport: r.top < innerHeight && r.bottom > 0 }; });
  out.kioskChat = { form, postStatus: status, errBubble, shot: await shot(tv, '04-kiosk-chat-tv-light.png') };
  console.log('kiosk:', JSON.stringify(out.kioskChat));
} finally { await L.close(); }

console.log(JSON.stringify(out, null, 1).slice(0, 6000));
console.log('evidence:', save('04-ui.json', out));
