// PROF skeptic #1: verify "kiosk-hash-nav" — on the TV (kiosk, 1920×1080) #me / #chat / #apps render under the board,
// hidden Me cards take clicks, the chat error is hidden. Local rig only.
//
//   node "audits/tools/phase2/PROF/verify-kiosk-hash-nav-1.mjs"
//
// Checks separately: (A) a cold load of a stale URL (index.html#me etc.) vs (B) a same-document hash change on an
// already-open board (what a bookmark tap / typed URL / link does). Visual hiding is checked by screenshot with and
// without the board's backdrop (elementFromPoint ignores pointer-events:none, so it cannot tell "covered").
// Evidence: audits/evidence/p2/PROF/verify-kiosk-hash-nav-1*.png + .json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
const shot = async (page, name, clip) => { const f = path.join(OUT, name); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide', ...(clip ? { clip } : {}) }); return rel(f); };
const out = {};
const log = (k, v) => { out[k] = v; console.log(k.padEnd(58), typeof v === 'string' ? v : JSON.stringify(v)); };

const ENGINE = process.argv[2] === 'chromium' ? 'chromium' : 'webkit';   // optional: pass chromium to rule out a WebKit-only paint
const TAG = ENGINE === 'webkit' ? '' : '-' + ENGINE;
const L = await local({ variant: 'typical', clock: 'real', engine: ENGINE });
console.log('engine', ENGINE);
try {
  const state = page => page.evaluate(() => {
    const r = id => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return { on: e.classList.contains('on'), display: getComputedStyle(e).display, top: Math.round(b.top), h: Math.round(b.height) }; };
    const f = document.getElementById('chat-form'); const fb = f.getBoundingClientRect();
    return { tab: document.documentElement.dataset.tab, hash: location.hash, home: r('view-home'), me: r('view-me'), apps: r('view-apps'), chat: r('view-chat'),
      chatForm: { hidden: f.hidden, display: getComputedStyle(f).display, top: Math.round(fb.top), bottom: Math.round(fb.bottom) }, viewportH: innerHeight, viewsScrollH: document.getElementById('views').scrollHeight };
  });

  // ── (A) cold load of a stale URL on the kiosk ─────────────────────────────────────────────
  for (const h of ['#me', '#chat', '#apps']) {
    const d = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
    await d.goto(h); await d.page.waitForSelector('#tv #clock', { timeout: 15000 }).catch(() => {}); await sleep(1200);
    const s = await state(d.page);
    log(`A cold load index.html${h}: tab / hash / me.display / chatForm.hidden`, { tab: s.tab, hash: s.hash, meDisplay: s.me.display, chatFormHidden: s.chatForm.hidden });
    await d.close();
  }

  // ── (B) same-document hash navigation on an open board ─────────────────────────────────────
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  const { page } = tv;
  const dialogs = [];
  page.on('dialog', async dl => { dialogs.push({ type: dl.type(), message: dl.message() }); await dl.dismiss(); });
  const api = [];
  page.on('request', r => { const u = new URL(r.url()); if (u.origin === L.api && u.pathname.startsWith('/api/chat')) api.push(r.method() + ' ' + u.pathname); });
  page.on('response', async r => { const u = new URL(r.url()); if (u.origin === L.api && u.pathname === '/api/chat') { let b = null; try { b = await r.json(); } catch {} api.push('RESP ' + r.status() + ' ' + JSON.stringify(b)); } });
  await tv.goto('#home'); await page.waitForSelector('#tv #clock'); await sleep(1500);
  log('B board loaded', { tab: (await state(page)).tab, kind: await page.evaluate(() => document.documentElement.dataset.kind) });

  // B1: a bookmark / typed URL with #me on the already-open page (same document: page.goto only changes the fragment)
  await page.goto(L.site + '/index.html#me'); await sleep(900);
  let s = await state(page);
  log('B1 #me via same-doc navigation: tab / home / me / viewsScrollH', { tab: s.tab, home: s.home, me: s.me, viewsScrollH: s.viewsScrollH, viewportH: s.viewportH });
  log('B1 screenshot at the top (board shown, Me below the fold)', await shot(page, `verify-kiosk-hash-nav-1${TAG}-me-top.png`));
  await page.evaluate(() => { const v = document.getElementById('views'); v.scrollTop = v.scrollHeight; }); await sleep(500);
  const meInfo = await page.evaluate(() => {
    const c = b => { if (!b) return null; const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y); return { x: Math.round(x), y: Math.round(y), inViewport: y > 0 && y < innerHeight, hitIsIt: !!hit && (hit === b || b.contains(hit)), rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } }; };
    return { forest: c(document.querySelector('#theme [data-theme="forest"]')), forget: c(document.getElementById('forget')), switchBtn: c(document.getElementById('switch')), syncnow: c(document.getElementById('syncnow')),
      themeCard: (() => { const e = document.getElementById('theme'); const r = e.closest('.card').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; })(),
      tvBg: (() => { const b = document.querySelector('.tv-bg'); const cs = getComputedStyle(b); return { position: cs.position, pe: cs.pointerEvents, z: cs.zIndex, tvZ: getComputedStyle(document.getElementById('tv')).zIndex }; })() };
  });
  log('B1 after scrolling #views: element centres + hit-test', meInfo);
  // visual: the Me cards region with the backdrop as-is vs with the backdrop hidden
  const clip = { x: Math.max(0, meInfo.themeCard.x - 20), y: Math.max(0, meInfo.themeCard.y - 20), width: Math.min(1920, meInfo.themeCard.w + 40), height: Math.min(1080 - Math.max(0, meInfo.themeCard.y - 20), meInfo.themeCard.h + 40) };
  log('B1 screenshot scrolled (as the TV shows it)', await shot(page, `verify-kiosk-hash-nav-1${TAG}-me-scrolled.png`));
  const bufA = await page.screenshot({ clip, animations: 'disabled', scale: 'css' });
  await page.addStyleTag({ content: '.tv-bg{visibility:hidden !important}' }); await sleep(200);
  const bufB = await page.screenshot({ clip, animations: 'disabled', scale: 'css' });
  log('B1 screenshot scrolled, backdrop hidden (what is under it)', await shot(page, `verify-kiosk-hash-nav-1${TAG}-me-scrolled-nobg.png`));
  await page.evaluate(() => { for (const s of document.querySelectorAll('style')) if (s.textContent.includes('.tv-bg{visibility:hidden')) s.remove(); }); await sleep(200);
  log('B1 Appearance-card region: pixels identical with and without backdrop?', { identical: bufA.equals(bufB), bytesA: bufA.length, bytesB: bufB.length });

  // click where Forest sits
  const before = await page.evaluate(() => ({ dataTheme: document.documentElement.dataset.theme || '(none)', ls: localStorage.getItem('hub.theme') }));
  if (meInfo.forest && meInfo.forest.inViewport) await page.mouse.click(meInfo.forest.x, meInfo.forest.y);
  await sleep(600);
  const after = await page.evaluate(() => ({ dataTheme: document.documentElement.dataset.theme || '(none)', ls: localStorage.getItem('hub.theme'), queue: Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')).map(k => [k, localStorage.getItem(k)]) }));
  log('B1 mouse click at the unseen Forest card: before → after', { before, after });
  log('B1 screenshot after the click', await shot(page, `verify-kiosk-hash-nav-1${TAG}-me-after-forest.png`));
  // Forget this device: click it (a confirm() guards it; dismissed here)
  const f2 = await page.evaluate(() => { const b = document.getElementById('forget'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, inViewport: r.top < innerHeight && r.bottom > 0 }; });
  if (f2.inViewport) await page.mouse.click(f2.x, f2.y);
  await sleep(500);
  log('B1 click at the unseen "Forget this device": dialogs', dialogs);
  log('B1 device still paired after dismissing', await page.evaluate(() => !!localStorage.getItem('hub.device')));

  // B2: #chat
  await page.evaluate(() => { location.hash = '#chat'; }); await sleep(900);
  s = await state(page);
  log('B2 #chat: tab / chatForm / home / chat view', { tab: s.tab, chatForm: s.chatForm, home: s.home, chat: s.chat });
  const composer = await page.evaluate(() => { const i = document.getElementById('chat-in'); const r = i.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { top: Math.round(r.top), inViewport: r.top < innerHeight && r.bottom > 0, hitIsInput: hit === i, disabled: i.disabled, placeholder: i.placeholder, formZ: getComputedStyle(document.getElementById('chat-form')).zIndex, formPos: getComputedStyle(document.getElementById('chat-form')).position }; });
  log('B2 composer', composer);
  log('B2 screenshot (composer over the board)', await shot(page, `verify-kiosk-hash-nav-1${TAG}-chat.png`));
  if (composer.inViewport && !composer.disabled) {
    await page.fill('#chat-in', 'hello from the TV'); await page.click('#chat-send'); await sleep(2500);
    log('B2 send: network', api);
    const err = await page.evaluate(() => { const m = [...document.querySelectorAll('#chat-log .msg')].pop(); if (!m) return null; const r = m.getBoundingClientRect(); return { text: m.textContent.trim().slice(0, 140), cls: m.className, top: Math.round(r.top), bottom: Math.round(r.bottom), inViewport: r.top < innerHeight && r.bottom > 0 }; });
    log('B2 last bubble after send', err);
    log('B2 views scroll', await page.evaluate(() => { const v = document.getElementById('views'); return { scrollTop: Math.round(v.scrollTop), scrollH: v.scrollHeight, clientH: v.clientHeight }; }));
    log('B2 screenshot after send', await shot(page, `verify-kiosk-hash-nav-1${TAG}-chat-sent.png`));
    await page.addStyleTag({ content: '.tv-bg{visibility:hidden !important}' }); await sleep(200);
    log('B2 screenshot after send, backdrop hidden', await shot(page, `verify-kiosk-hash-nav-1${TAG}-chat-sent-nobg.png`));
    await page.evaluate(() => { for (const s of document.querySelectorAll('style')) if (s.textContent.includes('.tv-bg{visibility:hidden')) s.remove(); });
  }

  // B3: #apps
  await page.evaluate(() => { location.hash = '#apps'; }); await sleep(900);
  s = await state(page);
  log('B3 #apps: tab / home / apps view', { tab: s.tab, home: s.home, apps: s.apps });
  log('B3 empty message', await page.evaluate(() => { const e = document.querySelector('#grid .empty') || document.querySelector('#view-apps .empty'); if (!e) return null; const r = e.getBoundingClientRect(); return { text: e.textContent.trim().slice(0, 80), top: Math.round(r.top), onScreen: r.top < innerHeight }; }));

  // B4: back to #home by hash — does the TV recover?
  await page.evaluate(() => { location.hash = '#home'; }); await sleep(900);
  s = await state(page);
  log('B4 #home again: tab / me.display / chatForm.hidden', { tab: s.tab, meDisplay: s.me.display, chatFormHidden: s.chatForm.hidden });
  log('page errors / console errors', tv.logs.filter(l => /error/i.test(l)).slice(0, 8));
  await tv.close();
  fs.writeFileSync(path.join(OUT, 'verify-kiosk-hash-nav-1' + TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('wrote', rel(path.join(OUT, 'verify-kiosk-hash-nav-1' + TAG + '.json')));
} finally { await L.close(); }
