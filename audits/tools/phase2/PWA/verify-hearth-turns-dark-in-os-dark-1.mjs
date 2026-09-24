// Phase 2 / PWA — skeptic #1 for "hearth-turns-dark-in-os-dark": in OS dark mode, does picking the Hearth card in Me
// still paint the Midnight tokens while hub.js reports data-scheme 'light'? Independent of standalone.mjs.
//   node "audits/tools/phase2/PWA/verify-hearth-turns-dark-in-os-dark-1.mjs"            (webkit + chromium)
//   node "audits/tools/phase2/PWA/verify-hearth-turns-dark-in-os-dark-1.mjs" webkit     (one engine)
// For each engine: (A) iPhone in OS dark: Me → tap Hearth; read localStorage hub.theme, data-theme, data-scheme, --bg,
// body background, the theme-color metas, which card is "on"; reload (persisted choice); open F260 and read its frame.
// (B) Control: the same in OS light (Hearth must be #F7F2EB). (C) Control: Parchment in OS dark (a named light theme
// gets data-theme set, so it should stay light). (D) The person pref 'hearth' written server-side by Eli from another
// device, adopted by the dark-mode iPhone on its pull (the path every other device of the person takes).
// Writes audits/evidence/p2/PWA/verify-hearth-turns-dark-in-os-dark-1.json and 1x PNGs (webkit only).
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const engines = process.argv[2] ? [process.argv[2]] : ['webkit', 'chromium'];
const out = {};
const say = (k, v) => { console.log('\n== ' + k + '\n' + JSON.stringify(v, null, 1)); return v; };

const state = (fr) => fr.evaluate(() => {
  const r = document.documentElement, cs = getComputedStyle(r);
  let ls = null; try { ls = localStorage.getItem('hub.theme'); } catch {}
  return {
    osDark: matchMedia('(prefers-color-scheme: dark)').matches,
    lsTheme: ls, dataTheme: r.getAttribute('data-theme'), dataScheme: r.getAttribute('data-scheme'),
    hubTheme: window.hub && hub.theme && hub.theme(),
    bg: cs.getPropertyValue('--bg').trim(), text: cs.getPropertyValue('--text').trim(),
    bodyBg: getComputedStyle(document.body).backgroundColor, bodyColor: getComputedStyle(document.body).color,
    metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content),
    cardOn: [...document.querySelectorAll('.theme-card.on')].map(b => b.dataset.theme),
    doneBtn: (b => b ? { color: getComputedStyle(b).color, background: getComputedStyle(b).backgroundColor } : null)(document.querySelector('.tdone')),
  };
});
const shot = async (page, name) => { const f = path.join(OUT, name); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f).replace(/\\/g, '/'); };

for (const engine of engines) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  const res = out[engine] = {};
  try {
    const pick = async (mode, theme, tag) => {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', mode });
      await d.goto('#me'); await d.page.waitForSelector('.theme-card[data-theme="' + theme + '"]', { timeout: 15000 });
      const before = await state(d.page);
      await d.page.click('.theme-card[data-theme="' + theme + '"]'); await sleep(600);
      const after = await state(d.page);
      let meShot = null;
      if (engine === 'webkit' && tag) { await d.page.locator('#theme').scrollIntoViewIfNeeded(); meShot = await shot(d.page, `verify-hearth-os-dark-1-${tag}-me.png`); }
      await d.page.reload({ waitUntil: 'load' }); await sleep(800);
      const afterReload = await state(d.page);
      const f = await d.openApp('f260'); await sleep(1500);
      const f260 = await state(f);
      let f260Shot = null;
      if (engine === 'webkit' && tag) f260Shot = await shot(d.page, `verify-hearth-os-dark-1-${tag}-f260.png`);
      await d.close();
      return { before, after, afterReload, f260, meShot, f260Shot };
    };
    res.A_hearth_osDark = say(engine + ' A hearth in OS dark', await pick('dark', 'hearth', 'hearth-dark'));
    res.B_hearth_osLight = say(engine + ' B hearth in OS light (control)', await pick('light', 'hearth', engine === 'webkit' ? 'hearth-light' : null));
    res.C_parchment_osDark = say(engine + ' C parchment in OS dark (control)', await pick('dark', 'parchment', null));

    // D: the pref arrives from the server (Eli picked Hearth on another device); a fresh dark-mode iPhone adopts it
    const put = await L.apiAs('eli', '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: 'hearth', updated_at: Date.now() } });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', mode: 'dark' });
    await d.goto('#home'); await sleep(4000);
    const serverRow = await L.apiAs('eli', '/api/data/hub?scope=person').catch(e => String(e));
    res.D_adopted_from_server = say(engine + ' D pref hearth adopted from server, OS dark', { put, serverTheme: JSON.stringify(serverRow).match(/"theme"[^}]*}/)?.[0] || serverRow, state: await state(d.page) });
    await d.close();
  } catch (e) { res.error = String(e && e.stack || e); console.log('ERROR', res.error); }
  finally { await L.close(); }
}
fs.writeFileSync(path.join(OUT, 'verify-hearth-turns-dark-in-os-dark-1.json'), JSON.stringify(out, null, 1));
console.log('\nwrote audits/evidence/p2/PWA/verify-hearth-turns-dark-in-os-dark-1.json');
