// PROF (audit Phase 2) skeptic #2 for "kiosk-hash-nav": on the TV (kiosk, 1920×1080) do #me / #chat / #apps render
// under the board, do the invisible Me cards take clicks, is the chat error hidden — and, as the refutation lens,
// does a COLD load of a stale URL/bookmark (index.html#me, #chat, #apps) reach those views at all (enterShell forces
// home for the kiosk, index.html:626), and is "Forget this device" guarded (index.html:1286 confirm()).
// Runs on WebKit and on Chromium (installed Chrome) so a result is not an engine artefact. Local rig only.
//
//   node "audits/tools/phase2/PROF/verify-kiosk-hash-nav-2.mjs"
//
// Evidence: audits/evidence/p2/PROF/verify2-kiosk-nav-*.png + verify2-kiosk-nav.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const result = {};
const log = (eng, k, v) => { console.log(`[${eng}] ${k.padEnd(46)} ${typeof v === 'string' ? v : JSON.stringify(v)}`); (result[eng] ||= {})[k] = v; };

const state = page => page.evaluate(() => {
  const box = id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { on: e.classList.contains('on'), display: getComputedStyle(e).display, top: Math.round(r.top), h: Math.round(r.height) }; };
  const f = document.getElementById('chat-form'); const fr = f.getBoundingClientRect();
  return { hash: location.hash, tab: document.documentElement.dataset.tab, kind: document.documentElement.dataset.kind, home: box('view-home'), me: box('view-me'), chat: box('view-chat'), apps: box('view-apps'),
    chatForm: { hidden: f.hidden, top: Math.round(fr.top), bottom: Math.round(fr.bottom), onScreen: !f.hidden && fr.bottom > 0 && fr.top < innerHeight }, scrollH: document.getElementById('views').scrollHeight, vh: innerHeight };
});

