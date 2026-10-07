import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH + '/'); const { chromium } = require('playwright-core');
const b = await chromium.launch({ channel: 'chrome' }); const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
await pg.goto('file:///C:/Users/ex_bo/OneDrive/Claude%20Related/dollywood-build-project/build/dollywood_terrain_reference.html'); await pg.waitForTimeout(2500);
console.log(JSON.stringify(await pg.evaluate(() => { const u = [...document.querySelectorAll('svg use')].filter(x => /^#i-/.test(x.getAttribute('href'))); return { n: u.length, drawn: u.filter(x => { const bb = x.getBBox(); return bb.width > 0 }).length, missing: u.filter(x => !document.querySelector(x.getAttribute('href'))).map(x => x.getAttribute('href')) }; })));
await b.close();
