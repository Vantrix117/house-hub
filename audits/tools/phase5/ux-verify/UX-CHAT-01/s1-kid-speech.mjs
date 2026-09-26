// UX-CHAT-01 skeptic s1: which parts of kid chat are spoken, and does a spoken question send itself?
// Ezra on the iPad portrait and Kiara on the iPhone PWA, speechSynthesis + SpeechRecognition stubbed.
//   node "audits/tools/phase5/ux-verify/UX-CHAT-01/s1-kid-speech.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-CHAT-01/s1');
fs.mkdirSync(OUT, { recursive: true });
const stubs = () => {
  window.__spoken = [];
  const fake = { speak(u) { window.__spoken.push(u.text); }, cancel() {}, getVoices() { return []; }, speaking: false };
  try { Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true }); } catch {}
  if (!window.SpeechSynthesisUtterance) window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  // fake recogniser: hears "what is today's verse" 200 ms after start
  window.webkitSpeechRecognition = class { start() { setTimeout(() => { this.onresult && this.onresult({ results: [[{ transcript: "what is today's verse" }]] }); this.onend && this.onend(); }, 200); } stop() {} abort() {} };
};
const ready = d => d.page.waitForFunction(() => document.querySelector('#chat-log') && !document.querySelector('#chat-log .skeleton') && document.querySelector('#chat-log').children.length > 0, null, { timeout: 15000 });
const settled = d => d.page.waitForFunction(() => !document.querySelector('#chat-log .typing'), null, { timeout: 30000 });
const spoken = d => d.page.evaluate(() => window.__spoken.slice());
const out = {};
const L = await local({ variant: 'empty', clock: 'demo' });
try {
  for (const [who, device] of [['ezra', 'ipad-portrait'], ['kiara', 'iphone-pwa']]) {
    const r = {};
    const k = await L.device({ device, profile: who });
    await k.ctx.addInitScript(stubs);
    await k.goto('#chat'); await ready(k);
    r.greetingText = await k.page.evaluate(() => document.querySelector('#chat-log').innerText.trim());
    r.placeholder = await k.page.evaluate(() => document.querySelector('#chat-in').placeholder);
    r.spokenAfterOpen = await spoken(k);
    r.micVisible = await k.page.evaluate(() => !document.querySelector('#chat-mic').hidden);
    // the mic: does a heard question send itself?
    await L.anthropicLog({ clear: true });
    await k.page.click('#chat-mic'); await sleep(1200);
    r.afterMic = await k.page.evaluate(() => ({ inputValue: document.querySelector('#chat-in').value, userBubbles: document.querySelectorAll('#chat-log .mrow.user').length }));
    r.upstreamCallsAfterMic = ((await L.anthropicLog()).calls || (await L.anthropicLog()).log || []).length;
    await k.page.fill('#chat-in', '');
    // plain reply
    await L.anthropic([{ text: 'Great job! Dogs love breakfast. Want to hear about Noah and the animals?' }]);
    await k.page.fill('#chat-in', 'i fed the dog'); await k.page.press('#chat-in', 'Enter'); await settled(k);
    r.spokenAfterPlainReply = await spoken(k);
    // verse
    await L.anthropic([{ tools: [{ name: 'read_todays_verse', input: {} }] }, { text: "This week's verse is about loving one another." }]);
    await k.page.fill('#chat-in', "what's today's verse"); await k.page.press('#chat-in', 'Enter'); await settled(k);
    r.spokenAfterVerse = await spoken(k);
    r.lastBotText = await k.page.evaluate(() => [...document.querySelectorAll('#chat-log .msg.bot')].pop().innerText.trim());
    await k.page.screenshot({ path: path.join(OUT, `kid-chat-${who}-${device}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    out[who] = r;
    await k.ctx.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'kid-speech.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
