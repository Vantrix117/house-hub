// Skeptic 2 for critic-remote-change-rerender-shifts-tap-1: does a remote change re-render the open Larder under
// Eli's finger so that his ✓ tap removes a different item?  Independent of the investigator's script:
//   - Mom finishes an item through her OWN paired phone's UI (a real ✓ tap → hub.remove), not a hand-made PUT;
//   - Eli's phone is NOT told to pull: we wait for its own 30 s pull timer (apps/hub.js:342) to repaint the list;
//   - the moment the list repaints, one touchscreen tap lands at the ✓ centre Eli measured before (his finger in flight).
// Arms (typical seed; Aging = chili, sweet potatoes; Fresh = pot roast, spaghetti, pancakes):
//   C: Mom finishes "Sunday pot roast"; Eli aims at "Spaghetti and meatballs" (same group, a card below it: direct hit?)
//   B: Mom finishes "Beef and bean chili"; Eli aims at "Roasted sweet potatoes" (investigator's arm B)
//   CTRL: nobody changes anything; Eli taps "Spaghetti and meatballs" after the same wait (must remove only it)
// Usage: node "audits/tools/phase3/leftovers/verify-critic-remote-change-rerender-shifts-tap-1-2.mjs" [webkit|chromium]
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
const engine = process.argv[2] || 'webkit';
const EV = path.resolve('audits/evidence/p3/leftovers'); fs.mkdirSync(EV, { recursive: true });
const TAG = 'verify-critic-remote-change-rerender-shifts-tap-1-2';
const out = { engine, arms: {} };

async function live(L) {
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  return (r.body.items || []).filter(x => x.key.startsWith('item:') && x.value).map(x => ({ key: x.key, name: x.value.name }));
}
async function under(f, x, y) {
  return f.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const c = el && el.closest('.item');
    return { el: el ? el.tagName + '.' + el.className : null, onDone: !!(el && el.closest('.done')), card: c ? c.querySelector('.nm').textContent : null }; }, [x, y]);
}
const names = f => f.evaluate(() => [...document.querySelectorAll('.item .nm')].map(n => n.textContent));

const L = await local({ variant: 'typical', clock: 'demo', engine });
try {

  for (const [arm, remoteFinish, target] of [['C', 'Sunday pot roast', 'Spaghetti and meatballs'], ['B', 'Beef and bean chili', 'Roasted sweet potatoes'], ['CTRL', null, 'Spaghetti and meatballs']]) {
    await L.reset('typical');
    const momDev = await L.newDevice({ name: 'Mom phone', profiles: ['mom'] });   // after the reset (a reset reseeds devices)
    const eli = await L.device({ device: 'iphone-pwa', profile: 'eli' });
    const mom = await L.device({ device: 'iphone-pwa', profile: 'mom', as: momDev });
    try {
      await eli.goto('#home'); const fe = await eli.openApp('leftovers'); await fe.waitForSelector('.item .done', { timeout: 20000 });
      await mom.goto('#home'); await sleep(1500); const fm = await mom.openApp('leftovers'); await fm.waitForSelector('.item .done', { timeout: 20000 });
      await sleep(1500);
      // Eli's finger: the centre of the target's ✓ as he sees it now
      const btn = await fe.$(`.item:has(.nm:text-is("${target}")) .done`);
      await btn.scrollIntoViewIfNeeded();
      const box = await btn.boundingBox(); const fr = await (await fe.frameElement()).boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      const before = await under(fe, x - fr.x, y - fr.y);
      const srv0 = await live(L);
      const namesBefore = await names(fe);
      // Mom's real tap on her own phone
      let momRemoved = null;
      if (remoteFinish) {
        const mb = await fm.$(`.item:has(.nm:text-is("${remoteFinish}")) .done`);
        await mb.scrollIntoViewIfNeeded();
        const b2 = await mb.boundingBox();
        await mom.page.touchscreen.tap(b2.x + b2.width / 2, b2.y + b2.height / 2);
        const t0 = Date.now();
        while (Date.now() - t0 < 10000) { if (!(await live(L)).some(r => r.name === remoteFinish)) break; await sleep(200); }
        momRemoved = !(await live(L)).some(r => r.name === remoteFinish);
      }
      // Wait for Eli's own pull timer to repaint (no hub.pull() from the script)
      const tWait = Date.now(); let repaintedAfterMs = null;
      if (remoteFinish) {
        while (Date.now() - tWait < 45000) {
          const n = await names(fe);
          if (!n.includes(remoteFinish)) { repaintedAfterMs = Date.now() - tWait; break; }
          await sleep(30);
        }
      } else await sleep(2000);
      const after = await under(fe, x - fr.x, y - fr.y);
      await eli.page.touchscreen.tap(x, y);           // Eli's tap, aimed before the repaint
      await sleep(3000);
      const srv1 = await live(L);
      const removedByEliTap = srv0.filter(r => r.name !== remoteFinish && !srv1.some(s => s.key === r.key)).map(r => r.name);
      const png = `${TAG}-${arm}-${engine}-iphone.png`;
      await eli.page.screenshot({ path: path.join(EV, png), scale: 'css' });
      out.arms[arm] = { remoteFinishByMomUI: remoteFinish, momRemovedOnServer: momRemoved, eliAimedAt: target, point: { x: Math.round(x), y: Math.round(y) },
        repaintedByOwnTimerAfterMs: repaintedAfterMs, namesBefore, underBefore: before, underAfterRepaint: after, removedByEliTap,
        targetStillOnServer: srv1.some(s => s.name === target), eliListAfter: await names(fe), shot: 'audits/evidence/p3/leftovers/' + png };
      console.log(arm, JSON.stringify(out.arms[arm]));
    } finally { await eli.close(); await mom.close(); }
  }
} finally { await L.close(); }
const file = path.join(EV, `${TAG}-${engine}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log('saved', path.relative(process.cwd(), file));
