// Probe for skeptic 2: on the last card of the Aging group, log every click target (capture phase) in the Larder frame
// and the ✓ rectangles around the tap point before and after the first tap. Prints the observations; writes nothing.
import { local, sleep } from '../../lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await d.goto('#home');
  const f = await d.openApp('leftovers');
  await f.waitForSelector('.item .done'); await sleep(800);
  await f.evaluate(() => { window.__clicks = []; document.addEventListener('click', e => { const c = e.target.closest('.item'); window.__clicks.push({ t: Math.round(performance.now()), tag: e.target.tagName, done: !!e.target.closest('.done'), card: c && c.querySelector('.nm').textContent, x: e.clientX, y: e.clientY }); }, true); });
  const target = await f.evaluate(() => { const g = [...document.querySelectorAll('.group')].find(g => g.querySelectorAll('.item').length > 1); const n = g.querySelectorAll('.item .nm'); return n[n.length - 1].textContent; });
  const btn = await f.$(`.item:has(.nm:text-is("${target}")) .done`);
  await btn.scrollIntoViewIfNeeded();
  const box = await btn.boundingBox(); const fr = await (await f.frameElement()).boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const rects = () => f.evaluate(() => ({ scrollY: scrollY, done: [...document.querySelectorAll('.item')].map(c => { const r = c.querySelector('.done').getBoundingClientRect(); return c.querySelector('.nm').textContent + ' ' + Math.round(r.top) + '-' + Math.round(r.bottom); }) }));
  console.log('target', target, 'tap frame y', Math.round(y - fr.y), 'before', JSON.stringify(await rects()));
  await d.page.touchscreen.tap(x, y); await sleep(50);
  console.log('after1 +50ms', JSON.stringify(await rects()));
  await sleep(200);
  console.log('after1 +250ms', JSON.stringify(await rects()));
  await d.page.touchscreen.tap(x, y); await sleep(300);
  console.log('clicks', JSON.stringify(await f.evaluate(() => window.__clicks)));
  await d.close();
} finally { await L.close(); }
