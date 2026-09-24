// Tally layout, type and targets inside the shell viewer, every device x {eli, ezra} x {light, dark}.
// Measures: frame viewport, rects of the pill/dial/count/-/+/Reset, computed type, overlap of the pill with the dial,
// whether anything is cut off above/below the frame (body is a centred grid of height 100%: tally.html:11, 22).
// Run: node "audits/tools/phase3/tally/layout.mjs"  -> audits/evidence/p3/tally/layout.json (+ a few PNGs)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const L = await local({ variant: process.argv[2] || 'typical', clock: 'demo', engine: 'webkit' });
const rows = [];
try {
  for (const device of ['ipad-portrait', 'ipad-landscape', 'iphone-pwa', 'iphone-safari', 'desktop']) {
    for (const profile of ['eli', 'ezra']) {
      for (const mode of ['light', 'dark']) {
        const d = await L.device({ device, profile, mode });
        const f = await d.openApp('tally', { wait: '.dial' });
        await f.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 8000 });
        await sleep(400);
        const m = await f.evaluate(() => {
          const R = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), r: Math.round(r.right) }; };
          const cs = s => { const c = getComputedStyle(document.querySelector(s)); return { fs: parseFloat(c.fontSize), fw: c.fontWeight, ff: c.fontFamily.split(',')[0].trim(), ffFull: c.fontFamily, tt: c.textTransform, ls: c.letterSpacing }; };
          const who = R('#who'), dial = R('.dial');
          // glyph box of the count text
          const n = document.getElementById('n'); const rg = document.createRange(); rg.selectNodeContents(n); const gr = rg.getBoundingClientRect();
          return {
            vw: innerWidth, vh: innerHeight, scrollH: document.documentElement.scrollHeight, bodyScrollTop: document.scrollingElement.scrollTop,
            kind: document.documentElement.dataset.kind || null, scheme: document.documentElement.dataset.scheme,
            who, dial, plus: R('#plus'), minus: R('#minus'), reset: R('#reset'), main: R('main'), art: R('.art'),
            count: { ...cs('#n'), text: n.textContent, glyphH: Math.round(gr.height) },
            whoType: cs('#who'), resetType: cs('#reset'), plusType: cs('#plus'), minusType: cs('#minus'),
            pillOverlapsDial: who && dial ? Math.max(0, who.b - dial.y) : null,
            cutTop: Math.max(0, -Math.min(dial.y, who.y)), cutBottom: Math.max(0, R('#reset').b - innerHeight),
            accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
          };
        });
        rows.push({ device, profile, mode, ...m });
        console.log(device, profile, mode, `frame ${m.vw}x${m.vh}`, `dial ${m.dial.w}@y${m.dial.y}`, `+ ${m.plus.w}x${m.plus.h}`, `- ${m.minus.w}x${m.minus.h}`, `reset ${m.reset.w}x${m.reset.h}@b${m.reset.b}`, `pill ${m.who.h}h@b${m.who.b}`, `overlap ${m.pillOverlapsDial}`, `cutTop ${m.cutTop} cutBottom ${m.cutBottom}`, `count ${m.count.fs}px ${m.count.ff} glyph ${m.count.glyphH}`, `who ${m.whoType.fs}px ${m.whoType.fw} ${m.whoType.tt}`, `reset ${m.resetType.fs}px`, `+glyph ${m.plusType.fs}px w${m.plusType.fw}`);
        if (mode === 'light' && ((profile === 'ezra' && (device === 'ipad-landscape' || device === 'iphone-safari')) || (device === 'iphone-pwa'))) {
          await d.page.screenshot({ path: `${OUT}/layout-${process.argv[2] || 'typical'}-${profile}-${device}-${mode}.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
        }
        await d.close();
      }
    }
  }
} finally {
  fs.writeFileSync(`${OUT}/layout${process.argv[2] ? '-' + process.argv[2] : ''}.json`, JSON.stringify(rows, null, 1));
  await L.close();
}
