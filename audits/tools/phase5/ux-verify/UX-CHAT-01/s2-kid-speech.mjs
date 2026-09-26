// UX-CHAT-01 skeptic s2: which kid chat replies are spoken, and does a spoken question send itself?
// Kiara on the iPhone PWA (WebKit), speechSynthesis and SpeechRecognition stubbed. Local rig only.
//   node "audits/tools/phase5/ux-verify/UX-CHAT-01/s2-kid-speech.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-CHAT-01/s2');
fs.mkdirSync(OUT, { recursive: true });
const stub = () => {
  window.__spoken = [];
  const fake = { speak(u) { window.__spoken.push(u.text); }, cancel() {}, getVoices() { return []; }, speaking: false };
  try { Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true }); } catch {}
  if (!window.SpeechSynthesisUtterance) window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  window.__recStarted = 0;
  class FakeSR { start() { window.__recStarted++; setTimeout(() => { this.onresult && this.onresult({ results: [[{ transcript: 'tell me a joke' }]] }); this.onend && this.onend(); }, 200); } stop() {} abort() {} }
  window.webkitSpeechRecognition = FakeSR;
};
const out = {};
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const k = await L.device({ device: 'iphone-pwa', profile: 'kiara' });
  await k.ctx.addInitScript(stub);
  let posts = 0; k.page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/api/chat')) posts++; });
  await k.goto('#chat');
  await k.page.waitForFunction(() => document.querySelector('#chat-log') && !document.querySelector('#chat-log .skeleton') && document.querySelector('#chat-log').children.length > 0, null, { timeout: 15000 });
  out.greeting = await k.page.evaluate(() => document.querySelector('#chat-log').innerText.trim().slice(0, 300));
  out.kind = await k.page.evaluate(() => document.documentElement.dataset.kind);
  out.micVisible = await k.page.evaluate(() => !document.querySelector('#chat-mic').hidden);
  out.spokenOnOpen = await k.page.evaluate(() => window.__spoken.slice());
  // spoken question
  await L.anthropic([{ text: 'Why did the chicken cross the road? To get to the other side!' }]);
  await k.page.click('#chat-mic'); await sleep(1500);
  out.afterMic = { inputValue: await k.page.inputValue('#chat-in'), chatPosts: posts, recStarted: await k.page.evaluate(() => window.__recStarted) };
  await k.page.screenshot({ path: path.join(OUT, 'after-mic-iphone-light.png'), scale: 'css', caret: 'hide' });
  // now the Send tap
  await k.page.click('#chat-send');
  await k.page.waitForFunction(() => !document.querySelector('#chat-log .typing'), null, { timeout: 30000 }); await sleep(500);
  out.afterSend = { chatPosts: posts, spoken: await k.page.evaluate(() => window.__spoken.slice()), lastBot: await k.page.evaluate(() => [...document.querySelectorAll('#chat-log .mrow.bot .msg')].pop().innerText) };
  // verse tool
  await L.anthropic([{ tools: [{ name: 'read_todays_verse', input: {} }] }, { text: 'Here is your verse!' }]);
  await k.page.fill('#chat-in', 'my verse'); await k.page.press('#chat-in', 'Enter');
  await k.page.waitForFunction(() => !document.querySelector('#chat-log .typing'), null, { timeout: 30000 }); await sleep(500);
  out.afterVerse = { spoken: await k.page.evaluate(() => window.__spoken.slice()) };
  await k.page.screenshot({ path: path.join(OUT, 'after-verse-iphone-light.png'), scale: 'css', caret: 'hide' });
  // any tap-to-hear control on a bubble?
  out.bubbleControls = await k.page.evaluate(() => [...document.querySelectorAll('#chat-log .msg button, #chat-log [aria-label*="ead"], #chat-log [aria-label*="isten"]')].length);
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'kid-speech.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
