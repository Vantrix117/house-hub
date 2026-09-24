// Visual-score check (Phase 3, Prayer): two measurements the investigator did not take.
//  A. List screen, scrolled to the very end on iPhone: does the + button sit over the last category row's controls
//     (the Copy button and the disclosure summary)? elementFromPoint at each control's centre says who gets the tap.
//  B. Kid mode: the "Prayed" button before and after a tap - label, icon and background, and the contrast between the
//     two backgrounds (how far apart the two states are when colour is the only difference), light and dark.
// Run: node "audits/tools/phase3/prayer/vischeck-fab-list.mjs" -> audits/evidence/p3/prayer/vischeck-fab-list.json + PNGs
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const out = { A: [], B: [] };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  // A
  for (const device of ['iphone-pwa', 'iphone-safari']) {
    const d = await L.device({ device, profile: 'eli' });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(600);
    await f.click('nav [data-go="all"]'); await sleep(400);
    await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(400);
    const r = await f.evaluate(() => {
      const fab = document.getElementById('fab'); const fr = fab.getBoundingClientRect();
      const fabOn = getComputedStyle(fab).display !== 'none' && fab.classList.contains('on');
      const cats = [...document.querySelectorAll('.copybtn')].map(b => b.closest('details.cat')).filter(x => x && x.getBoundingClientRect().height > 0); const last = cats[cats.length - 1];
      const probe = e => { if (!e) return null; const b = e.getBoundingClientRect(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
        const hit = document.elementFromPoint(cx, cy); return { text: e.textContent.trim().slice(0, 40), rect: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)],
          centreHits: hit ? (hit.closest('#fab') ? 'FAB' : hit.closest('nav') ? 'NAV' : (e.contains(hit) || hit === e) ? 'self' : hit.tagName + '.' + hit.className) : null }; };
      return { vh: innerHeight, fabOn, fab: [Math.round(fr.x), Math.round(fr.y), Math.round(fr.width), Math.round(fr.height)],
        navTop: Math.round(document.querySelector('nav').getBoundingClientRect().top),
        lastCat: last && last.querySelector('summary') ? last.querySelector('summary').textContent.trim().slice(0, 40) : null,
        lastCopy: probe(last && last.querySelector('.copybtn')), lastCount: probe(last && last.querySelector('summary .n')),
        scrollY: Math.round(scrollY), maxScroll: document.documentElement.scrollHeight - innerHeight };
    });
    out.A.push({ device, ...r });
    console.log('A', device, JSON.stringify(r));
    await d.shot(`${OUT}/vischeck-fab-list-${device}.png`);
    await d.close?.();
  }
  // B
  for (const [profile, mode] of [['ezra', 'light'], ['ezra', 'dark'], ['kiara', 'light'], ['kiara', 'dark']]) {
    const d = await L.device({ device: 'ipad-portrait', profile, mode });
    const f = await d.openApp('prayer', { wait: '.kid' });
    await f.waitForSelector('.kid .prayed'); await sleep(600);
    // the local instance is shared across iterations: make sure at least one card is in the done state
    if (!(await f.locator('li.kid.done').count())) { await f.locator('li.kid:not(.done) .prayed').last().click(); await sleep(700); }
    if (mode === 'dark') await d.shot(`${OUT}/vischeck-kid-states-${profile}-dark.png`);
    const r = await f.evaluate(() => {
      const lum = c => { const srgb = c.startsWith('color('); const m = c.replace('color(srgb', '').match(/[\d.]+/g).map(Number); const a = m.slice(0, 3).map(v => { if (!srgb) v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; };
      const cr = (x, y) => { const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p); return +((a + .05) / (b + .05)).toFixed(2); };
      const btn = li => { const b = li.querySelector('.prayed'); const c = getComputedStyle(b); return { title: li.querySelector('.kt').textContent.slice(0, 30), done: li.classList.contains('done'),
        label: b.textContent.trim(), hasCheckIcon: !!b.querySelector('svg path'), bg: c.backgroundColor, fg: c.color, titleColor: getComputedStyle(li.querySelector('.kt')).color }; };
      const lis = [...document.querySelectorAll('li.kid')].map(btn);
      const u = lis.find(x => !x.done), dn = lis.find(x => x.done);
      return { undone: u, done: dn, bgContrastBetweenStates: u && dn ? cr(u.bg, dn.bg) : null };
    });
    out.B.push({ profile, mode, ...r });
    console.log('B', profile, mode, JSON.stringify(r));
    await d.close?.();
  }
} finally {
  fs.writeFileSync(`${OUT}/vischeck-fab-list.json`, JSON.stringify(out, null, 1));
  await L.close();
}
