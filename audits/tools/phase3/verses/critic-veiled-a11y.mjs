// Completeness critic, Verses: is the veiled verse text exposed to assistive technology before Show?
// The text F260 has on file is put in #text and only blurred with a CSS filter until Show (apps/verses.html:43-44, 107, 326);
// nothing sets aria-hidden or hides it from the accessibility tree. Eli, iPhone PWA: rate the first card (Luke 14:26-27),
// then John 17:3 (text on file) is on the card, unrevealed. Batch writes are aborted so the server stays at the seed.
// Run: node "audits/tools/phase3/verses/critic-veiled-a11y.mjs"
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
import { openVerses, state } from './_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
  await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
  const f = await openVerses(d);
  await f.click('#show'); await sleep(150); await f.click('[data-rate="got"]'); await sleep(900);
  const s = await state(f);
  out.card = { ref: s.ref, hint: s.hint, revealed: await f.evaluate(() => !document.getElementById('act-rate').hidden) };
  out.textEl = await f.evaluate(() => { const e = document.getElementById('text'); const cs = getComputedStyle(e); return { hidden: e.hidden, veiled: e.classList.contains('veiled'), filter: cs.filter, ariaHidden: e.getAttribute('aria-hidden'), visibility: cs.visibility, display: cs.display, chars: e.textContent.length, start: e.textContent.slice(0, 40) }; });
  try { out.ariaSnapshot = await f.locator('#trainer').ariaSnapshot(); } catch (e) { out.ariaSnapshot = 'unavailable: ' + e.message.split('\n')[0]; }
  out.snapshotContainsText = typeof out.ariaSnapshot === 'string' && out.textEl.start.length > 10 && out.ariaSnapshot.includes(out.textEl.start.slice(0, 20));
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync('audits/evidence/p3/verses/critic-veiled-a11y.json', JSON.stringify(out, null, 1));
} finally { await L.close(); }
