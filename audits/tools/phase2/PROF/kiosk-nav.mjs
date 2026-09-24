// PROF (audit Phase 2), brief item 7 + TV leads: the kiosk ("Downstairs TV") in the browser at 1920×1080.
// Hash navigation to #me / #chat / #apps, whether the hidden Me cards take taps, what a chat send does, and what the
// board's own Switch leaves running (timers, feed fetches, the kiosk session). Local rig only.
//
//   node "audits/tools/phase2/PROF/kiosk-nav.mjs"
//
// Evidence: audits/evidence/p2/PROF/kiosk-*.png and the printed observations.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f); };
const log = (k, v) => console.log(k.padEnd(50), typeof v === 'string' ? v : JSON.stringify(v));
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  const { page } = tv;
  const api = [];
  page.on('request', r => { const u = new URL(r.url()); if (u.origin === L.api) api.push({ t: Date.now(), m: r.method(), p: u.pathname }); });
  page.on('response', async r => { const u = new URL(r.url()); if (u.pathname === '/api/chat') api.push({ t: Date.now(), m: 'RESP', p: '/api/chat ' + r.status() }); });
  await tv.goto('#home'); await page.waitForSelector('#tv #clock'); await sleep(1500);
  const vis = () => page.evaluate(() => {
    const on = id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { display: getComputedStyle(e).display, top: Math.round(r.top), h: Math.round(r.height) }; };
    return { home: on('view-home'), me: on('view-me'), chat: on('view-chat'), apps: on('view-apps'), chatForm: (() => { const f = document.getElementById('chat-form'); const r = f.getBoundingClientRect(); return { hidden: f.hidden, top: Math.round(r.top), bottom: Math.round(r.bottom) }; })(), viewsScroll: document.getElementById('views').scrollHeight, viewportH: innerHeight };
  });

  // #me on the TV
  await page.evaluate(() => { location.hash = '#me'; }); await sleep(800);
  log('#me: views', await vis());
  await page.evaluate(() => { const v = document.getElementById('views'); v.scrollTop = v.scrollHeight; });   // scroll down as a TV remote / mouse would
  await sleep(400);
  const card = await page.evaluate(() => { const b = document.querySelector('#theme [data-theme="forest"]'); if (!b) return null; const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, inViewport: y < innerHeight && y > 0, hit: hit && (hit.closest('button') ? hit.closest('button').className : hit.className) }; });
  log('#me: Forest theme card centre / element at that point', card);
  await shot(tv, 'kiosk-me-tv.png');
  if (card && card.inViewport) {
    const before = await page.evaluate(() => document.documentElement.dataset.theme || '(default)');
    await page.mouse.click(card.x, card.y); await sleep(500);
    log('#me: click where the (unseen) Forest card sits', `data-theme ${before} → ${await page.evaluate(() => document.documentElement.dataset.theme || '(default)')}`);
  }
  const forget = await page.evaluate(() => { const b = document.getElementById('forget'); if (!b) return null; const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + 5, r.top + 5); return { top: Math.round(r.top), inViewport: r.top < innerHeight, hit: hit && (hit.id || hit.className) }; });
  log('#me: "Forget this device" button', forget);

  // #chat on the TV
  await page.evaluate(() => { location.hash = '#chat'; }); await sleep(800);
  log('#chat: views', await vis());
  await shot(tv, 'kiosk-chat-tv.png');
  const n0 = api.length;
  if (await page.isVisible('#chat-in')) {
    await page.fill('#chat-in', 'turn on the lights'); await page.click('#chat-send'); await sleep(2000);
    log('#chat: what the send did', api.slice(n0).map(a => a.m + ' ' + a.p));
    log('#chat: error bubble', await page.evaluate(() => { const m = [...document.querySelectorAll('#chat-log .msg, #chat-log .chat-note')].pop(); if (!m) return null; const r = m.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { text: m.textContent.slice(0, 120), top: Math.round(r.top), inViewportBox: r.top < innerHeight && r.bottom > 0, topmostElementThere: hit && (hit.closest('.msg') ? 'the bubble' : hit.className || hit.tagName) }; }));
    await shot(tv, 'kiosk-chat-sent-tv.png');
  }
  // #apps on the TV
  await page.evaluate(() => { location.hash = '#apps'; }); await sleep(800);
  log('#apps: views', await vis());
  log('#apps: empty message', await page.evaluate(() => { const e = document.querySelector('#grid .empty'); if (!e) return null; const r = e.getBoundingClientRect(); return { text: e.textContent.trim(), top: Math.round(r.top), onScreen: r.top < innerHeight }; }));
  // an app by hash
  await page.evaluate(() => { location.hash = '#leftovers'; }); await sleep(800);
  log('#leftovers on the kiosk', JSON.stringify(await page.evaluate(() => ({ viewerOpen: getComputedStyle(document.getElementById('viewer')).display !== 'none' && !!document.getElementById('frame').src && document.getElementById('viewer').classList.contains('open'), toast: (document.getElementById('hub-toast') || {}).textContent || null }))));
  await tv.close();

  // the board's Switch: what keeps running (controllable clock, 6 minutes)
  const tv2 = await L.device({ device: 'tv', profile: 'tv', installClock: Date.now() });
  const p2 = tv2.page; const calls = [];
  p2.on('request', r => { const u = new URL(r.url()); if (u.origin === L.api) calls.push({ p: u.pathname, pt: r.headers()['x-profile-token'] || null }); });
  await tv2.goto('#home'); await p2.waitForSelector('#kiosk-switch'); await tv2.ctx.clock.runFor(3000);
  const tokenBefore = await p2.evaluate(() => hub.session && hub.session.token);
  await p2.click('#kiosk-switch'); await tv2.ctx.clock.runFor(1500);
  const state0 = await p2.evaluate(() => ({ gate: !document.getElementById('gate').hidden, tvConnected: !!(document.getElementById('tv') && document.getElementById('tv').isConnected), clock: (document.getElementById('clock') || {}).textContent, session: !!hub.session }));
  const c0 = calls.length;
  await tv2.ctx.clock.runFor(6 * 60000);
  const state1 = await p2.evaluate(() => ({ clock: (document.getElementById('clock') || {}).textContent }));
  const after = calls.slice(c0);
  log('TV Switch: picker shown / hidden board still in the DOM', state0);
  log('TV Switch: hidden clock text before → after 6 min', `${state0.clock} → ${state1.clock}`);
  log('TV Switch: API calls in the 6 min at the picker', after.reduce((m, c) => { m[c.p] = (m[c.p] || 0) + 1; return m; }, {}));
  const me = await L.apiAs(null, '/api/me', { profileToken: tokenBefore });
  log('TV Switch: the kiosk token after Switch', `${me.status} ${me.body.profile ? 'still valid for ' + me.body.profile.id : me.body.error}`);
  await shot(tv2, 'kiosk-switch-picker-tv.png');
  log('TV picker card size', await p2.evaluate(() => { const r = document.querySelector('#profiles .pcard').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), sub: getComputedStyle(document.querySelector('#profiles .pcard .psub')).fontSize, dataKind: document.documentElement.dataset.kind || null }; }));
  // one tap on a kid card from the TV: now a writer
  await p2.click('#profiles .pcard[data-id="kiara"]'); await tv2.ctx.clock.runFor(3000);
  log('TV: one tap on Kiara from the TV picker', await p2.evaluate(() => ({ profile: hub.profile && hub.profile.id, canWrite: hub.canWrite, tabbar: getComputedStyle(document.getElementById('tabbar')).display })));
  await tv2.close();
} finally { await L.close(); }
