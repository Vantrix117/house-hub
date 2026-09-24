// Rendered contrast of every visible text item on Prayer's main screens, in all five palettes (+ System on a dark OS),
// standalone at iPhone width (the app opened by URL on a signed-in device, so the page is the app itself).
// Uses the Phase 2 in-page sampler read-only (audits/tools/phase2/VIS/lib-vis.mjs contrastSweep: text hidden, the
// screenshot sampled under each line box, p10 of the per-pixel ratios). Also records --accent / --accent-deep per profile.
// Run: node "audits/tools/phase3/prayer/contrast.mjs" -> audits/evidence/p3/prayer/contrast.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
import { contrastSweep } from '../../phase2/VIS/lib-vis.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const THEMES = [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['forest', 'dark'], ['system', 'dark']];
const SCREENS = [
  ['today', null], ['family', async p => { await p.click('#listSwitch [data-list="shared"]'); }],
  ['record', async p => { await p.click('nav [data-go="answered"]'); }],
  ['settings', async p => { await p.click('nav [data-go="more"]'); }],
];
const out = { rows: [], accents: {} };
try {
  for (const [theme, mode] of THEMES) {
    for (const profile of ['eli', 'kiara']) {
      for (const [screen, act] of (profile === 'kiara' ? [['kid', null]] : SCREENS)) {
        const d = await L.device({ device: 'iphone-pwa', profile, mode, localStorage: theme === 'system' ? {} : { 'hub.theme': JSON.stringify(theme) } });
        await d.page.goto(L.site + '/apps/prayer.html', { waitUntil: 'load' });
        await d.page.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 });
        await sleep(500);
        if (act) { await act(d.page); await sleep(500); }
        const r = await contrastSweep(d.page, 'html');
        const fails = r.measured.filter(m => m.p10 < (m.large ? 3 : 4.5)).map(m => ({ text: m.text, sel: m.sel, fs: m.fs, fw: m.fw, p10: m.p10, med: m.med }));
        const min = r.measured.reduce((a, m) => Math.min(a, m.p10), 99);
        const scheme = await d.page.evaluate(() => document.documentElement.dataset.scheme);
        out.rows.push({ theme, mode, scheme, profile, screen, measured: r.measured.length, minP10: min, fails });
        console.log(theme, mode, scheme, profile, screen, 'items', r.measured.length, 'min p10', min, 'fails', fails.length, fails.slice(0, 4).map(x => `"${x.text.slice(0, 28)}" ${x.fs}px ${x.p10}`).join(' | '));
        if (theme === 'hearth' && screen === 'today' && profile === 'eli') {
          for (const pid of ['eli', 'christian', 'mom', 'dad', 'niece']) { /* filled below */ }
        }
        await d.close();
      }
    }
  }
  // per-profile accent: does --accent reach the app, and what do the primary controls paint?
  for (const pid of ['eli', 'christian', 'mom', 'dad', 'niece', 'ezra', 'kiara']) {
    const d = await L.device({ device: 'iphone-pwa', profile: pid });
    await d.page.goto(L.site + '/apps/prayer.html', { waitUntil: 'load' });
    await d.page.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 10000 }); await sleep(400);
    out.accents[pid] = await d.page.evaluate(() => {
      const cs = getComputedStyle(document.body), q = s => document.querySelector(s);
      const bg = s => q(s) ? getComputedStyle(q(s)).backgroundColor : null;
      return { accent: cs.getPropertyValue('--accent').trim(), accentDeep: cs.getPropertyValue('--accent-deep').trim(), accentSoft: cs.getPropertyValue('--accent-soft').trim(),
        prayNowBg: bg('#startPray'), navCurrentColor: q('nav [aria-current="true"]') && getComputedStyle(q('nav [aria-current="true"]')).color, kidPrayedBg: bg('.kid .prayed'), kidDoneBg: bg('.kid.done .prayed') };
    });
    if (pid === 'eli') {                                         // family mode: body.shared re-binds --accent only (line 39)
      await d.page.click('#listSwitch [data-list="shared"]'); await sleep(300);
      out.accents.eliFamilyMode = await d.page.evaluate(() => { const cs = getComputedStyle(document.body); return { accent: cs.getPropertyValue('--accent').trim(), accentDeep: cs.getPropertyValue('--accent-deep').trim(), prayNowBg: getComputedStyle(document.getElementById('startPray')).backgroundColor, switchOn: getComputedStyle(document.querySelector('nav [aria-current="true"]')).color, fabBg: getComputedStyle(document.getElementById('fab')).backgroundColor }; });
    }
    console.log('accent', pid, JSON.stringify(out.accents[pid]));
    await d.close();
  }
  console.log('eli family mode', JSON.stringify(out.accents.eliFamilyMode));
} catch (e) { console.error(e); out.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/contrast.json`, JSON.stringify(out, null, 1)); await L.close(); }