for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  try {
    // ── 1. cold loads: a stale URL / bookmark opened on a fresh page
    for (const h of ['#me', '#chat', '#apps', '#leftovers']) {
      const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
      await tv.goto(h); await tv.page.waitForSelector('#tv #clock', { timeout: 15000 }).catch(() => {}); await sleep(1200);
      const s = await state(tv.page);
      log(engine, `cold load index.html${h}`, { hashAfter: s.hash, tab: s.tab, meOn: s.me.on, meDisplay: s.me.display, chatFormHidden: s.chatForm.hidden, appsDisplay: s.apps.display, viewerOpen: await tv.page.evaluate(() => document.getElementById('viewer') && document.getElementById('viewer').classList.contains('open')) });
      await tv.close();
    }

    // ── 2. live hash change on an open board
    const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
    const page = tv.page;
    const api = [];
    page.on('response', r => { const u = new URL(r.url()); if (u.origin === L.api && u.pathname.startsWith('/api/chat')) api.push(r.request().method() + ' ' + u.pathname + ' ' + r.status()); });
    const dialogs = [];
    page.on('dialog', d => { dialogs.push(d.type() + ': ' + d.message()); d.dismiss().catch(() => {}); });
    await tv.goto('#home'); await page.waitForSelector('#tv #clock'); await sleep(1500);
    log(engine, 'board before (views scrollHeight / vh)', await page.evaluate(() => [document.getElementById('views').scrollHeight, innerHeight]));

    // #me via a same-document navigation (what an address-bar edit or a bookmark opened in the same tab does)
    await page.goto(L.site + '/index.html#me'); await sleep(900);
    const sMe = await state(page);
    log(engine, '#me (same-document nav): state', { hash: sMe.hash, tab: sMe.tab, homeDisplay: sMe.home.display, meTop: sMe.me.top, meH: sMe.me.h, scrollH: sMe.scrollH });
    if (engine === 'webkit') await tv.shot(path.join(OUT, 'verify2-kiosk-nav-me-top-tv.png'));
    await page.evaluate(() => { const v = document.getElementById('views'); v.scrollTop = v.scrollHeight; }); await sleep(400);
    const probe = await page.evaluate(() => {
      const at = el => { if (!el) return null; const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y);
        // is anything painted over it? walk the stack of elements at the point
        const stack = document.elementsFromPoint(x, y).slice(0, 6).map(e => e.id || e.className || e.tagName);
        return { x: Math.round(x), y: Math.round(y), inViewport: y > 0 && y < innerHeight, hitIsIt: !!hit && (hit === el || el.contains(hit)), stack }; };
      return { forest: at(document.querySelector('#theme [data-theme="forest"]')), forget: at(document.getElementById('forget')), syncnow: at(document.getElementById('syncnow')), switchBtn: at(document.getElementById('switch')),
        bgOpacity: getComputedStyle(document.querySelector('.tv-bg')).opacity, bgPointer: getComputedStyle(document.querySelector('.tv-bg')).pointerEvents };
    });
    log(engine, '#me scrolled: hit-test of Me controls', probe);
    if (engine === 'webkit') await tv.shot(path.join(OUT, 'verify2-kiosk-nav-me-scrolled-tv.png'));
    if (probe.forest && probe.forest.inViewport) {
      const before = await page.evaluate(() => [document.documentElement.dataset.theme || '(hearth/system)', localStorage.getItem('hub.theme')]);
      await page.mouse.click(probe.forest.x, probe.forest.y); await sleep(500);
      const after = await page.evaluate(() => [document.documentElement.dataset.theme || '(hearth/system)', localStorage.getItem('hub.theme')]);
      const srv = await L.apiAs('tv', '/api/data/hub?scope=person');
      log(engine, '#me: click on the unseen Forest card', { before, after, serverHubPersonRows: srv.status + ' ' + JSON.stringify(srv.body).slice(0, 160) });
    }
    // Forget this device: click it (dialog auto-dismissed) and check the device is still paired
    await page.evaluate(() => { const v = document.getElementById('views'); v.scrollTop = v.scrollHeight; }); await sleep(300);
    const fg = await page.evaluate(() => { const b = document.getElementById('forget'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, inViewport: r.top > 0 && r.bottom < innerHeight }; });
    if (fg.inViewport) {
      await page.mouse.click(fg.x, fg.y); await sleep(600);
      log(engine, '#me: click on the unseen Forget button', { dialogs: dialogs.slice(), stillPaired: await page.evaluate(() => !!localStorage.getItem('hub.device')) });
    } else log(engine, '#me: Forget button in viewport after scroll', false);

    // #chat
    await page.goto(L.site + '/index.html#chat'); await sleep(900);
    const sChat = await state(page);
    log(engine, '#chat (same-document nav): state', { hash: sChat.hash, homeDisplay: sChat.home.display, chatTop: sChat.chat.top, chatForm: sChat.chatForm });
    if (engine === 'webkit') await tv.shot(path.join(OUT, 'verify2-kiosk-nav-chat-tv.png'));
    if (await page.isVisible('#chat-in')) {
      await page.fill('#chat-in', 'hello'); await page.click('#chat-send'); await sleep(2000);
      const b = await page.evaluate(() => { const m = [...document.querySelectorAll('#chat-log .msg')].pop(); if (!m) return null; const r = m.getBoundingClientRect(); return { text: m.textContent.slice(0, 100), top: Math.round(r.top), inViewport: r.top < innerHeight && r.bottom > 0, err: m.classList.contains('err') }; });
      log(engine, '#chat: send → responses / last bubble', { api: api.slice(), bubble: b });
      if (engine === 'webkit') await tv.shot(path.join(OUT, 'verify2-kiosk-nav-chat-sent-tv.png'));
    }
    const anthropic = await L.anthropicLog().catch(e => String(e));
    log(engine, '#chat: upstream (Anthropic mock) calls', Array.isArray(anthropic) ? anthropic.length : (anthropic && anthropic.calls ? anthropic.calls.length : JSON.stringify(anthropic).slice(0, 120)));

    // #apps
    await page.goto(L.site + '/index.html#apps'); await sleep(900);
    log(engine, '#apps (same-document nav): empty message', await page.evaluate(() => { const e = document.querySelector('#grid .empty'); if (!e) return null; const r = e.getBoundingClientRect(); return { text: e.textContent.trim(), top: Math.round(r.top), onScreen: r.top < innerHeight }; }));

    // after a reload the kiosk is back on the board (the "stale URL" does not stick)
    await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#tv #clock').catch(() => {}); await sleep(1000);
    const sR = await state(page);
    log(engine, 'reload while on #apps → lands on', { hash: sR.hash, tab: sR.tab, appsDisplay: sR.apps.display, chatFormHidden: sR.chatForm.hidden });
    await tv.close();
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(OUT, 'verify2-kiosk-nav.json'), JSON.stringify(result, null, 1));
console.log('wrote audits/evidence/p2/PROF/verify2-kiosk-nav.json');
