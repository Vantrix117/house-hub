// Phase 5 UX verify, skeptic s2, group G08: UX-DOLLYWOOD-4 / -5 / -6 in one run (one browser at a time, closed at the end).
//   node "audits/tools/phase5/ux-verify/UX-DOLLYWOOD-4/s2-verify.mjs"
// A4: search geometry on ipad-portrait, ipad-landscape (1180 = the breakpoint itself), desktop; no-match and multi-match; Enter.
// A5: first open on a fresh phone with the pull held 5 s and 9 s (hub.ready's 6 s cap), and a second open with a cache.
// A6: offline tick on a phone: frame text, shell text, whether the shell's #syncdot is visible (elementFromPoint).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';

const OUT = {};
const EVROOT = path.resolve('audits/evidence/p5/ux-verify');
const log = (item, k, v) => { (OUT[item] ||= {})[k] = v; console.log(item, k, JSON.stringify(v)); };
const shot = async (d, item, name) => { const dir = path.join(EVROOT, item, 's2'); fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };
const PULL = /\/api\/data\/dollywood\?scope=person/;
const ui = f => f.evaluate(() => ({ count: document.getElementById('b-count').textContent, chip1: ([...document.querySelectorAll('#chips .cl')][1] || {}).textContent, markDone: (() => { const b = document.getElementById('b-done'); return b ? { text: b.textContent, disabled: b.disabled } : null; })(), sync: window.hub && hub.sync.state, loadingWords: (document.body.innerText.match(/loading|syncing|fetching|please wait/gi) || []) }));
async function server(L) { const r = await L.apiAs('eli', '/api/data/dollywood?scope=person&since=0'); const it = (r.body.items || []).find(i => i.key === 'progress'); const v = it && it.value; return v ? Object.values(v).filter(x => x === true).length : 0; }

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  // ---------------- UX-DOLLYWOOD-4 ----------------
  for (const dev of ['ipad-portrait', 'ipad-landscape', 'desktop']) {
    await L.reset('typical');
    const d = await L.device({ device: dev, profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' }); await sleep(1500);
    const geo = () => f.evaluate(() => { const l = document.getElementById('tab-list'), r = l.getBoundingClientRect(), q = document.getElementById('q').getBoundingClientRect();
      const t = l.textContent; return { vw: innerWidth, vh: innerHeight, scrollY: Math.round(scrollY), qBottom: Math.round(q.bottom), listTop: Math.round(r.top), gap: Math.round(r.top - q.bottom), listInView: r.top < innerHeight && r.bottom > 0, count: (t.match(/\d+ of \d+/) || [])[0], emptyMsg: /no (match|result)|nothing found|try/i.test(t), rows: l.querySelectorAll('.oi').length, popOpen: document.getElementById('pop').classList.contains('show') }; });
    await f.fill('#q', 'zipline'); await sleep(900);
    log('UX-DOLLYWOOD-4', dev + '.noMatch', await geo());
    log('UX-DOLLYWOOD-4', dev + '.noMatch.png', await shot(d, 'UX-DOLLYWOOD-4', dev + '-no-match.png'));
    await f.fill('#q', 'coaster'); await sleep(900);
    log('UX-DOLLYWOOD-4', dev + '.multiMatch', await geo());
    await f.fill('#q', 'thunder'); await sleep(900);
    log('UX-DOLLYWOOD-4', dev + '.oneMatch', { ...(await geo()), popTitle: await f.evaluate(() => (document.querySelector('#pop h2') || {}).textContent) });
    await d.close();
  }

  // ---------------- UX-DOLLYWOOD-5 ----------------
  for (const hold of [5000, 9000]) {
    await L.reset('typical');
    const before = await server(L);
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await d.ctx.route(PULL, async r => { await sleep(hold); r.continue().catch(() => {}); });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await sleep(1200);
    const during = await ui(f);
    if (hold === 5000) log('UX-DOLLYWOOD-5', 'duringLoad.png', await shot(d, 'UX-DOLLYWOOD-5', 'first-open-held-5s.png'));
    await sleep(hold + 3000);
    log('UX-DOLLYWOOD-5', 'hold' + hold, { serverBefore: before, during, after: await ui(f) });
    await d.close();
  }
  // tick during the window at 7 s (after hub.ready's 6 s cap) with the pull held 9 s
  {
    await L.reset('typical');
    const before = await server(L);
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await d.ctx.route(PULL, async r => { await sleep(9000); r.continue().catch(() => {}); });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await sleep(1500);
    await f.evaluate(() => { document.getElementById('build').dataset.state = 'half'; document.getElementById('b-done').click(); });
    await sleep(12000);
    log('UX-DOLLYWOOD-5', 'tickDuringLoad', { serverBefore: before, serverAfter: await server(L), ui: await ui(f) });
    await d.close();
  }
  // second open on a device that already has a cache: is there still a blank window?
  {
    await L.reset('typical');
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    let f = await d.openApp('dollywood', { wait: '#b-count' }); await sleep(3000);
    await d.ctx.route(PULL, async r => { await sleep(5000); r.continue().catch(() => {}); });
    const cacheKeys = await f.evaluate(() => Object.keys(localStorage).filter(k => /dollywood/.test(k)));
    await d.page.reload({ waitUntil: 'load' });
    for (let i = 0; i < 100 && !(f = d.frame('dollywood')); i++) await sleep(100);
    await f.waitForSelector('#b-count', { timeout: 10000 });
    await sleep(1200);
    log('UX-DOLLYWOOD-5', 'cacheKeys', cacheKeys);
    log('UX-DOLLYWOOD-5', 'cachedReopenDuringPull', await ui(f));
    await d.close();
  }

  // ---------------- UX-DOLLYWOOD-6 ----------------
  for (const dev of ['iphone-pwa', 'ipad-portrait']) {
    await L.reset('typical');
    const before = await server(L);
    const d = await L.device({ device: dev, profile: 'eli', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' }); await sleep(2500);
    await f.evaluate(() => { document.getElementById('build').dataset.state = 'half'; }); await sleep(300);
    const on = await ui(f);
    await d.setOffline(true); await sleep(400);
    await f.evaluate(() => document.getElementById('b-done').click()); await sleep(1000);
    const frameTxt = await f.evaluate(() => document.body.innerText);
    const shell = await d.page.evaluate(() => { const dot = document.getElementById('syncdot'); const r = dot && dot.getBoundingClientRect(); const top = r && r.width ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      const v = document.getElementById('viewer'); const vs = v && getComputedStyle(v);
      return { dotClass: dot && dot.className, dotRect: r && { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }, dotTopElement: top ? (top.id || top.tagName) + (top.closest('#viewer') ? ' (inside #viewer)' : '') : null, viewer: vs && { display: vs.display, zIndex: vs.zIndex, position: vs.position }, toast: (document.querySelector('.toast') || {}).textContent || null,
        shellVisibleWords: (document.body.innerText.match(/offline|not synced|pending|queued|waiting/gi) || []) }; });
    log('UX-DOLLYWOOD-6', dev + '.offlineTick', { before: on, after: await ui(f), hubSync: await f.evaluate(() => ({ ...hub.sync })), frameWords: frameTxt.match(/offline|not synced|pending|queued|saved|waiting|sync/gi) || [], shell, serverWhileOffline: await server(L), serverBefore: before });
    log('UX-DOLLYWOOD-6', dev + '.offline.png', await shot(d, 'UX-DOLLYWOOD-6', dev + '-offline-after-tick.png'));
    await d.setOffline(false); await sleep(3000);
    log('UX-DOLLYWOOD-6', dev + '.afterReconnect', { server: await server(L), sync: await f.evaluate(() => hub.sync.state) });
    await d.close();
  }
} finally {
  await L.close();
  for (const [item, v] of Object.entries(OUT)) { const dir = path.join(EVROOT, item, 's2'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 's2-verify.json'), JSON.stringify(v, null, 1)); }
}
