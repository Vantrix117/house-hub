// Skeptic #1 for critic-remote-change-rerender-shifts-tap-1: does a remote change (another device finishing an item)
// re-render the open Larder under a pending tap so that the tap removes a DIFFERENT item?
// Typical seed, WebKit, iPhone PWA as Eli. Arms (each on a fresh reset):
//   CTRL : no remote change; tap the target's ✓            -> expect the target removed (sanity).
//   B    : investigator's arm: Mom finishes "Beef and bean chili", Eli aims at "Roasted sweet potatoes".
//   SAME : chosen from the DOM: a group with >= 3 cards; Mom finishes card[0], Eli aims at card[1]'s ✓;
//          after the pull the point should sit exactly on card[2]'s ✓ (no touch adjustment needed).
//   SAMEMOUSE: as SAME but a mouse click instead of a touch tap (iPad with pointer / desktop).
// A capture-phase click listener in the frame records which ✓ actually received the click.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
const EV = path.resolve('audits/evidence/p3/leftovers'); fs.mkdirSync(EV, { recursive: true });
const PFX = 'verify-critic-remote-change-rerender-shifts-tap-1-1';
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
  for (const arm of ['CTRL', 'B', 'SAME', 'SAMEMOUSE']) {
    await L.reset('typical');
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
    try {
      await d.goto('#home');
      const f = await d.openApp('leftovers');
      await f.waitForSelector('.item .done', { timeout: 20000 }); await sleep(1500);
      const groups = await f.evaluate(() => [...document.querySelectorAll('section.group')].map(g => ({ tone: g.dataset.tone, items: [...g.querySelectorAll('.item .nm')].map(n => n.textContent) })));
      let remoteFinish = null, target;
      if (arm === 'CTRL') target = 'Roasted sweet potatoes';
      else if (arm === 'B') { remoteFinish = 'Beef and bean chili'; target = 'Roasted sweet potatoes'; }
      else { const g = groups.find(g => g.items.length >= 3); remoteFinish = g.items[0]; target = g.items[1]; }
      await f.evaluate(() => { window.__clicked = []; document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.done'); window.__clicked.push(b ? b.getAttribute('aria-label') : (e.target.className || e.target.tagName)); }, true); });
      const btn = await f.$(`.item:has(.nm:text-is("${target}")) .done`);
      await btn.scrollIntoViewIfNeeded();
      const box = await btn.boundingBox(); const fr = await (await f.frameElement()).boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      const before = await under(f, x - fr.x, y - fr.y);
      const srv0 = await live(L);
      let put = null;
      if (remoteFinish) {
        const row = srv0.find(r => r.name === remoteFinish);
        put = (await L.apiAs('mom', '/api/data/leftovers/' + encodeURIComponent(row.key) + '?scope=family', { method: 'PUT', body: { value: null, updated_at: Date.now() } })).status;
        await f.evaluate(() => hub.pull());
        await sleep(400);
      }
      const after = await under(f, x - fr.x, y - fr.y);
      if (arm === 'SAMEMOUSE') await d.page.mouse.click(x, y); else await d.page.touchscreen.tap(x, y);
      await sleep(4000);
      const clicked = await f.evaluate(() => window.__clicked);
      const srv1 = await live(L);
      const removedByEli = srv0.filter(r => r.name !== remoteFinish && !srv1.some(s => s.key === r.key)).map(r => r.name);
      const png = `${PFX}-${arm}-iphone.png`;
      await d.page.screenshot({ path: path.join(EV, png), scale: 'css' });
      out[arm] = { groups, remoteFinishByMom: remoteFinish, putStatus: put, eliAimedAt: target, underBeforePull: before, underAfterPull: after, clickReceivedBy: clicked, removedByEliTap: removedByEli, targetStillOnServer: srv1.some(s => s.name === target), shot: 'audits/evidence/p3/leftovers/' + png };
      console.log(arm, JSON.stringify({ ...out[arm], groups: undefined }));
    } finally { await d.close(); }
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, PFX + '.json'), JSON.stringify(out, null, 1));
console.log('saved audits/evidence/p3/leftovers/' + PFX + '.json');
