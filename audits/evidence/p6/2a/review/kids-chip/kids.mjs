// Skeptic #1 for VIS finding "kids-chip-clipped": does the adult Home "Kids" card (index.html:909-918, CSS :204-206)
// really cut off long kid names and the ★ / badge count? Independent of leads.mjs.
// For each scenario it signs Eli in on a fresh local instance, opens Home, and for every .kid-chip measures, character by
// character (DOM Range rects), which characters of the chip text lie inside the card's clip edge (.gcard overflow:hidden,
// index.html:110). It prints the visible text, the clipped tail, and whether the ★N and the badge count survive.
// Scenarios:
//   typical  — the rig's typical household (short real names "Ezra", "Kiara")               → control
//   overflow — the rig's overflow seed (25-char names, audits/tools/seed/story.mjs:24-25)    → the claim
//   max40    — typical household, Ezra renamed by the admin to a 40-char name (the Worker's limit, worker/src/index.js:458)
// Devices: desktop 1440, iPad portrait 820, iPhone PWA 430 (rig devices), light mode.
//   node "audits/tools/phase2/VIS/verify-kids-chip-clipped-1.mjs"            (WebKit, default)
//   node "audits/tools/phase2/VIS/verify-kids-chip-clipped-1.mjs" chromium   (engine cross-check)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';

const engine = process.argv[2] === 'chromium' ? 'chromium' : 'webkit';
const EV = process.env.EVDIR;
fs.mkdirSync(EV, { recursive: true });
const DEVICES = ['desktop', 'ipad-portrait', 'iphone-pwa'];
const NAME40 = 'Ezra Bartholomew Montgomery-Anderson Jr.';   // 40 chars
const results = [];

async function measure(d) {
  await d.page.waitForSelector('#view-home .home-hero', { timeout: 15000 });
  await d.page.waitForFunction(() => !!(window.hub && hub.sync && hub.sync.lastPull), null, { timeout: 15000 }).catch(() => {});
  await d.page.waitForSelector('.kids-card .kid-chip', { timeout: 15000 });
  await sleep(800);
  return d.page.evaluate(() => {
    const card = document.querySelector('.kids-card');
    const cs = getComputedStyle(card);
    const cr = card.getBoundingClientRect();
    const clipRight = cr.right - parseFloat(cs.borderRightWidth);
    const chips = [...card.querySelectorAll('.kid-chip')].map(chip => {
      const walker = document.createTreeWalker(chip, NodeFilter.SHOW_TEXT);
      let visible = '', clipped = '', n; const r = document.createRange();
      while ((n = walker.nextNode())) {
        for (let i = 0; i < n.data.length; i++) {
          r.setStart(n, i); r.setEnd(n, i + 1);
          const b = r.getBoundingClientRect();
          if (b.width === 0 && /\s/.test(n.data[i])) { (clipped ? (clipped += n.data[i]) : (visible += n.data[i])); continue; }
          if (b.right <= clipRight + 0.5) visible += n.data[i]; else clipped += n.data[i];
        }
      }
      const star = chip.querySelector('b'); const sr = star.getBoundingClientRect();
      const full = chip.textContent.trim();
      const m = full.match(/· (\d+) badges?$/);
      return {
        text: full, visible: visible.trim(), clipped: clipped.trim(),
        chipRight: Math.round(chip.getBoundingClientRect().right), cardClipRight: Math.round(clipRight),
        overflowPx: Math.round(chip.getBoundingClientRect().right - clipRight),
        starFullyVisible: sr.right <= clipRight + 0.5, starText: star.textContent,
        badgeCountVisible: m ? visible.includes('· ' + m[1]) : null,
        badgeWordComplete: m ? visible.trim().endsWith(m[0].slice(2)) : null,
      };
    });
    return { viewport: innerWidth, cardWidth: Math.round(cr.width), overflowCss: cs.overflow, chipWhiteSpace: getComputedStyle(card.querySelector('.kid-chip')).whiteSpace, fontFamily: getComputedStyle(card.querySelector('.kid-chip')).fontFamily.split(',')[0], chips };
  });
}

for (const scenario of ['typical', 'overflow', 'max40']) {
  const L = await local({ variant: scenario === 'overflow' ? 'overflow' : 'typical', engine });
  try {
    if (scenario === 'max40') {
      const r = await L.apiAs('eli', '/api/admin/profiles/ezra', { method: 'PUT', body: { name: NAME40 } });
      console.log(`[max40] admin rename → ${JSON.stringify(r).slice(0, 160)}`);
    }
    for (const device of DEVICES) {
      const d = await L.device({ device, profile: 'eli', mode: 'light' });
      try {
        await d.goto('#home');
        if (scenario === 'max40') {   // the rig pre-seeds the hub.profiles cache from before the rename: refresh it the way hub.js does, then reload
          await d.page.waitForFunction(() => !!window.hub, null, { timeout: 15000 });
          await d.page.evaluate(() => hub.profiles());
          await d.goto('#home'); await d.page.reload({ waitUntil: 'load' });
        }
        const m = await measure(d);
        await d.page.evaluate(() => { const k = document.querySelector('.kids-card'); k.scrollIntoView({ inline: 'start', block: 'nearest' }); document.querySelector('#views').scrollTop += k.getBoundingClientRect().top - 40; });
        await sleep(300);
        const shot = `verify-kids-chip-${scenario}-${device}-${engine}.png`;
        const box = await d.page.evaluate(() => { const r = document.querySelector('.kids-card').getBoundingClientRect(); return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: Math.min(innerWidth - Math.max(0, r.x - 8), r.width + 16), height: r.height + 16 }; });
        try { await d.page.screenshot({ path: path.join(EV, shot), scale: 'css', clip: box }); } catch (e) { console.log('shot failed', e.message.slice(0,80)); }
        const row = { scenario, device, engine, ...m, shot: 'audits/evidence/p2/VIS/' + shot };
        results.push(row);
        console.log(`\n## ${scenario} · ${device} · ${engine}  (card ${m.cardWidth}px, overflow:${m.overflowCss}, chip white-space:${m.chipWhiteSpace}, font ${m.fontFamily})`);
        for (const c of m.chips) console.log(`  "${c.text}"\n     visible: "${c.visible}"  |  clipped: "${c.clipped}"  (chip ${c.chipRight} vs clip edge ${c.cardClipRight}, over by ${c.overflowPx}px)  ★ visible: ${c.starFullyVisible}  badge count visible: ${c.badgeCountVisible}  badge word complete: ${c.badgeWordComplete}`);
      } finally { await d.close(); }
    }
  } finally { await L.close(); }
}
const out = path.join(EV, `verify-kids-chip-clipped-1-${engine}.json`);
fs.writeFileSync(out, JSON.stringify(results, null, 1));
console.log('\nwrote', path.relative(ROOT, out).replace(/\\/g, '/'));
