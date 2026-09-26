// UX-LEFTOVERS-1, skeptic s1: one tap on a ✓ as an adult (Eli, iPhone PWA and Kitchen iPad). Is there any undo, confirm,
// toast or completed history anywhere (Larder frame or shell)? What is left on the server (tombstone or live row)?
// How close are neighbouring ✓ buttons (mis-tap geometry)? Run from the repo root.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';

const OUT = path.resolve('audits/evidence/p5/ux-verify/UX-LEFTOVERS-1/s1');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const raw = async () => { const r = await L.apiAs('eli', '/api/data/leftovers?scope=family'); return (r.body.items || r.body.rows || r.body.data || []); };
try {
  for (const device of ['iphone-pwa', 'ipad-portrait']) {
    if (device === 'ipad-portrait') await L.reset('typical');
    const d = await L.device({ device, profile: 'eli' });
    const f = await d.openApp('leftovers');
    await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
    await sleep(800);
    const r = { device };
    r.before = await f.evaluate(() => {
      const done = [...document.querySelectorAll('.done')].map(b => { const q = b.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; });
      const gaps = done.slice(1).map((q, i) => Math.round(q.y - (done[i].y + done[i].h)));
      const chip = document.querySelector('.status').getBoundingClientRect(), d0 = done[0];
      return {
        names: [...document.querySelectorAll('.nm')].map(n => n.textContent), doneCount: done.length,
        doneSize: [Math.round(d0.w), Math.round(d0.h)], verticalGapsBetweenChecks: gaps, chipToCheckGapPx: Math.round(d0.x - (chip.x + chip.width)),
        title: document.querySelector('.done').title, confirmInSource: /confirm\(/.test(document.scripts[document.scripts.length - 1].textContent),
      };
    });
    const target = r.before.names[1];
    r.target = target;
    const serverBefore = (await raw()).filter(x => x.value).map(x => x.value.name);
    let dialogs = 0; d.page.on('dialog', async dl => { dialogs++; await dl.dismiss(); });
    await f.tap(`.item:has(.nm:text-is("${target}")) .done`);
    await sleep(400);
    r.within400ms = {
      frameText: await f.evaluate(() => document.body.innerText.match(/undo|restore|completed|history|put back|deleted|removed/gi) || []),
      shellText: await d.page.evaluate(() => document.body.innerText.match(/undo|restore|completed|history|put back/gi) || []),
      shellToasts: await d.page.evaluate(() => [...document.querySelectorAll('[class*="toast"], [role="status"], [role="alert"]')].map(e => e.textContent.trim()).filter(Boolean)),
      frameToasts: await f.evaluate(() => [...document.querySelectorAll('[class*="toast"], [role="status"], [role="alert"]')].map(e => e.textContent.trim()).filter(Boolean)),
    };
    await d.shot(path.join(OUT, `after-tap-${device}.png`));
    await sleep(3000);
    r.dialogs = dialogs;
    r.afterUI = await f.evaluate(() => [...document.querySelectorAll('.nm')].map(n => n.textContent));
    const rows = await raw();
    const serverAfter = rows.filter(x => x.value).map(x => x.value.name);
    r.removedOnServer = serverBefore.filter(n => !serverAfter.includes(n));
    r.tombstones = rows.filter(x => !x.value).map(x => ({ key: x.key, value: x.value }));
    r.hubListSeesTombstone = await f.evaluate(() => hub.list('item:').some(x => !x.value));
    const feed = (await L.apiAs('eli', '/api/activity?limit=4')).body;
    r.feedTop = (feed.activity || feed).slice(0, 2).map(a => a.text);
    out[device] = r;
    await d.close();
  }
  fs.writeFileSync(path.join(OUT, 'undo.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
} finally { await L.close(); }
