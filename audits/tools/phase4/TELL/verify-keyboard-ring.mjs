// TELL / verify-keyboard-ring: pixel proof for the keyboard-focus result of tells-chromium.mjs. For one .ds button per
// area (and one non-.ds control as a control group), Tab until it is focused, screenshot its box + 10 px, blur it,
// screenshot again, and count the pixels that changed. 0 changed pixels = no visible focus indicator.
//   node audits/tools/phase4/TELL/verify-keyboard-ring.mjs   → audits/evidence/p4/TELL/keyboard-ring.json + keyboard-<area>.png
// Chromium, desktop 1440x900, light, System. The PNG is the focused crop above the blurred crop.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';
import { openArea, profileFor, deviceFor } from './areas.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const TARGETS = [
  ['shell', '.gcard .btn'], ['tv', '#kiosk-switch'], ['tally', '#reset'], ['timer', '#go'], ['kidverse', '#done'], ['verses', '#show'],
  ['f260', '#tabPlan'], ['prayer', '#listSwitch button'], ['tally', '#plus'],   // non-.ds rules (control group)
];
const L = await local({ variant: 'typical', engine: 'chromium' });
const dec = await L.browser.newPage();
const out = { note: 'See the header of audits/tools/phase4/TELL/verify-keyboard-ring.mjs.', results: [] };
try {
  for (const [area, sel] of TARGETS) {
    const R = { area, sel };
    try {
      const d = await L.device({ device: deviceFor(area, 'desktop'), mode: 'light', profile: profileFor(area) });
      const { doc, frameEl } = await openArea(d, area, { settle: 1500 });
      if (frameEl) await doc.evaluate(() => window.focus());
      let hit = false;
      for (let i = 0; i < 40 && !hit; i++) { await d.page.keyboard.press('Tab'); await sleep(60); hit = await doc.evaluate(s => document.activeElement === document.querySelector(s), sel).catch(() => false); }
      R.reachedByTab = hit;
      if (!hit) await doc.evaluate(s => document.querySelector(s).focus(), sel);   // fall back to script focus (still :focus-visible in Chromium)
      await sleep(350);   // let transitions settle
      const info = await doc.evaluate(s => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { fv: e.matches(':focus-visible'), rect: [r.x, r.y, r.width, r.height], shadow: c.boxShadow.slice(0, 120), outline: c.outlineStyle + ' ' + c.outlineWidth }; }, sel);
      const off = frameEl ? await frameEl.boundingBox() : { x: 0, y: 0 };
      const clip = { x: Math.max(0, off.x + info.rect[0] - 10), y: Math.max(0, off.y + info.rect[1] - 10), width: info.rect[2] + 20, height: info.rect[3] + 20 };
      const a = await d.page.screenshot({ clip, scale: 'css' });
      await doc.evaluate(s => document.querySelector(s).blur(), sel); await sleep(350);
      const b = await d.page.screenshot({ clip, scale: 'css' });
      const diff = await dec.evaluate(async ([a, b]) => {
        const load = async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); return im; };
        const A = await load(a), B = await load(b); const c = document.createElement('canvas'); c.width = A.width; c.height = A.height * 2 + 4; const g = c.getContext('2d');
        g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, A.width, A.height).data; g.drawImage(B, 0, A.height + 4); const db = g.getImageData(0, A.height + 4, A.width, A.height).data;
        let n = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) n++;
        return { changed: n, total: da.length / 4, png: c.toDataURL('image/png').split(',')[1] };
      }, [a.toString('base64'), b.toString('base64')]);
      Object.assign(R, { focusVisible: info.fv, shadow: info.shadow, outline: info.outline, changedPx: diff.changed, totalPx: diff.total });
      const f = path.join(EV, `keyboard-${area}-${sel.replace(/[^a-z0-9]+/gi, '_')}.png`); fs.writeFileSync(f, Buffer.from(diff.png, 'base64')); R.shot = path.relative(ROOT, f).replace(/\\/g, '/');
      await d.close();
    } catch (e) { R.error = String(e.message || e).split('\n')[0]; }
    out.results.push(R);
    console.log(area, sel, JSON.stringify({ tab: R.reachedByTab, fv: R.focusVisible, changed: R.changedPx, of: R.totalPx, err: R.error }));
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EV, 'keyboard-ring.json'), JSON.stringify(out, null, 1));
