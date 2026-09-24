// Skeptic #1 for finding "double-tap-removes-next-item" (Larder). Independent reproduction.
// Typical seed, demo clock, WebKit. For each arm: fresh reset, Eli signs in, Larder opens in the shell viewer,
// the target card's ✓ is located, then the gesture runs at that one screen point. We record which card sits under the
// point before and right after the first tap, what the UI and the server hold afterwards, and the feed lines.
// Arms: CTRL single tap (control) · T250 two touch taps 250 ms apart (iPhone) · T350 350 ms apart (iPhone)
//       DBL mouse dblclick (desktop, grandparent double-clicker) · LAST two taps on the last card of a group.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/leftovers');
fs.mkdirSync(EVID, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const live = async () => {
  const r = await L.apiAs('eli', '/api/data/leftovers?scope=family');
  const b = r.body; const rows = Array.isArray(b) ? b : (b.items || b.rows || b.data || []);
  return rows.filter(x => x.value && x.key.startsWith('item:')).map(x => x.value.name);
};
const out = { note: 'typical seed, demo clock, webkit', arms: {} };
async function arm(name, device, pick, how, gap) {
  await L.reset('typical');
  const d = await L.device({ device, profile: 'eli' });
  await d.goto('#home');
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => document.querySelectorAll('.item .done').length > 0, null, { timeout: 15000 });
  await sleep(800);
  const layout = await f.evaluate(() => [...document.querySelectorAll('.item')].map(c => ({ name: c.querySelector('.nm').textContent, group: c.closest('.group').dataset.tone })));
  const target = pick(layout);
  const serverBefore = await live();
  const btn = f.locator('.item', { has: f.locator('.nm', { hasText: target }) }).locator('.done');
  const box = await btn.boundingBox();                      // page coordinates (frame offset included)
  const fb = await (await f.frameElement()).boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const under = () => f.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const b = el && el.closest('button.done'); const c = el && el.closest('.item'); return { onDoneButton: !!b, card: c ? c.querySelector('.nm').textContent : null }; }, [x - fb.x, y - fb.y]);
  const underBefore = await under();
  let underAfterFirst = null;
  if (how === 'touch') {
    await d.page.touchscreen.tap(x, y);
    underAfterFirst = await under();
    if (gap) { await sleep(gap); await d.page.touchscreen.tap(x, y); }
  } else {
    await d.page.mouse.dblclick(x, y);
  }
  await sleep(4000);                                          // let hub.js flush its queue
  const ui = await f.evaluate(() => [...document.querySelectorAll('.item .nm')].map(n => n.textContent));
  const serverAfter = await live();
  const act = JSON.stringify((await L.apiAs('eli', '/api/activity')).body);
  const finished = act.match(/Finished the [^"\\]+/g) || [];
  const undo = await f.evaluate(() => !!document.querySelector('[class*=undo], .toast, [role=alert] button'));
  const png = `verify-double-tap-removes-next-item-1-${name}-${device}.png`;
  await d.page.screenshot({ path: path.join(EVID, png), scale: 'css', animations: 'disabled', caret: 'hide' });
  const r = { device, how, gapMs: gap, target, group: layout.find(l => l.name === target).group, orderBefore: layout.map(l => l.name),
    underPointBefore: underBefore, underPointAfterFirstTap: underAfterFirst,
    removedUI: layout.map(l => l.name).filter(n => !ui.includes(n)), removedOnServer: serverBefore.filter(n => !serverAfter.includes(n)),
    finishedFeedLines: finished, undoOffered: undo, shot: 'audits/evidence/p3/leftovers/' + png };
  out.arms[name] = r;
  console.log(name, JSON.stringify({ target, underAfterFirst, removedUI: r.removedUI, removedOnServer: r.removedOnServer, finished, undo }));
  await d.close();
}
try {
  const firstFresh = l => l.find(x => x.group === 'fresh' && l.filter(y => y.group === 'fresh').length > 1)?.name || l[0].name;
  await arm('CTRL', 'iphone-pwa', firstFresh, 'touch', 0);
  await arm('T250', 'iphone-pwa', firstFresh, 'touch', 250);
  await arm('T350', 'iphone-pwa', firstFresh, 'touch', 350);
  await arm('DBL', 'desktop', firstFresh, 'dblclick', 0);
  await arm('LAST', 'iphone-pwa', l => { const g = l[0].group; const rows = l.filter(x => x.group === g); return rows[rows.length - 1].name; }, 'touch', 250);
  fs.writeFileSync(path.join(EVID, 'verify-double-tap-removes-next-item-1.json'), JSON.stringify(out, null, 1));
  console.log('saved audits/evidence/p3/leftovers/verify-double-tap-removes-next-item-1.json');
} finally { await L.close(); }
