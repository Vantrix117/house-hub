// Batch 3 copy of audits/tools/phase4/SHAPE/verify-prayer-undo-target-2.mjs (P4-SHAPE-02, VIS-SHAPE-4).
// What changed on purpose: Prayer's toast is now the shared hub.toast, so the action is `#hub-toast .toast-act` (a 44 px
// button in the .ds toast) and not `#toastAct` (the page's old element, which stays in the markup, never shown). The flow
// is the same REAL Mark answered flow; it also reads the toast's width against its message (VIS-SHAPE-4: one line on the
// iPhone) and checks the toast clears the nav and the +.
// Run: node "audits/tools/phase6/3/verify-prayer-undo-target-3.mjs" -> audits/evidence/p6/3/verify-prayer-undo-target-3.json (+ .png)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/3';
fs.mkdirSync(OUT, { recursive: true });
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
      const t = document.getElementById('hub-toast'), b = t && t.querySelector('.toast-act');
      if (!t || !b) return { missing: true, old: !!document.querySelector('#toast.on') };
      const r = b.getBoundingClientRect(), tr = t.getBoundingClientRect(), cs = getComputedStyle(b), ts = getComputedStyle(t);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = dy => { const e = document.elementFromPoint(cx, cy + dy); return e === b ? 'button' : (e ? (e.id || e.className || e.tagName) : null); };
      const nav = document.querySelector('nav'), fab = document.getElementById('fab');
      const nr = nav.getBoundingClientRect(), fr = fab.getBoundingClientRect(), fabOn = getComputedStyle(fab).display !== 'none';
      const lineH = parseFloat(ts.lineHeight) || parseFloat(ts.fontSize) * 1.3;
      return { text: b.textContent, shown: !t.hidden, toastMsg: t.firstChild && t.firstChild.textContent,
        w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, padding: cs.padding, fontSize: cs.fontSize, minHeight: cs.minHeight,
        toastH: Math.round(tr.height), toastW: Math.round(tr.width), toastBottom: Math.round(tr.bottom), vw: innerWidth,
        oneLine: tr.height <= parseFloat(ts.paddingTop) + parseFloat(ts.paddingBottom) + Math.max(lineH, 44) + 4,
        clearsNav: tr.bottom <= nr.top, clearsFab: !fabOn || tr.bottom <= fr.top || tr.right <= fr.left,
        oldToastShown: getComputedStyle(document.getElementById('toast')).display !== 'none',
        hitCentre: hit(0), hitUp8: hit(-8), hitDown8: hit(8), hitUp14: hit(-14), hitDown14: hit(14) };
    });
    if (shot && !m.missing) {
      const bb = await (await f.$('#hub-toast')).boundingBox();
      await d.page.screenshot({ path: `${OUT}/verify-prayer-undo-target-3.png`, clip: { x: Math.max(0, bb.x - 20), y: Math.max(0, bb.y - 60), width: bb.width + 40, height: bb.height + 120 }, scale: 'css' });
    }
    if (!m.missing) { await f.click('#hub-toast .toast-act'); await sleep(900); }
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
const all = Object.entries(res).filter(([k]) => k !== 'error');
const pass = all.length === 3 && all.every(([, v]) => !v.missing && v.h >= 44 && v.w >= 44 && v.hitCentre === 'button' && v.oneLine && v.clearsNav && v.clearsFab && !v.oldToastShown && v.afterUndo === 'active');
res.verdict = pass ? 'PASS: the action is >= 44 x 44, the toast is one line, clears the nav and the +, and Undo puts the request back' : 'FAIL';
fs.writeFileSync(`${OUT}/verify-prayer-undo-target-3.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
process.exit(pass ? 0 : 1);
