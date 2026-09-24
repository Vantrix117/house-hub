// Phase 2 / PWA — standalone behaviour that the rig can emulate (WebKit):
//   node "audits/tools/phase2/PWA/standalone.mjs"          (--only n|s|t)
// N  notification tap routing: the service worker's notificationclick posts {source:'hubsw', type:'open', url} to the open
//    hub (sw.js:62-70 → index.html:1573-1576). This dispatches that same message into the shell for: Eli on Home, Mom and
//    Ezra on a shared iPad receiving a push meant for Eli (#f260), the signed-out picker, and the TV kiosk.
// S  safe areas: env(safe-area-inset-*) is 0 in the rig, so the shell's --safe-* tokens are overridden with iPhone Pro Max
//    insets (portrait top 59 / bottom 34; landscape left/right 59, bottom 21) and every edge-anchored shell control is
//    measured against the unsafe bands. Screens are saved with the bands tinted red.
// T  theme colour: after picking each theme in Me, what the theme-color metas hold vs the page background; the static
//    manifest colours and the fixed status-bar style.
// Evidence: audits/evidence/p2/PWA/standalone-run.json and standalone-*.png (1× css).
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1] : null; })();
const log = {};
const say = (k, v) => { log[k] = v; console.log('\n== ' + k + '\n' + JSON.stringify(v, null, 1)); };
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
const shotPage = async (page, name) => { const f = path.join(OUT, name); await page.screenshot({ path: f, scale: 'css', animations: 'disabled' }); return rel(f); };

