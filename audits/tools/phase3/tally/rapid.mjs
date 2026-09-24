// Rapid repeated taps on + (tally.html:153): 100 mouse clicks and 100 touch taps as fast as Playwright can send them,
// on the iPhone (touch) inside the shell viewer. Counts what the display and the server end with, how many batch
// POSTs went out (hub.js:245 debounces the flush 250 ms), the visual-viewport scale after the taps (double-tap zoom),
// and whether minus at 0 / Reset at 0 still send writes.
// Run: node "audits/tools/phase3/tally/rapid.mjs"  -> audits/evidence/p3/tally/rapid.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async (p = 'eli') => { const r = await L.apiAs(p, '/api/data/tally?scope=person'); const it = (r.body.items || []).find(i => i.key === 'count'); return it ? it.value : null; };
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  let posts = [];
  d.page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/api/data/tally/batch')) posts.push(r.postDataJSON()); });
  const f = await d.openApp('tally');
  await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0);
  const box = await f.locator('#plus').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const shown = () => f.evaluate(() => Number(document.getElementById('n').textContent));
  const scale = () => d.page.evaluate(() => window.visualViewport ? visualViewport.scale : null);
  for (const how of ['mouse', 'touch']) {
    posts = [];
    const start = await server(), s0 = await shown();
    const t0 = Date.now();
    for (let i = 0; i < 100; i++) { if (how === 'mouse') await d.page.mouse.click(cx, cy); else await d.page.touchscreen.tap(cx, cy); }
    const ms = Date.now() - t0;
    const displayRightAfter = await shown();
    await sleep(2500);
    res[how] = { taps: 100, ms, perTapMs: +(ms / 100).toFixed(1), serverStart: start, displayStart: s0, displayRightAfter, displayEnd: await shown(), serverEnd: await server(), batchPosts: posts.length, itemsPerPost: posts.map(p => p.items.length), viewportScale: await scale() };
    console.log(how, JSON.stringify(res[how]));
  }
  // synchronous burst: 100 el.click() in one task — pure logic, no event pacing
  { posts = []; const start = await server(); await f.evaluate(() => { const b = document.getElementById('plus'); for (let i = 0; i < 100; i++) b.click(); }); await sleep(2500);
    res.syncBurst = { serverStart: start, serverEnd: await server(), display: await shown(), batchPosts: posts.length }; console.log('syncBurst', JSON.stringify(res.syncBurst)); }
  // Reset, then minus at 0 and Reset at 0
  posts = []; await f.locator('#reset').click(); await sleep(800);
  res.reset = { display: await shown(), server: await server(), posts: posts.length, dialogShown: false };
  posts = []; for (let i = 0; i < 3; i++) await f.locator('#minus').click(); await sleep(800);
  res.minusAtZero = { display: await shown(), server: await server(), posts: posts.length, values: posts.map(p => p.items.map(i => i.value)) };
  posts = []; await f.locator('#reset').click(); await sleep(800);
  res.resetAtZero = { display: await shown(), posts: posts.length };
  const minusState = await f.evaluate(() => ({ disabled: document.getElementById('minus').disabled, ariaDisabled: document.getElementById('minus').getAttribute('aria-disabled') }));
  res.minusAtZero.button = minusState;
  console.log('reset', JSON.stringify(res.reset), 'minusAtZero', JSON.stringify(res.minusAtZero), 'resetAtZero', JSON.stringify(res.resetAtZero));
  // touch-action / tap highlight / callout computed on the buttons
  res.css = await f.evaluate(() => ['#plus', '#minus', '#reset', '#n', 'body'].map(s => { const c = getComputedStyle(document.querySelector(s)); return { s, touchAction: c.touchAction, tapHighlight: c.webkitTapHighlightColor, userSelect: c.webkitUserSelect || c.userSelect, callout: c.webkitTouchCallout || null, overscroll: c.overscrollBehaviorY }; }));
  console.log('css', JSON.stringify(res.css));
} finally {
  fs.writeFileSync(`${OUT}/rapid.json`, JSON.stringify(res, null, 1));
  await L.close();
}
