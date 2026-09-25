// Completeness critic probe: P4-TELL-01 walked up to 14 Tab stops per area and found every `.ds .btn` unringed.
// This walks every Tab stop on the shell's Me, Apps and picker screens (desktop, Chromium, real Tab key presses) and
// reports, per stop, whether :focus-visible changes the computed box-shadow or outline, and how many pixels change.
// Usage: node audits/tools/phase4/CRITIC/focus-other-components.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const L = await local({ variant: 'typical', engine: 'chromium' });
const out = [];
const diff = (a, b) => { let n = 0; const len = Math.min(a.length, b.length); for (let i = 0; i < len; i++) if (a[i] !== b[i]) n++; return n + Math.abs(a.length - b.length); };
try {
  for (const [hash, profile] of [['#me', 'eli'], ['#apps', 'eli'], ['', null]]) {
    const d = await L.device({ device: 'desktop', profile, mode: 'light' });
    await d.goto(hash); await sleep(2500);
    await d.page.mouse.click(5, 5);
    const seen = new Set();
    for (let i = 0; i < 90; i++) {
      await d.page.keyboard.press('Tab'); await sleep(120);
      const info = await d.page.evaluate(() => {
        const e = document.activeElement; if (!e || e === document.body) return null;
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        const key = e.tagName + '#' + e.id + '.' + [...e.classList].join('.') + '@' + Math.round(r.x) + ',' + Math.round(r.y);
        return { key, tag: e.tagName, id: e.id, cls: e.className && e.className.baseVal === undefined ? e.className : '', text: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30),
          fv: e.matches(':focus-visible'), shadow: cs.boxShadow, outline: cs.outlineStyle + ' ' + cs.outlineWidth, r: { x: r.x, y: r.y, w: r.width, h: r.height } };
      });
      if (!info || seen.has(info.key)) { if (info) break; continue; }
      seen.add(info.key);
      if (info.r.w < 1 || info.r.y > 900 || info.r.y + info.r.h < 0) { out.push({ screen: hash || 'picker', ...info, skipped: 'offscreen' }); continue; }
      const clip = { x: Math.max(0, info.r.x - 8), y: Math.max(0, info.r.y - 8), width: Math.min(1440, info.r.w + 16), height: Math.min(900, info.r.h + 16) };
      const a = await d.page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
      const after = await d.page.evaluate(() => { const e = document.activeElement; const s = { shadow: getComputedStyle(e).boxShadow, outline: getComputedStyle(e).outlineStyle }; e.blur(); const c = getComputedStyle(e); return { ...s, shadowBlur: c.boxShadow, outlineBlur: c.outlineStyle + ' ' + c.outlineWidth }; });
      await sleep(60);
      const b = await d.page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
      out.push({ screen: hash || 'picker', key: info.key, text: info.text, fv: info.fv, styleChanged: info.shadow !== after.shadowBlur || info.outline !== after.outlineBlur, shadowFocused: info.shadow.slice(0, 80), shadowBlurred: after.shadowBlur.slice(0, 80), pixelsIdentical: a.equals(b) });
    }
    await d.close();
  }
} finally { await L.close(); }
for (const o of out) console.log(JSON.stringify(o));
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/CRITIC/focus-other-components.json'), JSON.stringify(out, null, 1));
