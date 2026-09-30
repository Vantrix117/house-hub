// Batch 3, review round 2 (Worker A): the Kitchen view opens at its top every time it is opened by hand, and when the
// shell brings its bar back by itself ('hub:immersive' { on:false }) an open Pray mode or Kitchen view closes with it.
// iPad landscape, Eli, the rig's typical seed. Run: node "audits/tools/phase6/3/prayer-review2-3.mjs"
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/3';
fs.mkdirSync(OUT, { recursive: true });
const res = {}; let pass = 0, fail = 0;
const ok = (c, n, x) => { res[n] = { ok: !!c, x }; if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, JSON.stringify(x)); } };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'ipad-landscape', profile: 'eli' });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 }); await sleep(800);
  const openK = async () => { await f.click('#moreBtn'); await sleep(400); await f.click('[data-more="kitchen"]'); await sleep(600); };
  const state = () => f.evaluate(() => { const k = document.getElementById('kitchen'), g = k.querySelector('#kitchenBody h1, #kitchenBody .k-cat, #kitchenBody *');
    return { on: k.classList.contains('on'), top: k.scrollTop, firstY: g ? Math.round(g.getBoundingClientRect().top) : null, max: k.scrollHeight - k.clientHeight }; });
  await openK();
  await f.evaluate(() => { const k = document.getElementById('kitchen'); k.scrollTop = k.scrollHeight; }); await sleep(300);
  const scrolled = await state();
  await f.click('#kitchenShut'); await sleep(400);
  await f.click('#listSwitch [data-list="shared"]'); await sleep(500);   // the other list, as the reviewer did
  await openK();
  const reopened = await state();
  ok(scrolled.top > 0 && reopened.on && reopened.top === 0 && reopened.firstY >= 0, 'the Kitchen view reopens at its top (other list too)', { scrolled, reopened });
  await f.evaluate(() => { const k = document.getElementById('kitchen'); k.scrollTop = 200; refreshKitchen(); }); await sleep(200);
  ok(await f.evaluate(() => document.getElementById('kitchen').scrollTop) > 0, 'a remote repaint (refreshKitchen) keeps its place');
  await f.evaluate(() => window.dispatchEvent(new CustomEvent('hub:immersive', { detail: { on: false } }))); await sleep(300);
  ok(!(await f.evaluate(() => document.getElementById('kitchen').classList.contains('on'))), 'the shell bringing its bar back closes the Kitchen view');
  await f.click('#startPray'); await sleep(500);
  const prayOn = await f.evaluate(() => document.getElementById('pray').classList.contains('on'));
  await f.evaluate(() => window.dispatchEvent(new CustomEvent('hub:immersive', { detail: { on: false } }))); await sleep(300);
  ok(prayOn && !(await f.evaluate(() => document.getElementById('pray').classList.contains('on'))), '…and Pray mode', { prayOn });
} catch (e) { fail++; console.log('  ✗ threw', e.stack); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/prayer-review2-3.json`, JSON.stringify(res, null, 1)); await L.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
