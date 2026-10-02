import { playwright } from './wt/audits/tools/lib/local.mjs';
import fs from 'node:fs';
const pw = playwright();
const R = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const sprite = fs.readFileSync(R + '/icons/sprite.svg', 'utf8');
const ids = [...sprite.matchAll(/<symbol id="([^"]+)"[^>]*>/g)].map(m => [m[1], m[0]]);
const b = await pw.webkit.launch(); const p = await b.newPage({ viewport: { width: 900, height: 900 } });
await p.setContent(`<body style="margin:0;color:#222;--icon-stroke:1.75">${sprite.replace('<svg ', '<svg style="display:none" ')}<div id=g style="display:flex;flex-wrap:wrap;gap:8px;padding:8px">${ids.map(([id]) => `<figure style="margin:0;width:100px;text-align:center;font:10px sans-serif"><svg width="48" height="48" style="stroke-width:1.75"><use href="#${id}"/></svg><br>${id}</figure>`).join('')}</div></body>`);
const res = await p.evaluate(() => [...document.querySelectorAll('#g svg')].map(s => { const u = s.querySelector('use'); const bb = u.getBBox(); return [u.getAttribute('href'), Math.round(bb.width), Math.round(bb.height)]; }));
console.log(ids.length, 'symbols; zero-size:', res.filter(r => !r[1] || !r[2]).map(r => r[0]).join(',') || 'none');
for (const [id, tag] of ids) { if (!/fill="none"/.test(tag) || !/stroke="currentColor"/.test(tag)) console.log('attrs differ', id, tag.slice(0, 140)); }
const sw = [...sprite.matchAll(/stroke-width="([^"]+)"/g)].map(m => m[1]); console.log('explicit stroke-widths:', [...new Set(sw)].join(',') || 'none');
console.log('hex fills:', (sprite.match(/fill="#[0-9a-f]+"|stroke="#[0-9a-f]+"/gi) || []).length);
await p.screenshot({ path: process.argv[2] }); await b.close();
