// Phase 3 / dollywood — completeness critic: arrow keys never scroll the page.
//   node "audits/tools/phase3/dollywood/critic-arrows.mjs"
// The document keydown handler (apps/dollywood.html:852-857) binds ArrowUp/Down/Left/Right to panning the map and calls
// preventDefault for them, wherever the focus is (except inputs). On desktop the build card sits below the fold, so a
// keyboard user reading the step card cannot scroll with the arrow keys: each press pans the map, which is off-screen.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const L = await local({ variant: 'typical', engine: 'webkit' });
const out = {};
try {
  const d = await L.device({ device: 'desktop', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 30000 }); await sleep(800);
  const st = () => f.evaluate(() => ({ scrollY: Math.round(scrollY), view: view.map(v => Math.round(v)), mapTop: Math.round(document.getElementById('map').getBoundingClientRect().top), mapBottom: Math.round(document.getElementById('map').getBoundingClientRect().bottom), cardTop: Math.round(document.getElementById('b-now').getBoundingClientRect().top), vh: innerHeight }));
  // scroll the page down to the build card with the mouse wheel over the card area, then click plain text in the card (focus on the page, not an input)
  await f.evaluate(() => document.getElementById('b-now').scrollIntoView({ block: 'center' })); await sleep(500);
  const h = await f.$('#b-now h3'); const b = await h.boundingBox(); await d.page.mouse.click(b.x + 4, b.y + b.height / 2);
  const before = await st();
  for (let i = 0; i < 5; i++) { await d.page.keyboard.press('ArrowDown'); await sleep(150); }
  const afterDown = await st();
  for (let i = 0; i < 5; i++) { await d.page.keyboard.press('ArrowUp'); await sleep(150); }
  const afterUp = await st();
  // control: PageDown (not bound) scrolls
  await d.page.keyboard.press('PageUp'); await sleep(500);
  const afterPageUp = await st();
  out.arrows = { before, afterDown, afterUp, afterPageUp };
  console.log(JSON.stringify(out));
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, 'critic-arrows.json'), JSON.stringify(out, null, 1));
  await L.close();
}
