// Skeptic #2 for critic-star-buttons-not-gold-5: do Done ★ / I heard it paint gold (as `--accent: var(--gold)` at
// apps/kidverse.html:55,137 suggests) or in the kid's own colour (--accent-deep resolved on :root, apps/design.css:89)?
//   node "audits/tools/phase3/kidverse/verify-critic-star-buttons-not-gold-5-2.mjs"
// For Ezra and Kiara, in Hearth and Midnight (theme set on <html> as visual.mjs does), prints each button's --accent,
// resolved --accent-deep and painted background end colour, plus the colour it would paint if --accent-deep were
// re-derived on the element (control: set --accent-deep inline to color-mix(var(--accent) ...) on the button).
import { local, sleep, log, saveJson, shot } from './_kv.mjs';

const P = 'verify-critic-star-buttons-not-gold-5-2';
const out = { rows: [] };
const L = await local({ variant: 'typical', clock: 'real' });
try {
  for (const kid of ['ezra', 'kiara']) {
    const d = await L.device({ device: 'iphone-pwa', profile: kid, fixedTime: false });
    await d.page.goto(L.site + '/apps/kidverse.html', { waitUntil: 'load' });
    await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 }); await sleep(1200);
    for (const theme of ['hearth', 'midnight']) {
      const r = await d.page.evaluate(([t]) => {
        const root = document.documentElement;
        if (t === 'hearth') delete root.dataset.theme; else root.dataset.theme = t;
        root.dataset.scheme = t === 'midnight' ? 'dark' : 'light';
        const probe = (sel) => {
          const e = document.querySelector(sel); if (!e) return { missing: true };
          const wasHidden = e.hidden; e.hidden = false;
          const c = getComputedStyle(e);
          // resolve colours via a throwaway element
          const tmp = document.createElement('span'); e.appendChild(tmp);
          tmp.style.color = 'var(--accent-deep)'; const deep = getComputedStyle(tmp).color;
          tmp.style.color = 'var(--accent)'; const acc = getComputedStyle(tmp).color;
          tmp.style.color = 'var(--gold)'; const gold = getComputedStyle(tmp).color;
          tmp.remove();
          const bg = c.backgroundImage;
          const today = e.classList.contains('today');
          // control: re-derive --accent-deep on the element from its own --accent (what the fix would do)
          const rootDeepDecl = getComputedStyle(root).getPropertyValue('--accent-deep').trim();
          const fixDecl = rootDeepDecl.replace(/#[0-9A-Fa-f]{6}/, 'var(--accent)');
          e.style.setProperty('--accent-deep', fixDecl);
          const tmp2 = document.createElement('span'); e.appendChild(tmp2); tmp2.style.color = 'var(--accent-deep)';
          const fixedDeep = getComputedStyle(tmp2).color; tmp2.remove(); e.style.removeProperty('--accent-deep');
          e.hidden = wasHidden;
          return { wasHidden, today, accentOnEl: c.getPropertyValue('--accent').trim(), accentDeepOnEl: c.getPropertyValue('--accent-deep').trim(), deepResolved: deep, accentResolved: acc, goldResolved: gold, bg: bg.slice(0, 160), fixedDeep };
        };
        return { rootAccent: getComputedStyle(root).getPropertyValue('--accent').trim(), done: probe('#done'), heard: probe('#story-heard') };
      }, [theme]);
      out.rows.push({ kid, theme, ...r });
      log(kid, theme, 'root --accent', r.rootAccent);
      for (const b of ['done', 'heard']) { const x = r[b]; log('  ', b, 'hidden=', x.wasHidden, 'today=', x.today, '| --accent on el', x.accentOnEl, '| --accent-deep on el', x.accentDeepOnEl, '| painted deep', x.deepResolved, '| if re-derived', x.fixedDeep); }
      if (kid === 'ezra' && theme === 'hearth') {
        await d.page.evaluate(() => { const e = document.querySelector('#done'); e.hidden = false; e.scrollIntoView({ block: 'center' }); });
        await sleep(300);
        out.shot = await shot(d.page, `${P}-ezra-hearth-done.png`);
      }
    }
    await d.close();
  }
  out.file = saveJson(`${P}.json`, out);
} finally { await L.close(); }
