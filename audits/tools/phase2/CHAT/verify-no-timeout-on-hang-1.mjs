// Skeptic #1 for CHAT finding "no-timeout-on-hang": does a hung upstream really freeze the Chat tab, and for how long?
//   node "audits/tools/phase2/CHAT/verify-no-timeout-on-hang-1.mjs"        (about 3.5 minutes; WebKit and Chromium run in parallel)
// For each engine, on a fresh local instance (clock 'real', browser clock real):
//   1. Eli opens #chat on the iPhone PWA; the rig's upstream is told to hang for 200 s (mock turn { hangMs }).
//   2. Send "What is for dinner?"; at 45 s (past the 30-45 s the finding proposes) read the UI state and the server's `used`.
//   3. Type a second message and press Enter: is it sent, ignored, or queued? Does the text stay in the box?
//   4. Meanwhile a plain Node client posts /api/chat against a second hang turn and reads for 45 s: any bytes/events?
//   5. Poll every 5 s until the typing dots go (or 195 s): when and with what text does the bubble end?
// Prints the observations and writes audits/evidence/p2/CHAT/verify-no-timeout-on-hang-1.json (+ a 45 s PNG per engine).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { EVID, registryApps } from './lib.mjs';

const HANG_MS = 200000, OBSERVE_AT = 45000, GIVE_UP = 195000;
const state = d => d.page.evaluate(() => ({
  sendDisabled: document.querySelector('#chat-send').disabled,
  inputValue: document.querySelector('#chat-in').value,
  typing: !!document.querySelector('#chat-log .typing'),
  capLabel: document.querySelector('#chat-cap').textContent,
  userBubbles: document.querySelectorAll('#chat-log .mrow.user').length,
  lastBot: (() => { const b = [...document.querySelectorAll('#chat-log .mrow.bot .msg')].pop(); return b ? { text: b.innerText.trim(), err: b.classList.contains('err') } : null; })(),
  cancelControls: [...document.querySelectorAll('#view-chat button')].filter(b => !b.hidden).map(b => b.id || b.getAttribute('aria-label')),
}));

async function run(engine) {
  const r = { engine };
  const L = await local({ variant: 'typical', clock: 'real', engine });
  try {
    await L.anthropic([{ hangMs: HANG_MS, text: 'Finally answered (UI turn).' }, { hangMs: HANG_MS, text: 'Finally answered (node turn).' }]);
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await d.goto('#chat');
    await d.page.waitForFunction(() => document.querySelector('#chat-log') && !document.querySelector('#chat-log .skeleton') && document.querySelector('#chat-log').children.length > 0, null, { timeout: 15000 });
    r.usedBefore = (await L.apiAs('eli', '/api/chat/history')).body.used;
    r.before = await state(d);
    await d.page.fill('#chat-in', 'What is for dinner?');
    const t0 = Date.now();
    await d.page.press('#chat-in', 'Enter');

    // Node client against the second hang turn, started once the UI turn has been taken off the queue
    await sleep(2000);
    const node = (async () => {
      const ac = new AbortController(); const n0 = Date.now(); let bytes = 0, text = '';
      const timer = setTimeout(() => ac.abort(), OBSERVE_AT);
      try {
        const res = await fetch(L.api + '/api/chat', { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json', Origin: L.site, 'X-Device-Token': L.S.info.device.token, 'X-Profile-Token': L.S.info.sessions.christian }, body: JSON.stringify({ message: 'node hang probe', apps: registryApps() }) });
        const status = res.status, ctype = res.headers.get('content-type');
        const reader = res.body.getReader(); const dec = new TextDecoder();
        while (true) { const { value, done } = await reader.read(); if (done) return { status, ctype, closedAfterMs: Date.now() - n0, bytes, text }; bytes += value.length; text += dec.decode(value, { stream: true }); }
      } catch (e) { return { abortedByProbeAfterMs: Date.now() - n0, error: e.name, bytes, text }; }
      finally { clearTimeout(timer); }
    })();

    await sleep(OBSERVE_AT - (Date.now() - t0));
    r.at45s = { elapsedMs: Date.now() - t0, ...(await state(d)), serverUsed: (await L.apiAs('eli', '/api/chat/history')).body.used };
    if (engine === 'webkit') { const f = path.join(EVID, 'verify-no-timeout-on-hang-1-45s-iphone-light.png'); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); r.shot45 = 'audits/evidence/p2/CHAT/verify-no-timeout-on-hang-1-45s-iphone-light.png'; }
    await d.page.fill('#chat-in', 'hello? second message');
    await d.page.press('#chat-in', 'Enter'); await sleep(700);
    r.secondSend = { ...(await state(d)), upstreamCallsSoFar: (await L.anthropicLog()).length };
    r.nodeProbe = await node;

    let ended = null;
    while (Date.now() - t0 < GIVE_UP) {
      const s = await state(d);
      if (!s.typing) { ended = { afterMs: Date.now() - t0, ...s }; break; }
      await sleep(5000);
    }
    r.ended = ended || { stillHungAfterMs: Date.now() - t0, ...(await state(d)) };
    r.consoleErrors = d.logs.filter(l => /error/i.test(l)).slice(0, 5);
  } finally { await L.close(); }
  return r;
}

const results = await Promise.all([run('webkit'), run('chromium')]);
for (const r of results) console.log(r.engine + ':', JSON.stringify(r));
const f = path.join(EVID, 'verify-no-timeout-on-hang-1.json');
fs.writeFileSync(f, JSON.stringify(results, null, 1));
console.log('evidence:', f);
process.exit(0);
