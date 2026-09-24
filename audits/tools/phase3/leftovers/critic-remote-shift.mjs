// Completeness critic: a change made on ANOTHER device re-renders the open Larder under the finger (apps/leftovers.html:
// 203-246 rebuilds the list; 377 hub.onChange(render)). A tap aimed at one ✓ just before the re-render lands on a
// different item's ✓ and tombstones it (no undo). This is a trigger P3-LEFTOVERS-01 (self double-tap) does not cover.
// Typical seed, WebKit, iPhone PWA as Eli. Arms:
//   A: Mom finishes "Chicken alfredo" (the only Use-it-up item) on her phone; Eli is about to tap Beef and bean chili's ✓.
//   B: Mom finishes "Beef and bean chili"; Eli is about to tap Roasted sweet potatoes' ✓ (same group, the card above goes).
// Eli's device pulls (hub.pull(), as its 30 s timer / visibility / storage event would), then one touch tap lands at the
// point measured before the pull. Prints what was under the point before/after and what the server lost.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
const EV = path.resolve('audits/evidence/p3/leftovers'); fs.mkdirSync(EV, { recursive: true });
const out = {};
async function live(L) {
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  return (r.body.items || []).filter(x => x.key.startsWith('item:') && x.value).map(x => ({ key: x.key, name: x.value.name }));
}
async function under(f, x, y) {
  return f.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const c = el && el.closest('.item');
    return { onDone: !!(el && el.closest('.done')), card: c ? c.querySelector('.nm').textContent : null }; }, [x, y]);
}
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const [arm, remoteFinish, target] of [['A', 'Chicken alfredo', 'Beef and bean chili'], ['B', 'Beef and bean chili', 'Roasted sweet potatoes']]) {
    await L.reset('typical');
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
    try {
      await d.goto('#home');
      const f = await d.openApp('leftovers');
      await f.waitForSelector('.item .done', { timeout: 20000 }); await sleep(1500);
      const btn = await f.$(`.item:has(.nm:text-is("${target}")) .done`);
      await btn.scrollIntoViewIfNeeded();
      const box = await btn.boundingBox(); const fr = await (await f.frameElement()).boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      const before = await under(f, x - fr.x, y - fr.y);
      const srv0 = await live(L);
      const row = srv0.find(r => r.name === remoteFinish);
      const put = await L.apiAs('mom', '/api/data/leftovers/' + encodeURIComponent(row.key) + '?scope=family', { method: 'PUT', body: { value: null, updated_at: Date.now() } });
      await f.evaluate(() => hub.pull());
      await sleep(400);
      const after = await under(f, x - fr.x, y - fr.y);
      await d.page.touchscreen.tap(x, y);          // Eli's tap, aimed at `target` before the re-render
      await sleep(4000);
      const srv1 = await live(L);
      const lostByEli = srv0.filter(r => r.name !== remoteFinish && !srv1.some(s => s.key === r.key)).map(r => r.name);
      const png = `critic-remote-shift-${arm}-iphone.png`;
      await d.page.screenshot({ path: path.join(EV, png), scale: 'css' });
      out[arm] = { remoteFinishByMom: remoteFinish, putStatus: put.status, eliAimedAt: target, underBeforePull: before, underAfterPull: after, removedByEliTap: lostByEli, targetStillOnServer: srv1.some(s => s.name === target), shot: 'audits/evidence/p3/leftovers/' + png };
      console.log(arm, JSON.stringify(out[arm]));
    } finally { await d.close(); }
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'critic-remote-shift.json'), JSON.stringify(out, null, 1));
console.log('saved audits/evidence/p3/leftovers/critic-remote-shift.json');
