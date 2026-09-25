// TELL / areas: the 11 areas, opened the same way in every TELL script. Shell = adult Home (Eli); TV = the kiosk board on
// the 1920x1080 TV; each app = its frame inside the shell viewer, opened through the shell hash route (index.html:650-652)
// as Eli, except Kid Verse as Ezra (kid). Returns { doc, frameEl } where doc is the Playwright Frame to inspect.
import { sleep } from '../../lib/local.mjs';
export const APPS = ['f260', 'leftovers', 'prayer', 'tally', 'timer', 'dollywood', 'dollywood-live', 'kidverse', 'verses'];
export const AREAS = ['shell', 'tv', ...APPS];
export const profileFor = a => a === 'tv' ? 'tv' : a === 'kidverse' ? 'ezra' : 'eli';
export const deviceFor = (a, dflt) => a === 'tv' ? 'tv' : dflt;
// a control that is safe to tap on the local rig (navigation, speech or a local-rig write) — used for "focus ring after a tap"
export const TAP = { shell: '#tabbar .tab[data-tab="apps"]', tv: null, f260: '#tabPlan', leftovers: '#copy', prayer: '#listSwitch button', tally: '#plus', timer: '#presets button', dollywood: '#chips button', 'dollywood-live': '#lv-fit', kidverse: '#say', verses: '#say' };
export async function openArea(d, area, { settle = 1200 } = {}) {
  if (area === 'shell' || area === 'tv') {
    await d.goto('#home');
    await d.page.waitForFunction(() => window.hub && document.querySelector('#shell:not([hidden])'), null, { timeout: 15000 }).catch(() => {});
    await sleep(settle);
    return { doc: d.page.mainFrame(), frameEl: null };
  }
  const f = await d.openApp(area);
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 15000 }).catch(() => {});
  await sleep(settle);
  return { doc: f, frameEl: await d.page.$('#frame') };
}
export async function setTheme(L, profiles, theme) {
  const out = [];
  for (const p of profiles) { if (p === 'tv') continue; const r = await L.apiAs(p, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: theme } }); out.push([p, r.status]); }
  return out;
}
