// R-guide probe: the standalone reference flavour opened the way its README says ("Open build/... in any browser", file://): do the sprite icons draw?
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH + '/'); const { chromium } = require('playwright-core');
const b = await chromium.launch({ channel: 'chrome' });
const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; pg.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
await pg.goto('file:///C:/Users/ex_bo/OneDrive/Claude%20Related/dollywood-build-project/build/dollywood_terrain_reference.html', { waitUntil: 'load' });
await pg.waitForTimeout(2500);
const r = await pg.evaluate(() => { const uses = [...document.querySelectorAll('svg use')].filter(u => /sprite\.svg/.test(u.getAttribute('href') || u.getAttribute('xlink:href') || ''));
  const drawn = uses.filter(u => { try { const bb = u.getBBox(); return bb.width > 0 && bb.height > 0; } catch { return false; } });
  return { spriteUses: uses.length, drawn: drawn.length, sample: uses.slice(0, 3).map(u => u.getAttribute('href')), btnNoText: [...document.querySelectorAll('button')].filter(x => x.offsetWidth && !x.textContent.trim()).map(x => x.id || x.className).slice(0, 12) }; });
console.log(JSON.stringify(r)); console.log('console errors', errs.length, errs.slice(0, 3));
await pg.screenshot({ path: 'C:/Users/ex_bo/b910/rev-guide/ref-file.png', clip: { x: 0, y: 0, width: 1280, height: 700 } });
await b.close();
