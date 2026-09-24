// Phase 3 / dollywood — skeptic #1 for finding "upright-whole-park-zooms-entrance".
// Claim: with the "Whole park" chip pressed, turning on Layers -> Upright fits SEC[curSec] (still 'entrance') instead of the whole park.
// Real taps only (Layers tab, the Upright checkbox, chips), iPad portrait, WebKit, Eli, typical seed.
//   node "audits/tools/phase3/dollywood/verify-upright-whole-park-zooms-entrance-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const P = 'verify-upright-whole-park-zooms-entrance-1';
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const shot = async (d, name) => { const f = path.join(EV, `${P}-${name}.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };
const state = f => f.evaluate(() => ({
  pressedChip: (document.querySelector('#chips button[aria-pressed=true] .cl') || {}).textContent,
  curSec, ROT: window.ROT, upright: document.getElementById('l-upright').checked,
  view: view.map(Math.round), viewWOverFITW: +(view[2] / FITW).toFixed(3),
  entranceBoxW: Math.round(SEC.entrance.box[1] - SEC.entrance.box[0]), allboxW: Math.round(D.layers.allbox[1] - D.layers.allbox[0]),
}));
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
  await sleep(600);
  const tapUpright = async () => { await f.click('.tabs [data-tab=layers]'); await sleep(200); await f.locator('#l-upright').scrollIntoViewIfNeeded(); await f.click('#l-upright'); await sleep(1200); };
  const tapChip = async (id) => { await f.evaluate(() => window.scrollTo(0, 0)); await f.click(`#chips button[data-sec="${id}"]`); await sleep(1200); };

  // A: first open (Whole park chip pressed by default), turn Upright on
  log('A.firstOpen', await state(f));
  await tapUpright();
  log('A.afterUprightOn', await state(f));
  await f.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
  log('A.png', await shot(d, 'A-first-open-upright-on'));
  // reference: tap Whole park again while upright -> what the whole-park fit looks like rotated
  await tapChip('all');
  log('A.refWholeParkRotated', await state(f));
  log('A.ref.png', await shot(d, 'A-ref-whole-park-rotated'));
  // turn Upright off again with Whole park pressed
  await tapUpright();
  log('A.afterUprightOff', await state(f));

  // B: pick another section chip, then Whole park, then Upright on
  const other = await f.evaluate(() => D.sections.filter(s => s.id !== 'all' && s.id !== 'entrance')[0].id);
  await tapChip(other);
  log('B.afterOtherChip', await state(f));
  await tapChip('all');
  log('B.afterWholePark', await state(f));
  await tapUpright();
  const b = await state(f);
  log('B.afterUprightOn', b);
  log('B.fittedBoxMatches', await f.evaluate((o) => ({ curSecBoxW: Math.round(SEC[curSec].box[1] - SEC[curSec].box[0]), curSec, other: o }), other));

  // C: control — a section chip pressed, Upright toggled: fits that section (intended)
  await tapChip(other);
  await tapUpright();
  log('C.sectionPressedUprightToggle', await state(f));

  await d.close();
} finally {
  await L.close();
}
fs.writeFileSync(path.join(EV, `${P}.json`), JSON.stringify(out, null, 1));
console.log('wrote', path.join(EV, `${P}.json`));
