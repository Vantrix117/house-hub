// Skeptic #1 for "critic-star-buttons-not-gold-5": do Done ★ (#done) and "I heard it" (#story-heard) paint gold, as
// `--accent: var(--gold)` on them (apps/kidverse.html:55, 137) intends, or in the signed-in kid's own colour?
//   node "audits/tools/phase3/kidverse/verify-critic-star-buttons-not-gold-5-1.mjs"
// For Ezra and Kiara, in Hearth (default) and Midnight, WebKit iPhone 430: the element's own --accent / --accent-deep,
// the painted background-image, whether the button is in its '.today' (already earned, gold-soft) state, and a probe
// element that sets --accent-deep from --gold to show what gold would compute to. Screenshot of the fill per kid/theme.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, log, EVID, rel } from './_kv.mjs';

const P = 'verify-critic-star-buttons-not-gold-5-1';
const out = { runs: [] };
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  for (const kid of ['ezra', 'kiara']) {
    for (const theme of ['hearth', 'midnight']) {
      const d = await L.device({ device: 'iphone-pwa', profile: kid, fixedTime: false });
      await d.page.goto(L.site + '/apps/kidverse.html', { waitUntil: 'load' });
      await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
      await sleep(1200);
      if (theme !== 'hearth') { await d.page.evaluate(t => { document.documentElement.dataset.theme = t; document.documentElement.dataset.scheme = 'dark'; }, theme); await sleep(300); }
      // Force the not-yet-earned state for measurement if the seed already has today's star (the .today rule paints gold-soft).
      const r = await d.page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const m = sel => {
          const e = document.querySelector(sel); if (!e) return null;
          const wasToday = e.classList.contains('today'), wasHidden = e.hidden;
          const measure = () => { const c = getComputedStyle(e); return { bg: c.backgroundImage, bgColor: c.backgroundColor, color: c.color,
            accentOnEl: c.getPropertyValue('--accent').trim(), accentDeepOnEl: c.getPropertyValue('--accent-deep').trim() }; };
          const asShipped = { hidden: wasHidden, today: wasToday, ...measure() };
          e.hidden = false; e.classList.remove('today');
          const notYetEarned = measure();
          return { classes: e.className, asShipped, notYetEarned };
        };
        // probe: what the fill would be if --accent-deep were derived from gold on the button itself
        const probe = document.createElement('button'); probe.className = 'btn btn-primary'; probe.textContent = 'probe';
        probe.style.setProperty('--accent', 'var(--gold)'); probe.style.setProperty('--accent-deep', 'color-mix(in srgb, var(--accent) 72%, black)');
        document.querySelector('.actions').appendChild(probe);
        const pr = getComputedStyle(probe).backgroundImage; probe.remove();
        return { theme: document.documentElement.dataset.theme, rootAccent: root.getPropertyValue('--accent').trim(), rootAccentDeep: root.getPropertyValue('--accent-deep').trim(),
          gold: root.getPropertyValue('--gold').trim(), done: m('#done'), heard: m('#story-heard'), goldProbeBg: pr };
      });
      // pixel sample of #done's fill in the not-yet-earned state
      await d.page.evaluate(() => { const e = document.querySelector('#done'); e.hidden = false; e.classList.remove('today'); e.scrollIntoView({ block: 'center' }); });
      await sleep(400);
      const box = await d.page.locator('#done').boundingBox();
      const png = path.join(EVID, `${P}-${kid}-${theme}-done.png`);
      await d.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide', clip: { x: 0, y: Math.max(0, box.y - 20), width: 430, height: Math.min(260, box.height + 120) } });
      out.runs.push({ kid, theme, ...r, shot: rel(png) });
      log(kid, theme, 'root --accent', r.rootAccent, '| #done shipped today=', r.done.asShipped.today, 'hidden=', r.done.asShipped.hidden);
      log('   #done el --accent', r.done.notYetEarned.accentOnEl, '| el --accent-deep', r.done.notYetEarned.accentDeepOnEl.slice(0, 70));
      log('   #done bg', r.done.notYetEarned.bg.slice(0, 140));
      log('   #story-heard bg', r.heard && r.heard.notYetEarned.bg.slice(0, 140), '| shipped today=', r.heard && r.heard.asShipped.today, 'hidden=', r.heard && r.heard.asShipped.hidden);
      log('   gold probe bg', r.goldProbeBg.slice(0, 140));
      await d.close();
    }
  }
} finally {
  const f = path.join(EVID, P + '.json'); fs.writeFileSync(f, JSON.stringify(out, null, 1)); log('wrote', rel(f));
  await L.close();
}
