// s1 skeptic check for UX-TALLY-1: Ezra (kid) on the Kitchen iPad and an iPhone — geometry of + vs Reset,
// then + x5 and one Reset tap: server value before/after, dialogs, toast, any undo control, any history key left.
// Run: node audits/tools/phase5/ux-verify/UX-TALLY-1/s1-reset.mjs -> audits/evidence/p5/ux-verify/UX-TALLY-1/s1/
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = 'audits/evidence/p5/ux-verify/UX-TALLY-1/s1';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const server = async p => { const r = await L.apiAs(p, '/api/data/tally?scope=person'); return ((r.body && r.body.items) || []).map(i => ({ key: i.key, value: i.value })); };
try {
  for (const device of ['ipad-portrait', 'iphone-pwa']) {
    const d = await L.device({ device, profile: 'ezra', fixedTime: false });
    const dialogs = []; d.page.on('dialog', dg => { dialogs.push(dg.message()); dg.dismiss(); });
    const f = await d.openApp('tally', { wait: '.dial' });
    await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 12000 });
    await sleep(800);
    const geo = await f.evaluate(() => {
      const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom), r: Math.round(b.right) }; };
      const cs = id => { const s = getComputedStyle(document.getElementById(id)); return { bg: s.backgroundColor, bgImg: s.backgroundImage.slice(0, 80), color: s.color, radius: s.borderRadius }; };
      return { kind: document.documentElement.dataset.kind, plus: r('plus'), minus: r('minus'), reset: r('reset'), styles: { plus: cs('plus'), reset: cs('reset') }, resetHasIcon: !!document.querySelector('#reset svg,#reset img') };
    });
    geo.gapPlusToReset = geo.reset.y - geo.plus.b;
    geo.horizontalOverlap = Math.max(0, Math.min(geo.plus.r, geo.reset.r) - Math.max(geo.plus.x, geo.reset.x));
    for (let i = 0; i < 5; i++) await f.locator('#plus').click();
    await sleep(1500);
    const before = { ui: await f.evaluate(() => document.getElementById('n').textContent), server: await server('ezra') };
    await f.locator('#reset').click();
    await sleep(300);
    const toastSoon = await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
    const shellToast = await d.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
    await sleep(1500);
    const after = { ui: await f.evaluate(() => document.getElementById('n').textContent), server: await server('ezra') };
    const undo = await f.evaluate(() => [...document.querySelectorAll('button,[role=button],a')].map(b => b.textContent.trim()).filter(t => /undo/i.test(t)));
    await d.page.screenshot({ path: `${OUT}/${device}-after-reset.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    res[device] = { geo, before, after, dialogs, toastSoon, shellToast, undo };
    console.log(device, JSON.stringify(res[device]));
    await d.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/reset.json`, JSON.stringify(res, null, 1));
  await L.close();
}
