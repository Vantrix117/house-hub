// Skeptic 2 for SHAPE "prayer-undo-target": drive the REAL Mark answered flow (no hand-called toast()) and measure
// #toastAct, in WebKit and Chromium (fonts differ; the box is font-size 14px x line-height 1.55, padding 0:
// apps/prayer.html:46, 260-261). Also probes whether a tap 8/16 px above/below the word still lands on the button
// (elementFromPoint), and measures the rotation chips (#p-rot .chip, min-height 44px at :187).
// Run: node "audits/tools/phase4/SHAPE/verify-prayer-undo-target-2.mjs" -> audits/evidence/p4/SHAPE/verify-prayer-undo-target-2.json (+ .png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p4/SHAPE';
const res = {};
async function one(engine, device, shot) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  try {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(800);
    const id = await f.evaluate(() => { const b = document.querySelector('#todayList [data-open]'); return b && b.dataset.open; });
    await f.click(`#todayList [data-open="${id}"]`); await sleep(400);
    await f.click(`[data-answer="${id}"]`); await sleep(200);
    await f.fill('#askIn', 'Answered this week.'); await f.click('#askSave'); await sleep(700);
    const m = await f.evaluate(() => {
      const b = document.getElementById('toastAct'), t = document.getElementById('toast');
      const r = b.getBoundingClientRect(), tr = t.getBoundingClientRect(), cs = getComputedStyle(b);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = dy => { const e = document.elementFromPoint(cx, cy + dy); return e === b ? 'button' : (e ? (e.id || e.tagName) : null); };
      return { text: b.textContent, toastOn: t.classList.contains('on'), toastMsg: document.getElementById('toastMsg').textContent,
        w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, padding: cs.padding, fontSize: cs.fontSize, lineHeight: cs.lineHeight,
        fontFamily: cs.fontFamily.slice(0, 80), minHeight: cs.minHeight, toastH: Math.round(tr.height), toastW: Math.round(tr.width),
        hitCentre: hit(0), hitUp8: hit(-8), hitDown8: hit(8), hitUp14: hit(-14), hitDown14: hit(14) };
    });
    if (shot) {
      const bb = await (await f.$('#toast')).boundingBox();
      await d.page.screenshot({ path: `${OUT}/verify-prayer-undo-target-2.png`, clip: { x: Math.max(0, bb.x - 20), y: Math.max(0, bb.y - 60), width: bb.width + 40, height: bb.height + 120 }, scale: 'css' });
    }
    await f.click('#toastAct'); await sleep(900);
    m.afterUndo = await f.evaluate(i => { const all = [...D.lists.personal.prayers, ...D.lists.shared.prayers]; const p = all.find(x => x.id === i); return p && p.status; }, id);
    await d.close();
    return { id, ...m };
  } finally { await L.close(); }
}
try {
  res['webkit/iphone-pwa'] = await one('webkit', 'iphone-pwa', true);
  res['webkit/ipad-portrait'] = await one('webkit', 'ipad-portrait', false);
  res['chromium/iphone-pwa'] = await one('chromium', 'iphone-pwa', false);
} catch (e) { console.error(e); res.error = String(e.stack || e); }
fs.writeFileSync(`${OUT}/verify-prayer-undo-target-2.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
