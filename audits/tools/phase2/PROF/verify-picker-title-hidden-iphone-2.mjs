// PROF skeptic #2 for finding "picker-title-hidden-iphone": does the signed-out profile picker open with its title
// ("Anderson House" h1 + "Who's this?") above the top edge on iPhone sizes, and is that the seed (a guest = 9th card) or
// the rig (fixed 430-wide device list) rather than the app?
//
//   node "audits/tools/phase2/PROF/verify-picker-title-hidden-iphone-2.mjs"
//
// For each engine (webkit, chromium) × variant (empty = the 8 household profiles, typical = + 1 guest, overflow = + 4
// guests, long names) × viewport (430×932 iphone-pwa, 430×740 iphone-safari, 390×844 a 6.1" iPhone as a Home Screen app,
// 390×664 the same in a Safari tab) it prints: #gate scrollTop at open, the h1 and "Who's this?" top/bottom (px from the
// viewport top), the gate's content overflow, and the lowest scrollTop reachable programmatically (-10000 → clamped).
// "last" profile is set to eli, as after a real Switch (the picker then focuses that card).
// Evidence: audits/evidence/p2/PROF/verify-picker-title-2-*.png (1× css) and verify-picker-title-2.json.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const VIEWS = [
  { name: 'iphone-pwa', device: 'iphone-pwa' },
  { name: 'iphone-safari', device: 'iphone-safari' },
  { name: '390x844-pwa', device: 'iphone-pwa', size: { width: 390, height: 844 } },
  { name: '390x664-safari', device: 'iphone-safari', size: { width: 390, height: 664 } },
];
const rows = [];
for (const engine of ['webkit', 'chromium']) {
  for (const variant of ['empty', 'typical', 'overflow']) {
    const L = await local({ variant, clock: 'real', engine });
    try {
      for (const v of VIEWS) {
        // profile 'eli' then sign out through the shell's own path (Switch → showPicker) is what a family member sees;
        // here: seed the device as paired + last = eli, with no session, by passing profile null and a hub.lastProfile key.
        const d = await L.device({ device: v.device, profile: null, fixedTime: false, localStorage: { 'hub.lastProfile': JSON.stringify('eli') } });
        if (v.size) await d.page.setViewportSize(v.size);
        await d.goto('');
        await d.page.waitForSelector('#profiles .pcard[data-id]');
        await sleep(900);   // pop-in / stagger animations settle
        const m = await d.page.evaluate(() => {
          const g = document.getElementById('gate');
          const h1 = document.querySelector('.gate-title h1'), p = document.querySelector('.gate-title p');
          const r = el => { const b = el.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
          const snap = () => ({ scrollTop: g.scrollTop, h1: r(h1), who: r(p) });
          const cards = document.querySelectorAll('#profiles .pcard[data-id]').length;
          const cs = getComputedStyle(g);
          const open = snap();
          const inner = g.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
          const panelH = Math.round(document.getElementById('gate-panel').getBoundingClientRect().height);
          g.scrollTop = -10000; const up = snap();
          g.scrollTop = 0;
          return { cards, vh: innerHeight, vw: innerWidth, clientH: g.clientHeight, scrollH: g.scrollHeight, padTop: cs.paddingTop, panelH, overflow: panelH - inner, open, up, focused: document.activeElement && document.activeElement.dataset.id };
        });
        const row = { engine, variant, view: v.name, ...m };
        rows.push(row);
        const hidden = m.open.h1[0] < 0 ? (m.open.who[0] < 0 ? 'h1 + "Who\'s this?" start above the top' : 'h1 starts above the top') : 'title fully in view';
        console.log(`${engine.padEnd(8)} ${variant.padEnd(8)} ${v.name.padEnd(15)} ${m.vw}x${m.vh} cards ${m.cards} panel ${m.panelH} over ${m.overflow} | open scrollTop ${m.open.scrollTop} h1 [${m.open.h1}] who [${m.open.who}] -> ${hidden} | min scrollTop ${m.up.scrollTop} h1 [${m.up.h1}] | focus ${m.focused}`);
        if ((variant === 'empty' || variant === 'typical') && engine === 'webkit') {
          await d.page.screenshot({ path: path.join(OUT, `verify-picker-title-2-${engine}-${variant}-${v.name}.png`), scale: 'css', animations: 'disabled' });
        }
        await d.close();
      }
    } finally { await L.close(); }
  }
}
fs.writeFileSync(path.join(OUT, 'verify-picker-title-2.json'), JSON.stringify(rows, null, 1));
console.log('wrote', path.join(OUT, 'verify-picker-title-2.json'));
