// Skeptic 2 for "double-tap on one ✓ removes that item and the one below it".
// Independent of doubletap.mjs / _lib.mjs. Typical seed, demo clock. For each arm: fresh reset, open the Larder in the
// shell viewer, pick a target card by position, tap its ✓ once, and record what sits under the same point after the
// synchronous re-render; then (double arms) tap again at the same point. Reads the server rows afterwards.
// Arms: control single tap (webkit iPhone); double touch 250 ms (webkit iPhone); double touch 250 ms (chromium iPhone,
// to rule out a WebKit-on-Windows artefact); double touch on the LAST card of a group (webkit iPhone).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EV, { recursive: true });
const PFX = 'verify-double-tap-removes-next-item-2';
const out = { arms: {} };

async function live(L) {
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  const rows = r.body.items || r.body.rows || r.body.data || [];
  return rows.filter(x => x.key.startsWith('item:') && x.value).map(x => x.value.name);
}
async function openLarder(d) {
  await d.goto('#home');
  const f = await d.openApp('leftovers');
  await f.waitForSelector('.item .done', { timeout: 20000 });
  await sleep(800);
  return f;
}
async function under(f, fx, fy) {
  return f.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y); if (!el) return null;
    const c = el.closest('.item');
    return { tag: el.tagName, cls: el.className && String(el.className.baseVal ?? el.className), onDone: !!el.closest('.done'), card: c ? c.querySelector('.nm').textContent : null };
  }, [fx, fy]);
}

async function arm(L, name, { engineL, device = 'iphone-pwa', pick, taps, gap = 250 }) {
  await engineL.reset('typical');
  const d = await engineL.device({ device, profile: 'eli' });
  try {
    const f = await openLarder(d);
    const order = await f.evaluate(() => [...document.querySelectorAll('.group')].map(g => ({ tone: g.dataset.tone, names: [...g.querySelectorAll('.item .nm')].map(n => n.textContent) })));
    const target = pick(order);
    const btn = await f.$(`.item:has(.nm:text-is("${target}")) .done`);
    await btn.scrollIntoViewIfNeeded();
    const box = await btn.boundingBox();
    const fr = await (await f.frameElement()).boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const serverBefore = await live(engineL);
    const underBefore = await under(f, x - fr.x, y - fr.y);
    await d.page.touchscreen.tap(x, y);
    await sleep(gap);
    const underAfterFirst = await under(f, x - fr.x, y - fr.y);
    if (taps === 2) await d.page.touchscreen.tap(x, y);
    await sleep(4000);
    const serverAfter = await live(engineL);
    const removed = serverBefore.filter(n => !serverAfter.includes(n));
    const dialogsOrUndo = await f.evaluate(() => document.querySelectorAll('[class*=undo],[class*=toast],dialog[open]').length);
    const png = `${PFX}-${name}.png`;
    await d.page.screenshot({ path: path.join(EV, png), scale: 'css' });
    out.arms[name] = { device, taps, gapMs: gap, groups: order, target, tapPoint: [Math.round(x), Math.round(y)], underBefore, underAfterFirst, serverBefore, serverAfter, removedOnServer: removed, undoOrToastNodes: dialogsOrUndo, shot: 'audits/evidence/p3/leftovers/' + png };
    console.log(name, JSON.stringify({ target, underAfterFirst, removedOnServer: removed, undoOrToastNodes: dialogsOrUndo }));
  } finally { await d.close(); }
}

const W = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
let C;
try {
  out.engineW = 'webkit';
  await arm(W, 'control-single-webkit', { engineL: W, pick: o => o.find(g => g.names.length > 1).names[0], taps: 1 });
  await arm(W, 'double-webkit', { engineL: W, pick: o => o.find(g => g.names.length > 1).names[0], taps: 2 });
  await arm(W, 'double-lastInGroup-webkit', { engineL: W, pick: o => { const g = o.find(g => g.names.length > 1); return g.names[g.names.length - 1]; }, taps: 2 });
  await arm(W, 'double-ipad-webkit', { engineL: W, device: 'ipad-portrait', pick: o => o.find(g => g.names.length > 1).names[0], taps: 2, gap: 300 });
} finally { await W.close(); }
try {
  C = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
  await arm(C, 'double-chromium', { engineL: C, pick: o => o.find(g => g.names.length > 1).names[0], taps: 2 });
} catch (e) { out.chromiumError = String(e); console.log('chromium arm failed', e.message); }
finally { if (C) await C.close(); }
fs.writeFileSync(path.join(EV, PFX + '.json'), JSON.stringify(out, null, 1));
console.log('saved audits/evidence/p3/leftovers/' + PFX + '.json');
