// s2 skeptic, UX-SYNC-a1: (1) with an app open offline and writes waiting, what covers the tab-bar sync dot and does
// anything on screen say so; (2) a 4xx-dropped batch in Larder (the one app that speaks up about sync): what the user sees
// during the error and after the next pull.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-SYNC-a1/s2');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo' });
const res = {};
const WORDS = /offline|not sent|unsent|waiting|sync|can.t reach|problem|not saved|failed/i;
try {
  // (1) F260 open on the iPhone, offline, three writes queued
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await d.goto('#home'); await d.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 15000 });
  const f = await d.openApp('f260'); await sleep(1500);
  await d.setOffline(true);
  await f.evaluate(() => { for (let i = 0; i < 3; i++) hub.set('s2probe.' + i, { i, at: Date.now() }); });
  await sleep(1200);
  res.inApp = await d.page.evaluate(() => { const dot = document.getElementById('syncdot'); const r = dot.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { dotClass: dot.className, dotRect: [r.left, r.top, r.width, r.height].map(Math.round), onTop: top ? (top.id || top.tagName) : null, viewerOn: document.getElementById('viewer').classList.contains('on'), pillText: document.getElementById('pill').innerText.replace(/\s+/g, ' ') }; });
  res.inApp.frameSync = await f.evaluate(() => ({ ...hub.sync }));
  res.inApp.frameWords = await f.evaluate(src => { const re = new RegExp(src, 'i'); return [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && e.offsetParent !== null && re.test(e.textContent)).map(e => e.textContent.trim().slice(0, 80)).slice(0, 10); }, WORDS.source);
  await d.shot(path.join(OUT, 'f260-offline-3-pending.png'));
  await d.setOffline(false); await sleep(1500);
  await d.close();

  // (2) Larder on the iPad: the batch comes back 400 (as for a >200 queue) — what is shown, and after the next pull?
  const k = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  await k.goto('#home'); await k.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 15000 });
  const lf = await k.openApp('leftovers'); await sleep(1500);
  await lf.evaluate(() => { window.__tr = []; hub.onSync(s => window.__tr.push(s.state + (s.lastError ? ':' + s.lastError : '') + ' p' + s.pending)); });
  let hits = 0;
  await k.ctx.route(u => /\/api\/data\/leftovers\/batch/.test(u.pathname), r => { hits++; return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'bad_batch', message: 'items must be an array of at most 200.' }) }); });
  await lf.evaluate(() => { const id = 's2probe'; hub.set('item:' + id, { id, name: 'S2 probe soup', size: 'Medium', date: new Date().toISOString().slice(0, 10), addedAt: Date.now(), by: 'eli' }); });
  await sleep(1500);
  const during = await lf.evaluate(() => { const m = document.getElementById('mode'); const t = document.getElementById('hub-toast'); return { sync: { ...hub.sync }, mode: m && !m.hidden ? m.textContent : null, toast: t && t.textContent || null, listed: document.body.innerText.includes('S2 probe soup') }; });
  await k.shot(path.join(OUT, 'larder-400-during.png'));
  await lf.evaluate(() => hub.pull()); await sleep(1200);
  const afterPull = await lf.evaluate(() => { const m = document.getElementById('mode'); return { sync: { ...hub.sync }, mode: m && !m.hidden ? m.textContent : null, listed: document.body.innerText.includes('S2 probe soup'), queue: Object.keys(JSON.parse(localStorage.getItem('hub.queue.leftovers:family') || '{}')).length, transitions: window.__tr }; });
  await k.shot(path.join(OUT, 'larder-400-after-pull.png'));
  const server = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  const shellDot = await k.page.evaluate(() => document.getElementById('syncdot').className);
  res.dropped = { batchHits: hits, during, afterPull, shellDotAfter: shellDot, onServer: (server.body.items || []).some(i => i.key === 'item:s2probe') };
  await k.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'sync-ui.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