const L = await local({ variant: 'typical', clock: 'demo' });
try {
  // ── N: notification tap routing ─────────────────────────────────────────────
  if (!only || only === 'n') {
    const tap = async (d, hash) => {
      await d.page.evaluate(h => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { source: 'hubsw', type: 'open', url: location.origin + '/index.html' + h } })), hash);
      await sleep(700);
      const toastSoon = await d.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
      await sleep(1800);
      const f = d.page.frames().find(x => /\/apps\/[^/]+\.html/.test(x.url()));
      return d.page.evaluate(async () => {
        const t = document.getElementById('hub-toast');
        return { hash: location.hash, gateShown: !document.getElementById('gate').hidden, viewerOpen: document.getElementById('viewer').classList.contains('on'), appInViewer: document.getElementById('frame').dataset.id || null, signedInAs: window.hub && hub.profile ? hub.profile.id : null };
      }).then(async s => ({ ...s, toastAt700ms: toastSoon, appProfile: f ? await f.evaluate(() => window.hub && hub.profile ? hub.profile.id : null).catch(() => null) : null }));
    };
    const res = {};
    const eli = await L.device({ device: 'ipad-portrait', profile: 'eli' }); await eli.goto('#home'); await sleep(1500);
    res['Eli on Home, tap "Larder Ledger" push (#leftovers)'] = await tap(eli, '#leftovers');
    const mom = await L.device({ device: 'ipad-portrait', profile: 'mom' }); await mom.goto('#home'); await sleep(1500);
    res['Mom signed in on the shared iPad, tap Eli\'s "F260" nudge (#f260)'] = await tap(mom, '#f260');
    const ezra = await L.device({ device: 'ipad-portrait', profile: 'ezra' }); await ezra.goto('#home'); await sleep(1500);
    res['Ezra signed in on the shared iPad, tap Eli\'s "F260" nudge (#f260)'] = await tap(ezra, '#f260');
    res.ezraShot = await shotPage(ezra.page, 'standalone-notif-tap-kid-ipad-portrait-light.png');
    const pick = await L.device({ device: 'ipad-portrait', profile: null }); await pick.goto(''); await pick.page.waitForSelector('.pcard[data-id]'); await sleep(800);
    res['signed out (picker), tap a "Prayer" push (#prayer)'] = await tap(pick, '#prayer');
    res.pickerShot = await shotPage(pick.page, 'standalone-notif-tap-picker-ipad-portrait-light.png');
    await pick.page.click('.pcard[data-id="ezra"]'); await sleep(2500);
    res['… then Ezra taps his card'] = await pick.page.evaluate(() => ({ hash: location.hash, viewerOpen: document.getElementById('viewer').classList.contains('on'), appInViewer: document.getElementById('frame').dataset.id || null, tab: document.documentElement.dataset.tab }));
    const tv = await L.device({ device: 'tv', profile: 'tv' }); await tv.goto('#home'); await sleep(1500);
    res['TV kiosk, #leftovers'] = await tap(tv, '#leftovers');
    say('N notification tap routing (the message the service worker posts)', res);
    for (const d of [eli, mom, ezra, pick, tv]) await d.close();
  }

  // ── S: safe areas with injected insets ───────────────────────────────────────
  if (!only || only === 's') {
    const inset = ({ top = 0, bottom = 0, left = 0, right = 0 }) => `:root:root{--safe-top:${top}px !important;--safe-bottom:${bottom}px !important;--safe-left:${left}px !important;--safe-right:${right}px !important}`;
    const bands = (page, ins) => page.evaluate(ins => {
      const W = innerWidth, H = innerHeight;
      const add = (s) => { const d = document.createElement('div'); d.className = 'audit-band'; d.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;background:rgba(255,0,0,.28);' + s; document.body.appendChild(d); };
      if (ins.top) add(`left:0;right:0;top:0;height:${ins.top}px`);
      if (ins.bottom) add(`left:0;right:0;bottom:0;height:${ins.bottom}px`);
      if (ins.left) add(`top:0;bottom:0;left:0;width:${ins.left}px`);
      if (ins.right) add(`top:0;bottom:0;right:0;width:${ins.right}px`);
      return { W, H };
    }, ins);
    const measure = (page, ins, sels) => page.evaluate(({ ins, sels }) => {
      const W = innerWidth, H = innerHeight, out = {};
      for (const [name, sel] of Object.entries(sels)) {
        const els = [...document.querySelectorAll(sel)].filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width && r.height && cs.visibility !== 'hidden' && cs.display !== 'none'; });
        if (!els.length) { out[name] = 'not on screen'; continue; }
        const hits = [];
        for (const e of els) {
          const r = e.getBoundingClientRect();
          const bad = [];
          if (ins.top && r.top < ins.top && r.bottom > 0) bad.push(`top ${Math.round(r.top)} < ${ins.top}`);
          if (ins.bottom && r.bottom > H - ins.bottom && r.top < H) bad.push(`bottom ${Math.round(r.bottom)} > ${H - ins.bottom}`);
          if (ins.left && r.left < ins.left && r.right > 0) bad.push(`left ${Math.round(r.left)} < ${ins.left}`);
          if (ins.right && r.right > W - ins.right && r.left < W) bad.push(`right ${Math.round(r.right)} > ${W - ins.right}`);
          if (bad.length) hits.push(((e.id && '#' + e.id) || (e.getAttribute('aria-label')) || e.textContent.trim().slice(0, 24)) + ': ' + bad.join(', '));
        }
        out[name] = hits.length ? hits : 'clear (' + els.length + ')';
      }
      return out;
    }, { ins, sels });
    const res = {};
    const P = { top: 59, bottom: 34 }, LS = { left: 59, right: 59, bottom: 21 };
    // Home with Elizabeth's running timer pill, then Chat, then an app, then the Switch-app sheet — portrait and landscape
    for (const [label, ins, size] of [['portrait 430x932', P, null], ['landscape 932x430', LS, { width: 932, height: 430 }]]) {
      const d = await L.device({ device: 'iphone-pwa', profile: 'mom' });
      if (size) await d.page.setViewportSize(size);
      const r = {};
      await d.goto('#home'); await d.page.addStyleTag({ content: inset(ins) }); await sleep(1500);
      r.home = await measure(d.page, ins, { 'tab bar buttons': '#tabbar .tab', 'first card (hero)': '#view-home > :first-child', 'timer pill': '#timer-pill:not([hidden])', 'feed refresh': '#feed-refresh' });
      await bands(d.page, ins); r.homeShot = await shotPage(d.page, `standalone-safe-home-${size ? 'landscape' : 'portrait'}-iphone-pwa-light.png`);
      await d.goto('#chat'); await d.page.addStyleTag({ content: inset(ins) }); await sleep(1500);
      r.chat = await measure(d.page, ins, { 'chat composer': '#chat-form', 'mic': '#chat-mic', 'send': '#chat-send', 'tab bar buttons': '#tabbar .tab' });
      await bands(d.page, ins); r.chatShot = await shotPage(d.page, `standalone-safe-chat-${size ? 'landscape' : 'portrait'}-iphone-pwa-light.png`);
      await d.openApp('tally'); await d.page.addStyleTag({ content: inset(ins) }); await sleep(1500);
      r.viewer = await measure(d.page, ins, { 'viewer bar buttons': '#pill button:not([hidden])', 'app iframe': '#frame' });
      await d.page.click('#pill-name'); await sleep(600);
      r.sheet = await measure(d.page, ins, { 'sheet buttons': '.sheet .btn' });
      await bands(d.page, ins); r.sheetShot = await shotPage(d.page, `standalone-safe-sheet-${size ? 'landscape' : 'portrait'}-iphone-pwa-light.png`);
      await d.close();
      const g = await L.device({ device: 'iphone-pwa', profile: null });
      if (size) await g.page.setViewportSize(size);
      await g.goto(''); await g.page.waitForSelector('.pcard[data-id]'); await g.page.addStyleTag({ content: inset(ins) }); await sleep(1200);
      r.picker = await measure(g.page, ins, { 'profile cards': '.pcard', 'title': '.gate-title' });
      await bands(g.page, ins); r.pickerShot = await shotPage(g.page, `standalone-safe-picker-${size ? 'landscape' : 'portrait'}-iphone-pwa-light.png`);
      await g.close();
      res[label] = r;
    }
    say('S safe areas (shell tokens overridden with iPhone Pro Max insets)', res);
  }

  // ── T: theme-color follows the theme; manifest colours do not ─────────────────
  if (!only || only === 't') {
    const res = {};
    for (const mode of ['light', 'dark']) {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', mode });
      await d.goto('#me'); await d.page.waitForSelector('.theme-card'); await sleep(800);
      res[mode] = {};
      for (const t of ['system', 'hearth', 'parchment', 'frost', 'midnight', 'forest']) {
        await d.page.click(`.theme-card[data-theme="${t}"]`); await sleep(400);
        res[mode][t] = await d.page.evaluate(() => ({ metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content), bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), scheme: document.documentElement.dataset.scheme || null, statusBarStyle: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content }));
      }
      await d.close();
    }
    // Hearth picked on purpose while the iPhone is in dark mode: what the shell and an app actually paint
    const h = await L.device({ device: 'iphone-pwa', profile: 'eli', mode: 'dark' });
    await h.goto('#me'); await h.page.waitForSelector('.theme-card'); await sleep(600);
    await h.page.click('.theme-card[data-theme="hearth"]'); await sleep(500);
    res.hearthInOsDark = {
      state: await h.page.evaluate(() => ({ dataTheme: document.documentElement.getAttribute('data-theme'), dataScheme: document.documentElement.dataset.scheme, bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), pickedCard: (document.querySelector('.theme-card.on') || {}).dataset?.theme, stored: localStorage.getItem('hub.theme') })),
      meShot: await (async () => { await h.page.locator('#theme').scrollIntoViewIfNeeded(); return shotPage(h.page, 'standalone-hearth-in-os-dark-me-iphone-pwa-dark.png'); })(),
    };
    const hf = await h.openApp('f260'); await sleep(2500);
    res.hearthInOsDark.f260 = await hf.evaluate(() => ({ dataScheme: document.documentElement.dataset.scheme, bodyBg: getComputedStyle(document.body).backgroundColor, bgToken: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() }));
    res.hearthInOsDark.f260Shot = await shotPage(h.page, 'standalone-hearth-in-os-dark-f260-iphone-pwa-dark.png');
    await h.close();
    const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
    say('T theme-color after each theme pick (OS light / OS dark)', { ...res, manifest: { theme_color: man.theme_color, background_color: man.background_color } });
  }
} finally {
  fs.writeFileSync(path.join(OUT, only ? `standalone-run-${only}.json` : 'standalone-run.json'), JSON.stringify(log, null, 1));
  console.log('\nwrote evidence json');
  await L.close();
}
