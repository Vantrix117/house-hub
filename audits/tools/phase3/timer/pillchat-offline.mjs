// Two leads from audits/01-leads.md (Timer area), local rig, WebKit, real clock.
//  P  The timer pill on the Chat tab (overflow seed: long chat history; Elizabeth has a timer running): does the pill's box
//     overlap the newest chat message once the log is scrolled to the bottom? iPhone, iPad portrait, desktop.
//  O  Offline start: Eli's phone offline, start 3 min in the app: what the app shows, what the server holds, what a second
//     device of Eli's shows; then back online.
// Run: node "audits/tools/phase3/timer/pillchat-offline.mjs"   Output: audits/evidence/p3/timer/pillchat-offline.json + PNGs
import { local, sleep } from '../../lib/local.mjs';
import { save, shot, appState, serverTimer } from './_util.mjs';
const out = { P: {}, O: {} };
let L = await local({ variant: 'overflow', clock: 'real', engine: 'webkit' });
try {
  for (const device of ['iphone-pwa', 'ipad-portrait', 'desktop']) {
    const d = await L.device({ device, profile: 'mom', fixedTime: false });
    await d.goto('#chat'); await sleep(2500);
    const r = await d.page.evaluate(() => {
      const log = document.querySelector('#view-chat .chat-log, #chat-log, #view-chat [class*="log"]') || document.getElementById('view-chat');
      const sc = [log, document.scrollingElement, document.querySelector('.main, main')].find(e => e && e.scrollHeight > e.clientHeight + 4);
      if (sc) sc.scrollTop = sc.scrollHeight;
      return new Promise(res => setTimeout(() => {
        const msgs = [...document.querySelectorAll('#view-chat .msg, #view-chat [class*="bubble"]')].filter(m => m.offsetParent);
        const last = msgs[msgs.length - 1]; const pill = document.getElementById('timer-pill');
        const R = e => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; };
        const lb = last && R(last), pb = !pill.hidden && R(pill);
        const ov = lb && pb ? Math.max(0, Math.min(lb.bottom, pb.bottom) - Math.max(lb.top, pb.top)) * (Math.min(lb.right, pb.right) > Math.max(lb.left, pb.left) ? 1 : 0) : null;
        res({ msgs: msgs.length, lastMsg: lb, lastText: last && last.textContent.trim().slice(0, 40), pill: pb, pillText: pill.textContent.trim(), overlapPx: ov, composer: R(document.getElementById('chat-form')) });
      }, 600));
    });
    out.P[device] = { ...r, shot: await shot(d.page, `pillchat-${device}.png`) };
    await d.close();
  }
} finally { await L.close(); }
L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await phone.openApp('timer', { wait: '#go' }); await sleep(1500);
  await phone.setOffline(true); await sleep(300);
  await f.click('[data-s="180"]'); await f.click('#go'); await sleep(2500);
  out.O.offlineApp = await appState(f);
  out.O.offlineUi = await f.evaluate(() => ({ text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160), syncState: hub.sync.state }));
  out.O.viewerBar = await phone.page.evaluate(() => document.getElementById('pill').innerText.replace(/\s+/g, ' '));
  out.O.shot = await shot(phone.page, 'offline-running-iphone.png');
  out.O.serverWhileOffline = await serverTimer(L, 'eli');
  await ipad.goto('#home'); await sleep(2500);
  out.O.ipadPillWhileOffline = await ipad.page.evaluate(() => document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent);
  await phone.setOffline(false); await sleep(3000);
  out.O.serverAfterOnline = await serverTimer(L, 'eli');
  await ipad.page.evaluate(() => hub.pull()); await sleep(1500);
  out.O.ipadPillAfterOnline = await ipad.page.evaluate(() => document.getElementById('timer-pill').hidden ? null : document.getElementById('timer-pill-time').textContent);
  await f.click('#reset'); await sleep(1000);
} finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('pillchat-offline.json', out));
