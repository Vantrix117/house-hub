// Phase 2 / PWA — voice add on every surface that has a mic, with a scripted SpeechRecognition stand-in.
//   node "audits/tools/phase2/PWA/voice.mjs"
// Playwright WebKit has no webkitSpeechRecognition; the rig installs an inert one. This script replaces it with a scripted
// fake (mode per step: a result, or an error such as 'not-allowed'), records what each surface asked for (lang,
// interimResults, continuous), and checks what the person sees. A second context removes speech recognition entirely,
// as on a browser without it. Real speech, the iOS permission prompts and Siri/dictation settings are a device check.
// Evidence: audits/evidence/p2/PWA/voice-run.json and voice-*.png (1× css).
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const log = {};
const say = (k, v) => { log[k] = v; console.log('\n== ' + k + '\n' + JSON.stringify(v, null, 1)); };
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
const shot = async (loc, name) => { const f = path.join(OUT, name); await loc.screenshot({ path: f, scale: 'css', animations: 'disabled' }); return rel(f); };

function fakeSR(arg) {
  if (arg.mode === 'missing') { try { delete window.webkitSpeechRecognition; delete window.SpeechRecognition; } catch {} return; }
  const cfg = () => { try { return JSON.parse(localStorage.getItem('audit.sr') || '{}'); } catch { return {}; } };
  class FakeSR {
    constructor() { this.lang = ''; this.onresult = this.onerror = this.onend = null; }
    start() {
      const c = cfg();
      try { const l = JSON.parse(localStorage.getItem('audit.srlog') || '[]'); l.push({ page: location.pathname.split('/').pop(), lang: this.lang, interimResults: this.interimResults, continuous: this.continuous, maxAlternatives: this.maxAlternatives }); localStorage.setItem('audit.srlog', JSON.stringify(l)); } catch {}
      setTimeout(() => {
        if (c.mode === 'error') { if (this.onerror) this.onerror({ error: c.error || 'no-speech' }); }
        else if (this.onresult) this.onresult({ results: [[{ transcript: c.text || '' }]] });
        if (this.onend) this.onend({});
      }, 400);
    }
    stop() { setTimeout(() => this.onend && this.onend({}), 0); }
    abort() { this.stop(); }
  }
  window.webkitSpeechRecognition = FakeSR;
}

