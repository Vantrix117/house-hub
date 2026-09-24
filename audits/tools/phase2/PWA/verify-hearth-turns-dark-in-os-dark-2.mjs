// Skeptic #2 for finding "hearth-turns-dark-in-os-dark": pick Hearth in Me while the OS is in dark mode.
// Runs on WebKit AND Chromium (to rule out an engine artefact), with controls: Hearth in OS light, Parchment in OS dark,
// a cold reload (theme restored from localStorage only), the F260 app frame, and the server's person/hub/theme row.
//   node "audits/tools/phase2/PWA/verify-hearth-turns-dark-in-os-dark-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits', 'evidence', 'p2', 'PWA');
fs.mkdirSync(OUT, { recursive: true });
const out = {};

const state = page => page.evaluate(() => {
  const r = document.documentElement, cs = getComputedStyle(r);
  const card = document.querySelector('.theme-card[data-theme="hearth"]');
  const sw = document.querySelector('.theme-swatch[data-preview="hearth"]');
  return {
    lsTheme: localStorage.getItem('hub.theme'),
    htmlDataTheme: r.getAttribute('data-theme'), htmlDataScheme: r.getAttribute('data-scheme'),
    osDark: matchMedia('(prefers-color-scheme: dark)').matches,
    bgToken: cs.getPropertyValue('--bg').trim(), textToken: cs.getPropertyValue('--text').trim(),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content),
    hearthCardOn: card ? card.classList.contains('on') : null,
    hearthSwatchBg: sw ? getComputedStyle(sw).backgroundColor : null,
  };
});

async function pick(L, engineName, mode, theme, { reload = false, f260 = false, shot = false } = {}) {
  const d = await L.device({ device: 'iphone-pwa', mode, profile: 'eli' });
  try {
    await d.goto('#me');
    await d.page.waitForSelector(`.theme-card[data-theme="${theme}"]`, { timeout: 15000 });
    await sleep(800);
    const before = await state(d.page);
    await d.page.click(`.theme-card[data-theme="${theme}"]`);
    await sleep(800);
    const r = { before, after: await state(d.page) };
    if (shot) { await d.page.locator('#theme').scrollIntoViewIfNeeded(); await d.page.screenshot({ path: path.join(OUT, `verify-hearth-turns-dark-in-os-dark-2-me-${engineName}-iphone-pwa-${mode}.png`), scale: 'css', animations: 'disabled', caret: 'hide' }); }
    if (reload) { await d.page.reload({ waitUntil: 'load' }); await d.page.waitForSelector('.theme-card', { timeout: 15000 }).catch(() => {}); await sleep(1500); r.afterReload = await state(d.page); }
    if (f260) {
      const f = await d.openApp('f260'); await sleep(2500);
      r.f260 = await f.evaluate(() => ({ htmlDataTheme: document.documentElement.getAttribute('data-theme'), htmlDataScheme: document.documentElement.getAttribute('data-scheme'), bgToken: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), bodyBg: getComputedStyle(document.body).backgroundColor, lsTheme: localStorage.getItem('hub.theme') }));
      if (shot) await d.page.screenshot({ path: path.join(OUT, `verify-hearth-turns-dark-in-os-dark-2-f260-${engineName}-iphone-pwa-${mode}.png`), scale: 'css', animations: 'disabled', caret: 'hide' });
    }
    const srv = await L.apiAs('eli', '/api/data/hub?scope=person');
    const items = srv.body && (srv.body.items || srv.body);
    r.serverTheme = Array.isArray(items) ? (items.find(i => i.key === 'theme') || {}).value : JSON.stringify(srv.body).slice(0, 200);
    r.pageErrors = d.logs.filter(l => l.startsWith('pageerror'));
    return r;
  } finally { await d.close(); }
}

for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  try {
    const e = out[engine] = {};
    e.hearth_osDark = await pick(L, engine, 'dark', 'hearth', { reload: true, f260: true, shot: engine === 'webkit' });
    await L.reset('typical');
    e.hearth_osLight = await pick(L, engine, 'light', 'hearth');
    await L.reset('typical');
    e.parchment_osDark = await pick(L, engine, 'dark', 'parchment');
    await L.reset('typical');
    e.system_osDark = await pick(L, engine, 'dark', 'system');
  } finally { await L.close(); }
}

fs.writeFileSync(path.join(OUT, 'verify-hearth-turns-dark-in-os-dark-2.json'), JSON.stringify(out, null, 1));
for (const [eng, e] of Object.entries(out)) for (const [k, r] of Object.entries(e)) {
  const a = r.after;
  console.log(`${eng.padEnd(8)} ${k.padEnd(16)} osDark=${a.osDark} ls=${a.lsTheme} data-theme=${a.htmlDataTheme} data-scheme=${a.htmlDataScheme} --bg=${a.bgToken} --text=${a.textToken} body=${a.bodyBg} metas=${a.metas.join(',')} hearthCardOn=${a.hearthCardOn} hearthSwatch=${a.hearthSwatchBg} server=${JSON.stringify(r.serverTheme)}`);
  if (r.afterReload) console.log(`${' '.repeat(26)}after reload: data-theme=${r.afterReload.htmlDataTheme} data-scheme=${r.afterReload.htmlDataScheme} --bg=${r.afterReload.bgToken} metas=${r.afterReload.metas.join(',')} hearthCardOn=${r.afterReload.hearthCardOn}`);
  if (r.f260) console.log(`${' '.repeat(26)}F260 frame: ${JSON.stringify(r.f260)}`);
  if (r.pageErrors.length) console.log(`${' '.repeat(26)}page errors: ${r.pageErrors.join(' | ')}`);
}
