// Skeptic #2 for "hearth-ignored-on-dark-os": does an explicit Hearth choice on a dark-mode device paint Midnight?
// Uses the real Me-tab theme card (not just hub.setTheme), controls for System/Midnight and a light OS, checks both engines,
// and checks the cross-device path (Hearth picked on a light-OS device → the same person's dark-OS phone after a pull).
//   node "audits/tools/phase2/VIS/verify-hearth-ignored-on-dark-os-2.mjs"
// Writes only to the throwaway local rig and audits/evidence/p2/VIS/verify-hearth-2*.{json,png}.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EV = path.join(ROOT, 'audits/evidence/p2/VIS');
fs.mkdirSync(EV, { recursive: true });
const out = {};

const measure = page => page.evaluate(() => {
  const r = document.documentElement, cs = getComputedStyle(r), b = getComputedStyle(document.body);
  const spot = document.querySelector('.kids-card .spot, .stars-card .spot');
  const meta = [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.getAttribute('content'));
  return {
    dataTheme: r.getAttribute('data-theme'), dataScheme: r.dataset.scheme, hubTheme: window.hub && hub.theme(), stored: localStorage.getItem('hub.theme'),
    osDark: matchMedia('(prefers-color-scheme: dark)').matches,
    tokBg: cs.getPropertyValue('--bg').trim(), tokText: cs.getPropertyValue('--text').trim(),
    bodyBg: b.backgroundColor, bodyText: b.color,
    spotOpacity: spot ? getComputedStyle(spot).opacity : null, themeColorMeta: meta,
  };
});

async function pickViaMe(d, id) {
  await d.goto('#me');
  await d.page.waitForSelector(`#theme button[data-theme="${id}"]`, { timeout: 15000 });
  await d.page.click(`#theme button[data-theme="${id}"]`);
  await sleep(600);
  return d.page.evaluate(() => [...document.querySelectorAll('#theme button.on')].map(b => b.dataset.theme));
}
// F260's Done button keys its ink off data-scheme (apps/f260.html:26-28, 144): measure its contrast in the app frame
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const rgb = s => (s.match(/[0-9.]+/g) || []).slice(0, 3).map(Number);
async function f260Done(d) {
  const f = await d.openApp('f260'); await f.waitForSelector('.tdone', { timeout: 15000 }).catch(() => {}); await sleep(800);
  const m = await f.evaluate(() => { const b = document.querySelector('.tdone'); if (!b) return null; const cs = getComputedStyle(b); return { text: b.textContent.trim().slice(0, 30), color: cs.color, bg: cs.backgroundColor, scheme: document.documentElement.dataset.scheme }; });
  if (m) { const a = lum(rgb(m.color)), b = lum(rgb(m.bg)); m.contrast = +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2); }
  return m;
}
async function home(d) { await d.goto('#home'); await d.page.waitForSelector('#view-home .home-hero', { timeout: 15000 }); await sleep(900); }

for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', engine });
  const r = out[engine] = {};
  try {
    // 1. Dark OS, the user taps the Hearth card in Me
    const dark = await L.device({ device: 'ipad-portrait', mode: 'dark', profile: 'eli' });
    await home(dark);
    r.darkOS_default = await measure(dark.page);
    r.darkOS_hearth_cardOn = await pickViaMe(dark, 'hearth');
    await home(dark);
    r.darkOS_hearth = await measure(dark.page);
    if (engine === 'webkit') await dark.page.screenshot({ path: path.join(EV, 'verify-hearth-2-darkos-hearth-ipad.png'), scale: 'css' });
    if (engine === 'webkit') { r.f260Done_darkOS_hearth = await f260Done(dark); await dark.page.screenshot({ path: path.join(EV, 'verify-hearth-2-f260-darkos-hearth-ipad.png'), scale: 'css' }); }
    // what the server now holds for Eli's theme
    { const b = (await L.apiAs('eli', '/api/data/hub?scope=person')).body; r.serverTheme = JSON.stringify(b).match(/"key":"theme"[^}]*}/)?.[0] || JSON.stringify(b).slice(0, 300); }
    // 2. same device, System and Midnight as controls
    await pickViaMe(dark, 'system'); await home(dark); r.darkOS_system = await measure(dark.page);
    if (engine === 'webkit') r.f260Done_darkOS_system = await f260Done(dark);
    await pickViaMe(dark, 'midnight'); await home(dark); r.darkOS_midnight = await measure(dark.page);
    // 3. Light OS, Hearth (the reference look)
    const light = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'mom' });
    await pickViaMe(light, 'hearth'); await home(light); r.lightOS_hearth = await measure(light.page);
    if (engine === 'webkit') r.f260Done_lightOS_hearth = await f260Done(light);
    if (engine === 'webkit') await light.page.screenshot({ path: path.join(EV, 'verify-hearth-2-lightos-hearth-ipad.png'), scale: 'css' });
    // 4. Cross-device: Mom picked Hearth on the light iPad → her dark-mode phone (a second paired device) after it loads
    if (engine === 'webkit') {
      const ph = await L.newDevice({ name: 'Mom phone', profiles: ['mom'] });
      const phone = await L.device({ device: 'iphone-pwa', mode: 'dark', profile: 'mom', as: ph });
      await home(phone); await sleep(2500); await phone.goto('#home'); await sleep(1500);
      r.crossDevice_momPhone_darkOS = await measure(phone.page);
      await phone.page.screenshot({ path: path.join(EV, 'verify-hearth-2-crossdevice-phone.png'), scale: 'css' });
    }
  } finally { await L.close(); }
  console.log(`\n==== ${engine}`);
  for (const [k, v] of Object.entries(r)) console.log(k.padEnd(28), JSON.stringify(v));
}
fs.writeFileSync(path.join(EV, 'verify-hearth-2.json'), JSON.stringify(out, null, 2));
console.log('\nwrote audits/evidence/p2/VIS/verify-hearth-2.json');
