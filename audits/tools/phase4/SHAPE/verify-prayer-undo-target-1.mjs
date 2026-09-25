// Skeptic 1 for P4 SHAPE "prayer-undo-target": drive the REAL Mark answered flow through the UI (tap a request,
// tap Mark answered, type a note, tap the Save button) on iPhone PWA and iPad portrait, light and dark, then measure the
// toast's action button (#toastAct), its hit area (elementFromPoint 12 px outside its box), and the rotation chips.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/SHAPE');
const out = { runs: [] };
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const [device, mode] of [['iphone-pwa', 'light'], ['ipad-portrait', 'light'], ['iphone-pwa', 'dark']]) {
    const d = await L.device({ device, mode, profile: 'eli' });
    const fr = await d.openApp('prayer'); await sleep(3000);
    const run = { device, mode };
    try {
      // open the first request on Today (or List)
      let opener = fr.locator('[data-open]').first();
      if (!(await opener.count())) { await fr.locator('[data-go="all"]').first().click().catch(() => {}); await sleep(800); opener = fr.locator('[data-open]').first(); }
      run.openedTitle = (await opener.innerText().catch(() => '')).slice(0, 60);
      await opener.click(); await sleep(900);
      await fr.locator('#sheet [data-answer]').first().click(); await sleep(500);
      await fr.locator('#askIn').fill('Verified by skeptic 1'); await fr.locator('#askSave').click();
      await sleep(700);
      run.m = await fr.evaluate(() => {
        const b = document.querySelector('#toastAct'), t = document.querySelector('#toast');
        const bb = b.getBoundingClientRect(), tb = t.getBoundingClientRect(), s = getComputedStyle(b);
        const cx = bb.left + bb.width / 2, cy = bb.top + bb.height / 2;
        const hit = (x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.id || e.tagName.toLowerCase()) : null; };
        return {
          toastOn: t.classList.contains('on'), msg: document.querySelector('#toastMsg').textContent, act: b.textContent,
          undo: { w: +bb.width.toFixed(1), h: +bb.height.toFixed(1), padding: s.padding, fontSize: s.fontSize, minH: s.minHeight, minW: s.minWidth },
          toast: { w: +tb.width.toFixed(1), h: +tb.height.toFixed(1), padding: getComputedStyle(t).padding },
          hitCentre: hit(cx, cy), hitAbove6: hit(cx, bb.top - 6), hitBelow6: hit(cx, bb.bottom + 6), hitLeft6: hit(bb.left - 6, cy), hitRight6: hit(bb.right + 6, cy),
          cssPx: devicePixelRatio,
        };
      });
      const box = await fr.locator('#toast').boundingBox().catch(() => null);
      const vp = d.page.viewportSize();
      if (box && device === 'iphone-pwa' && mode === 'light') await d.page.screenshot({ path: path.join(EV, 'verify-prayer-undo-target-1-iphone.png'), scale: 'css', clip: { x: Math.max(0, box.x - 16), y: Math.max(0, box.y - 16), width: Math.min(vp.width - Math.max(0, box.x - 16), box.width + 32), height: box.height + 32 } });
      // rotation chips: render a copy with the app's own .chip class inside the app's .chips container style
      run.chips = await fr.evaluate(() => {
        const wrap = document.createElement('div'); wrap.className = 'chips'; wrap.id = 'p-rot-probe';
        wrap.innerHTML = [2, 3, 4, 5, 6, 8].map(n => '<button class="chip">' + n + '</button>').join('');
        (document.querySelector('main') || document.body).appendChild(wrap);
        const r = [...wrap.children].map(c => { const b = c.getBoundingClientRect(); return [+b.width.toFixed(1), +b.height.toFixed(1)]; });
        wrap.remove(); return r;
      });
    } catch (e) { run.error = e.message; }
    out.runs.push(run); console.log(JSON.stringify(run));
    await d.close();
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'verify-prayer-undo-target-1.json'), JSON.stringify(out, null, 1));
console.log('wrote verify-prayer-undo-target-1.json');
