// Skeptic #2 for "no-timeout-on-hang": does a hung assistant really freeze the Chat tab, and is the ~120 s give-up the
// app, the browser, or the rig's Node server? Runs one engine per invocation so WebKit and Chromium can be compared.
//   node "audits/tools/phase2/CHAT/verify-no-timeout-on-hang-2.mjs" webkit 150000
//   node "audits/tools/phase2/CHAT/verify-no-timeout-on-hang-2.mjs" chromium 150000
// argv[2] = engine (webkit|chromium), argv[3] = upstream hang in ms (the rig's mock delays its whole reply: lib/anthropic-mock.mjs hangMs).
// Local instance only (lib/local.mjs); nothing reaches production.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { EVID } from './lib.mjs';

const engine = process.argv[2] || 'webkit';
const HANG = +(process.argv[3] || 150000);
const L = await local({ variant: 'typical', clock: 'real', engine });
const out = { engine, hangMs: HANG };
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#chat');
  await d.page.waitForFunction(() => document.querySelector('#chat-log') && !document.querySelector('#chat-log .skeleton') && document.querySelector('#chat-log').children.length > 0, null, { timeout: 15000 });
  const state = () => d.page.evaluate(() => ({
    sendDisabled: document.querySelector('#chat-send').disabled,
    typing: !!document.querySelector('#chat-log .typing'),
    inputValue: document.querySelector('#chat-in').value,
    userBubbles: document.querySelectorAll('#chat-log .mrow.user').length,
    lastBot: (() => { const m = [...document.querySelectorAll('#chat-log .mrow.bot .msg')].pop(); return m ? { text: m.innerText.trim().slice(0, 120), err: m.classList.contains('err') } : null; })(),
  }));
  // Any cancel / stop / retry control in or near the composer?
  out.composerControls = await d.page.evaluate(() => [...document.querySelectorAll('#chat-form button, #chat-form [role=button]')].map(b => ({ id: b.id, label: b.getAttribute('aria-label') || b.textContent.trim(), hidden: b.hidden })));
  const usedBefore = (await L.apiAs('eli', '/api/chat/history')).body.used;

  await L.anthropic([{ hangMs: HANG, text: 'Finally answered.' }]);
  const t0 = Date.now();
  await d.page.fill('#chat-in', 'What is for dinner?'); await d.page.press('#chat-in', 'Enter');
  await sleep(1500);
  out.at1_5s = await state();
  out.usedAfterSend = (await L.apiAs('eli', '/api/chat/history')).body.used;
  out.usedBefore = usedBefore;

  // A second message while hung
  await d.page.fill('#chat-in', 'hello? second message'); await d.page.press('#chat-in', 'Enter'); await sleep(500);
  out.secondSendWhileHung = await state();
  // Try the Send button by tap too
  await d.page.click('#chat-send', { force: true, timeout: 2000 }).catch(e => { out.secondSendClickError = String(e.message).split('\n')[0]; });
  await sleep(300);
  out.afterTapSend = await state();

  // Timeline until the UI releases (typing gone) or HANG + 20 s
  const timeline = []; let prev = '';
  while (Date.now() - t0 < HANG + 20000) {
    const s = await state(); const k = JSON.stringify([s.sendDisabled, s.typing, s.lastBot]);
    if (k !== prev) { timeline.push({ atMs: Date.now() - t0, ...s }); prev = k; }
    if (Date.now() - t0 > 30000 && Date.now() - t0 < 31500 && !out.shot30) {
      const f = path.join(EVID, `verify-no-timeout-on-hang-2-30s-${engine}.png`);
      await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' });
      out.shot30 = path.relative(path.resolve(EVID, '../../../..'), f).replace(/\\/g, '/');
      out.at30s = s;
    }
    if (!s.typing) break;
    await sleep(1000);
  }
  out.timeline = timeline;
  out.releasedAfterMs = timeline.length && !timeline[timeline.length - 1].typing ? timeline[timeline.length - 1].atMs : null;
  out.final = await state();
  // After the client gave up (or got the reply): what did the server keep?
  await sleep(Math.max(0, HANG + 3000 - (Date.now() - t0)));
  const hist = (await L.apiAs('eli', '/api/chat/history')).body;
  out.historyTail = hist.messages.slice(-2).map(m => ({ role: m.role, content: m.content.slice(0, 80) }));
  out.usedEnd = hist.used;
  out.pageLogs = d.logs.filter(l => /error|fail/i.test(l)).slice(-5);
} catch (e) { out.error = String(e && e.stack || e); }
finally { await L.close(); }
const file = path.join(EVID, `verify-no-timeout-on-hang-2-${engine}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
console.log('evidence:', file);
