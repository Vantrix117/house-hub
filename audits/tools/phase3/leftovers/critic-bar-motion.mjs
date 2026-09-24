// Completeness critic: VIS-LEFTOVERS-8 says "the only motion is the bar width (0.8 s)". render() rebuilds every card with
// --p already set (apps/leftovers.html:203-246, 267), so the width transition (line 80) should never run. This counts
// running CSS transitions on the bars right after the first render, after __larder.render(), and after a ✓.
import { local, sleep } from '../../lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  await d.goto('#home');
  const f = await d.openApp('leftovers');
  await f.waitForSelector('.item .done', { timeout: 20000 });
  const count = () => f.evaluate(() => [...document.querySelectorAll('.bar > i')].reduce((n, i) => n + i.getAnimations().length, 0));
  const r = {};
  r.afterOpen = await count();
  await f.evaluate(() => __larder.render()); r.afterRender = await count();
  await f.click('.item .done'); r.afterDone = await count();
  r.transitionCss = await f.evaluate(() => getComputedStyle(document.querySelector('.bar > i')).transition);
  console.log(JSON.stringify(r));
} finally { await L.close(); }