const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const setSR = (page, v) => page.evaluate(v => localStorage.setItem('audit.sr', JSON.stringify(v)), v);
  const chatPosts = [];

  // ── Eli on the iPad ─────────────────────────────────────────────────────────
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  await ipad.ctx.addInitScript(fakeSR, { mode: 'scripted' });
  ipad.page.on('request', r => { if (r.url().includes('/api/chat') && r.method() === 'POST') chatPosts.push(r.url()); });
  const P = ipad.page;
  await ipad.goto('#home'); await P.waitForSelector('#remform');
  say('V5 Home: mic next to "Add a reminder for the house"?', { micButtonsInHome: await P.$$eval('#view-home button', bs => bs.filter(b => /mic|say/i.test((b.id || '') + (b.getAttribute('aria-label') || ''))).length) });

  // Chat
  await P.click('.tab[data-tab="chat"]'); await P.waitForSelector('#chat-form:not([hidden])'); await sleep(800);
  await setSR(P, { mode: 'result', text: 'Add milk to the fridge list' });
  await P.click('#chat-mic'); await sleep(150);
  const listening = await P.evaluate(() => ({ micOn: document.querySelector('#chat-mic').classList.contains('on'), anyListeningText: /listening/i.test(document.body.innerText) }));
  await sleep(900);
  const chatAfter = await P.evaluate(() => ({ input: document.querySelector('#chat-in').value, micOn: document.querySelector('#chat-mic').classList.contains('on') }));
  const chatShot = await shot(P.locator('#chat-form'), 'voice-chat-filled-ipad-portrait-light.png');
  say('V1 Chat mic → transcript', { whileListening: listening, after: chatAfter, chatPostsSent: chatPosts.length, shot: chatShot });
  await P.fill('#chat-in', '');
  await setSR(P, { mode: 'error', error: 'not-allowed' });
  const logBefore = await P.$eval('#chat-log', e => e.innerText.length);
  await P.click('#chat-mic'); await sleep(1200);
  say('V2 Chat mic → error not-allowed (permission refused)', { micOn: await P.$eval('#chat-mic', b => b.classList.contains('on')), chatLogChanged: (await P.$eval('#chat-log', e => e.innerText.length)) !== logBefore, toastShown: await P.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; }), input: await P.$eval('#chat-in', i => i.value) });

  // Larder
  const f = await ipad.openApp('leftovers', { wait: '#mic' }); await sleep(1200);
  const itemsBefore = await f.$$eval('.item', e => e.length);
  await setSR(P, { mode: 'result', text: 'Chicken noodle soup' });
  await f.click('#mic'); await sleep(1200);
  say('V3 Larder mic → transcript', { micVisible: await f.$eval('#mic', m => !m.hidden), name: await f.$eval('#name', i => i.value), itemsBefore, itemsAfter: await f.$$eval('.item', e => e.length) });
  await f.fill('#name', '');
  await setSR(P, { mode: 'error', error: 'not-allowed' });
  await f.click('#mic'); await sleep(1200);
  const errText = await f.$eval('#err', e => e.hidden ? null : e.textContent);
  const larderShot = await shot(f.locator('#add'), 'voice-larder-not-allowed-ipad-portrait-light.png');
  say('V3 Larder mic → error not-allowed', { message: errText, shot: larderShot });

  // Prayer add
  const pf = await ipad.openApp('prayer', { wait: '#fab' }); await sleep(1500);
  await pf.click('#fab'); await pf.waitForSelector('#f-title', { state: 'visible' }); await sleep(400);
  await setSR(P, { mode: 'result', text: 'Healing for Mr. Patel' });
  await pf.click('#f-mic'); await sleep(1200);
  const title = await pf.$eval('#f-title', i => i.value);
  await pf.fill('#f-title', '');
  await setSR(P, { mode: 'error', error: 'no-speech' });
  await pf.click('#f-mic'); await sleep(900);
  say('V4 Prayer "Add a request" mic', { micVisible: await pf.$eval('#f-mic', m => !m.hidden), transcriptTitle: title, errorToast: await pf.$eval('#toastMsg', e => e.textContent) });

  say('V8 what every surface asked the recognizer for', JSON.parse(await P.evaluate(() => localStorage.getItem('audit.srlog'))));

  // ── Ezra (kid) on the iPad: chat mic ─────────────────────────────────────────
  const kid = await L.device({ device: 'ipad-portrait', profile: 'ezra' });
  await kid.ctx.addInitScript(fakeSR, { mode: 'scripted' });
  const kidPosts = []; kid.page.on('request', r => { if (r.url().includes('/api/chat') && r.method() === 'POST') kidPosts.push(1); });
  await kid.goto('#chat'); await kid.page.waitForSelector('#chat-form:not([hidden])'); await sleep(1000);
  await setSR(kid.page, { mode: 'result', text: 'what is my verse' });
  await kid.page.click('#chat-mic'); await sleep(1200);
  const kidShot = await shot(kid.page.locator('#chat-form'), 'voice-chat-kid-filled-ipad-portrait-light.png');
  say('V6 Kid chat mic', { micVisible: await kid.page.$eval('#chat-mic', m => !m.hidden), input: await kid.page.$eval('#chat-in', i => i.value), sentToChat: kidPosts.length, sendButtonLabel: await kid.page.$eval('#chat-send', b => b.getAttribute('aria-label')), shot: kidShot });

  // ── a browser with no speech recognition ─────────────────────────────────────
  const nosr = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  await nosr.ctx.addInitScript(fakeSR, { mode: 'missing' });
  await nosr.goto('#chat'); await nosr.page.waitForSelector('#chat-form:not([hidden])'); await sleep(800);
  const chatMic = await nosr.page.$eval('#chat-mic', m => !m.hidden);
  const lf = await nosr.openApp('leftovers', { wait: '#add' }); await sleep(1200);
  const larderMic = await lf.$eval('#mic', m => !m.hidden);
  const larderText = await lf.evaluate(() => /voice|speech|microphone|say it/i.test(document.body.innerText));
  const larderBar = await shot(lf.locator('#add'), 'voice-larder-no-speech-ipad-portrait-light.png');
  const pf2 = await nosr.openApp('prayer', { wait: '#fab' }); await sleep(1200);
  await pf2.click('#fab'); await pf2.waitForSelector('#f-title', { state: 'visible' });
  say('V7 no SpeechRecognition in the browser', { voiceSupported: await nosr.page.evaluate(() => hub.voiceSupported), chatMicShown: chatMic, larderMicShown: larderMic, prayerMicShown: await pf2.$eval('#f-mic', m => !m.hidden), anyExplanationInLarder: larderText, larderAddBar: larderBar });
} finally {
  fs.writeFileSync(path.join(OUT, 'voice-run.json'), JSON.stringify(log, null, 1));
  console.log('\nwrote audits/evidence/p2/PWA/voice-run.json');
  await L.close();
}
