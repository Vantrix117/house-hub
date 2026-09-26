// UX-TALLY-1 skeptic s2: Reset to zero as a kid (Ezra, Kitchen iPad portrait) and as an adult (Eli, iPhone).
// Records: geometry of + and Reset, the gap, what elementFromPoint hits in the band between them, dialogs/toast after
// Reset, whether anything (cache, queue, server) still holds the old value, and whether Kiara also sees the app.
// Run: node "audits/tools/phase5/ux-verify/UX-TALLY-1/s2-reset.mjs" -> audits/evidence/p5/ux-verify/UX-TALLY-1/s2/
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = 'audits/evidence/p5/ux-verify/UX-TALLY-1/s2';
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async p => { const r = await L.apiAs(p, '/api/data/tally?scope=person'); const it = ((r.body && r.body.items) || []).find(i => i.key === 'count'); return it ? it.value : null; };
const ready = f => f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0 && typeof document.getElementById('reset').onclick === 'function', null, { timeout: 12000 });
try {
  for (const [profile, device] of [['ezra', 'ipad-portrait'], ['kiara', 'ipad-portrait'], ['eli', 'iphone-pwa']]) {
    const d = await L.device({ device, profile, fixedTime: false });
    const dialogs = []; d.page.on('dialog', dg => { dialogs.push(dg.message()); dg.dismiss(); });
    let f;
    try { f = await d.openApp('tally'); await ready(f); } catch (e) { res[profile] = { device, opened: false, err: String(e).slice(0, 200) }; await d.close(); continue; }
    await sleep(800);
    const before = { ui: await f.evaluate(() => document.getElementById('n').textContent), server: await server(profile) };
    const geo = await f.evaluate(() => {
      const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom), r: Math.round(b.right) }; };
      const cs = id => { const s = getComputedStyle(document.getElementById(id)); return { bg: s.backgroundImage.slice(0, 80), bgc: s.backgroundColor, radius: s.borderRadius, color: s.color }; };
      const plus = r('plus'), reset = r('reset');
      // hit test a grid in the band from 0 to 40 px below the bottom of +, across the + column
      const hits = [];
      for (let dy = 0; dy <= 40; dy += 4) for (let x = plus.x; x <= plus.r; x += 8) { const el = document.elementFromPoint(x, plus.b + dy); hits.push({ dy, x, id: el && el.id }); }
      const byDy = {};
      for (const h of hits) { byDy[h.dy] ||= {}; byDy[h.dy][h.id || '(none)'] = (byDy[h.dy][h.id || '(none)'] || 0) + 1; }
      return { plus: r('plus'), minus: r('minus'), reset, gapPlusToReset: reset.y - plus.b, horizontalOverlap: Math.max(0, Math.min(plus.r, reset.r) - Math.max(plus.x, reset.x)), styles: { plus: cs('plus'), reset: cs('reset') }, kind: document.documentElement.dataset.kind, hitsBelowPlus: byDy, resetAria: document.getElementById('reset').getAttribute('aria-label'), resetHasIcon: !!document.getElementById('reset').querySelector('svg,img') };
    });
    if (profile === 'eli' || profile === 'ezra') {
      await d.page.screenshot({ path: `${OUT}/${profile}-before-reset.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
      await f.locator('#reset').click();
      await sleep(300);
      const toast = await d.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
      const toastInFrame = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
      await sleep(1500);
      const after = {
        ui: await f.evaluate(() => document.getElementById('n').textContent),
        server: await server(profile),
        dialogs, toast, toastInFrame,
        undoControl: await f.evaluate(() => [...document.querySelectorAll('button,[role=button],a')].map(b => (b.textContent || b.getAttribute('aria-label') || '').trim()).filter(t => /undo/i.test(t))),
        // does any local copy still hold the old value?
        localCopies: await f.evaluate(() => Object.keys(localStorage).filter(k => k.includes('tally')).map(k => [k, localStorage.getItem(k).slice(0, 300)])),
      };
      await d.page.screenshot({ path: `${OUT}/${profile}-after-reset.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
      res[profile] = { device, opened: true, before, geo, after };
    } else {
      res[profile] = { device, opened: true, before, geo };
    }
    console.log(profile, JSON.stringify(res[profile]).slice(0, 1500));
    await d.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/reset.json`, JSON.stringify(res, null, 1));
  await L.close();
}
