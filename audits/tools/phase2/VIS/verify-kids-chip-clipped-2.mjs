// Skeptic #2 for "kids-chip-clipped": does the Home Kids card really cut off kid names and badge counts?
// Independent of leads.mjs. Three passes on fresh local instances (WebKit):
//   A. overflow seed (profiles carry LONG_NAMES) — measure where each chip's text ends vs. the card's visible box,
//      and whether the "★N" and the badge number themselves are inside the visible area.
//   B. typical seed (real names Ezra / Kiara) — control: is anything clipped with the household's real names?
//   C. typical seed, admin renames Ezra to a 40-char name via PUT /api/admin/profiles/ezra (the Worker's own cap,
//      worker/src/index.js:458) — can the hub itself produce a name that loses the star count?
// Run: node "audits/tools/phase2/VIS/verify-kids-chip-clipped-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits', 'evidence', 'p2', 'VIS');
fs.mkdirSync(OUT, { recursive: true });
const DEVICES = ['desktop', 'ipad-portrait', 'iphone-pwa'];
const results = {};

async function measure(L, device, tag) {
  const d = await L.device({ device, profile: 'eli', mode: 'light' });
  try {
    await d.goto('#home');
    await d.page.waitForSelector('.kids-card .kid-chip', { timeout: 15000 });
    await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull, null, { timeout: 15000 }).catch(() => {});
    await sleep(1200);
    const m = await d.page.evaluate(() => {
      const card = document.querySelector('.kids-card');
      const cr = card.getBoundingClientRect();
      const cs = getComputedStyle(card);
      const visRight = cr.right - parseFloat(cs.borderRightWidth);   // overflow:hidden clips at the padding box
      const contentRight = cr.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
      // right edge of the first occurrence of a substring inside el
      const edgeOf = (el, needle, which = 'right') => {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let n; while ((n = w.nextNode())) { const i = n.data.indexOf(needle); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + needle.length); const b = r.getBoundingClientRect(); return Math.round(which === 'right' ? b.right : b.left); } }
        return null;
      };
      return {
        cardOverflow: cs.overflow, chipWhiteSpace: getComputedStyle(document.querySelector('.kid-chip')).whiteSpace,
        lineFlexWrap: getComputedStyle(document.querySelector('.kids-line')).flexWrap,
        cardRight: Math.round(cr.right), visibleRight: Math.round(visRight), contentRight: Math.round(contentRight),
        chips: [...card.querySelectorAll('.kid-chip')].map(k => {
          const r = k.getBoundingClientRect(); const txt = k.textContent.trim();
          const star = (txt.match(/★\d+/) || [null])[0];
          const badgeM = txt.match(/· (\d+) badges?/);
          const starRight = star ? edgeOf(k, star) : null;
          const badgeNumRight = badgeM ? edgeOf(k, badgeM[1] + (badgeM[0].includes('badges') ? ' badges' : ' badge'), 'left') : null;   // left edge of "N badge(s)"
          const badgeWordRight = badgeM ? edgeOf(k, badgeM[0].slice(2)) : null;
          return {
            text: txt, chipRight: Math.round(r.right), overflowPx: Math.round(r.right - visRight),
            starText: star, starRight, starVisible: starRight !== null ? starRight <= visRight : null,
            badgeText: badgeM ? badgeM[0].slice(2) : null, badgeTextRight: badgeWordRight, badgeFullyVisible: badgeWordRight !== null ? badgeWordRight <= visRight : null,
            badgeDigitVisible: badgeNumRight !== null ? badgeNumRight + 10 <= visRight : null,
            hasEllipsis: getComputedStyle(k).textOverflow,
          };
        }),
      };
    });
    await d.page.evaluate(() => { const k = document.querySelector('.kids-card'); const v = document.querySelector('#views'); if (k && v) v.scrollTop += k.getBoundingClientRect().top - 40; });
    await sleep(300);
    const box = await d.page.evaluate(() => { const r = document.querySelector('.kids-card').getBoundingClientRect(); return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: Math.min(innerWidth - Math.max(0, r.x - 8), r.width + 16), height: Math.min(r.height + 16, innerHeight - Math.max(0, r.y - 8)) }; });
    const file = path.join(OUT, `verify2-kids-chip-${tag}-${device}.png`);
    await d.page.screenshot({ path: file, clip: box, scale: 'css', animations: 'disabled', caret: 'hide' });
    m.shot = path.relative(ROOT, file).replace(/\\/g, '/');
    return m;
  } finally { await d.close(); }
}

// A. overflow seed
{
  const L = await local({ variant: 'overflow', clock: 'demo', engine: 'webkit' });
  try { for (const dev of DEVICES) results[`A overflow ${dev}`] = await measure(L, dev, 'overflow'); }
  finally { await L.close(); }
}
// B + C. typical seed: real names, then a 40-char rename by the admin
{
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  try {
    for (const dev of DEVICES) results[`B typical ${dev}`] = await measure(L, dev, 'typical');
    const name40 = 'Ezra Bartholomew Montgomery-Andersonson';   // 39 chars, under the Worker's 40-char cap
    const r = await L.apiAs('eli', '/api/admin/profiles/ezra', { method: 'PUT', body: { name: name40 } });
    results['C rename'] = { status: r.status, name: r.body && (r.body.profile ? r.body.profile.name : r.body.name), len: name40.length };
    await L.sessions();   // refresh the profile list the harness seeds into each new device's localStorage (hub.profiles)
    for (const dev of DEVICES) results[`C renamed ${dev}`] = await measure(L, dev, 'name40');
  } finally { await L.close(); }
}

for (const [k, v] of Object.entries(results)) {
  if (!v.chips) { console.log(k, JSON.stringify(v)); continue; }
  console.log(`\n${k}: card overflow=${v.cardOverflow} chip white-space=${v.chipWhiteSpace} kids-line flex-wrap=${v.lineFlexWrap} visibleRight=${v.visibleRight} → ${v.shot}`);
  for (const c of v.chips) console.log(`  "${c.text}" chipRight=${c.chipRight} overflowPx=${c.overflowPx} | ${c.starText} visible=${c.starVisible} | "${c.badgeText}" fully visible=${c.badgeFullyVisible}, digit visible=${c.badgeDigitVisible} | text-overflow=${c.hasEllipsis}`);
}
fs.writeFileSync(path.join(OUT, 'verify2-kids-chip.json'), JSON.stringify(results, null, 1));
console.log('\nwrote audits/evidence/p2/VIS/verify2-kids-chip.json');
