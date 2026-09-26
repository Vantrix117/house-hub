// UX-PRAYER-1 skeptic s1: where "Add to the list" sits when Add opens (from the nav and from the + button),
// how much of it is visible above the nav, and whether scrolling to the end clears it.
// Run: node audits/tools/phase5/ux-verify/UX-PRAYER-1/s1-add-button.mjs
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = 'audits/evidence/p5/ux-verify/UX-PRAYER-1/s1';
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const rows = [];
const probe = f => f.evaluate(() => {
  const b = document.getElementById('f-save').getBoundingClientRect(), n = document.querySelector('nav').getBoundingClientRect();
  const t = document.getElementById('f-title').getBoundingClientRect();
  const visibleAboveNav = Math.max(0, Math.min(b.bottom, n.top, innerHeight) - b.top);
  const cx = b.left + b.width / 2, cy = Math.min(b.top + 10, innerHeight - 1);
  const hit = document.elementFromPoint(cx, cy);
  return { vh: innerHeight, scrollY: Math.round(scrollY), maxScroll: Math.round(document.documentElement.scrollHeight - innerHeight),
    saveTop: Math.round(b.top), saveBottom: Math.round(b.bottom), saveH: Math.round(b.height), navTop: Math.round(n.top),
    titleTop: Math.round(t.top), visibleAboveNavPx: Math.round(visibleAboveNav), fullyClear: b.bottom <= n.top,
    tapNearTopHits: hit ? (hit.closest('nav') ? 'nav' : hit.id || hit.tagName) : null };
});
try {
  for (const device of ['iphone-pwa', 'iphone-safari', 'ipad-portrait', 'ipad-landscape', 'desktop']) {
    const d = await L.device({ device, profile: 'eli' });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(700);
    const row = { device };
    await f.click('nav [data-go="add"]'); await sleep(400);
    row.fromNav = await probe(f);
    await d.shot(`${OUT}/${device}-add-open.png`);
    await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
    row.afterScrollEnd = await probe(f);
    await d.shot(`${OUT}/${device}-add-scrolled.png`);
    await f.click('nav [data-go="today"]'); await sleep(300);
    const fabOn = await f.evaluate(() => { const e = document.getElementById('fab'); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; });
    if (fabOn) { await f.click('#fab'); await sleep(400); row.fromFab = await probe(f); }
    rows.push(row);
    console.log(device, JSON.stringify(row));
    await d.close();
  }
} catch (e) { console.error(e); rows.push({ error: String(e.stack || e) }); }
finally { fs.writeFileSync(`${OUT}/add-button.json`, JSON.stringify(rows, null, 1)); await L.close(); }
