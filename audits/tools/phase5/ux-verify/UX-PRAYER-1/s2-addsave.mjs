// Skeptic s2, UX-PRAYER-1: where "Add to the list" sits when Add opens, per device, and how far one must scroll.
// Also (UX-PRAYER-2) the kid card before/after a tap and after a second tap, for Ezra and Kiara, light and dark.
// Run: node audits/tools/phase5/ux-verify/UX-PRAYER-1/s2-addsave.mjs
import fs from 'node:fs';
import { local, sleep } from '../../../lib/local.mjs';
const OUT1 = 'audits/evidence/p5/ux-verify/UX-PRAYER-1/s2', OUT2 = 'audits/evidence/p5/ux-verify/UX-PRAYER-2/s2';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = { add: [], kid: [] };
try {
  for (const device of ['iphone-pwa', 'iphone-safari', 'ipad-portrait', 'ipad-landscape', 'desktop']) {
    const d = await L.device({ device, profile: 'eli' });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(600);
    await f.click('nav [data-go="add"]'); await sleep(500);
    const m = await f.evaluate(() => { const b = document.getElementById('f-save').getBoundingClientRect(), n = document.querySelector('nav').getBoundingClientRect();
      const lastVisibleLabel = [...document.querySelectorAll('#s-add label')].filter(l => l.getBoundingClientRect().bottom <= n.top).map(l => l.textContent.trim()).pop();
      return { vw: innerWidth, vh: innerHeight, saveTop: Math.round(b.top), saveBottom: Math.round(b.bottom), navTop: Math.round(n.top), visiblePx: Math.max(0, Math.round(Math.min(n.top, b.bottom) - b.top)), scrollNeeded: Math.max(0, Math.round(b.bottom - n.top + 8)), maxScroll: Math.round(document.documentElement.scrollHeight - innerHeight), lastLabelAboveNav: lastVisibleLabel, fieldsAboveSave: document.querySelectorAll('#s-add input,#s-add textarea,#s-add select').length }; });
    // does Enter in the title submit? (the one keyboard route to finish without scrolling)
    const before = await f.evaluate(() => document.querySelectorAll('[data-open]').length);
    await f.fill('#f-title', 'Test request s2'); await f.press('#f-title', 'Enter'); await sleep(400);
    m.enterSubmitted = await f.evaluate(() => document.getElementById('s-add').classList.contains('on') === false);
    res.add.push({ device, ...m });
    if (device === 'iphone-safari' || device === 'ipad-landscape') { await f.fill('#f-title', ''); await d.shot(`${OUT1}/add-open-${device}.png`); }
    console.log(device, JSON.stringify(m));
    await d.close();
  }
  for (const mode of ['light', 'dark']) for (const profile of ['ezra', 'kiara']) {
    const d = await L.device({ device: 'ipad-portrait', profile, mode });
    const f = await d.openApp('prayer', { wait: '.kid' });
    await f.waitForSelector('.kid', { timeout: 10000 }); await sleep(600);
    const card = () => f.evaluate(() => { const li = [...document.querySelectorAll('.kid')].find(x => !x.classList.contains('done')) || document.querySelector('.kid'); const b = li.querySelector('.prayed'), cs = getComputedStyle(b);
      return { id: b.dataset.kpray, done: li.classList.contains('done'), label: b.textContent.trim(), aria: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed'), bg: cs.backgroundColor, title: getComputedStyle(li.querySelector('.kt')).color, who: (li.querySelector('.kwho') || {}).textContent || null }; });
    const a = await card();
    await f.click(`[data-kpray="${a.id}"]`); await sleep(500);
    const after = await f.evaluate(id => { const b = document.querySelector(`[data-kpray="${id}"]`), li = b.closest('.kid'), cs = getComputedStyle(b); return { done: li.classList.contains('done'), label: b.textContent.trim(), aria: b.getAttribute('aria-label'), bg: cs.backgroundColor, title: getComputedStyle(li.querySelector('.kt')).color, who: (li.querySelector('.kwho') || {}).textContent || null }; }, a.id);
    await f.click(`[data-kpray="${a.id}"]`); await sleep(500);
    const again = await f.evaluate(id => { const b = document.querySelector(`[data-kpray="${id}"]`); return { done: b.closest('.kid').classList.contains('done') }; }, a.id);
    await d.shot(`${OUT2}/kid-after-tap-${profile}-${mode}.png`);
    res.kid.push({ profile, mode, before: a, after, afterSecondTap: again });
    console.log(profile, mode, JSON.stringify({ a, after, again }));
    await d.close();
  }
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT1}/s2-addsave.json`, JSON.stringify(res, null, 1)); fs.writeFileSync(`${OUT2}/s2-kidcards.json`, JSON.stringify(res.kid, null, 1)); await L.close(); }
