// Skeptic #1: does the shell's theme-color meta go stale when the theme is adopted from the server (pull) rather than a tap?
// Local rig only. Writes audits/evidence/p4/DARK/verify-theme-color-stale-after-server-theme-1.json (+ one 1x PNG).
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p4/DARK');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = { engine: 'webkit', cases: {} };
const read = page => page.evaluate(() => {
  const r = document.documentElement;
  return {
    dataTheme: r.dataset.theme || '(none=hearth/system)', scheme: r.dataset.scheme, lsTheme: localStorage.getItem('hub.theme'),
    bg: getComputedStyle(r).getPropertyValue('--bg').trim(), bodyBg: getComputedStyle(document.body).backgroundColor,
    metas: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => ({ media: m.getAttribute('media'), content: m.getAttribute('content') })),
  };
});
const judge = s => ({ ...s, match: s.metas.every(m => m.content.toLowerCase() === s.bg.toLowerCase()) });
const waitTheme = async (page, want, ms = 10000) => { const t = Date.now() + ms; while (Date.now() < t) { const v = await page.evaluate(() => document.documentElement.dataset.theme || ''); if (v === want) return true; await sleep(150); } return false; };
const put = (pid, v) => L.apiAs(pid, '/api/data/hub/theme?scope=person', { method: 'PUT', body: { value: v } });
try {
  // Case A: fresh iPhone (no local theme mirror), OS light, the person's server row says midnight.
  await L.reset('typical');
  res.putA = (await put('eli', 'midnight')).status;
  const a = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'eli' });
  await a.goto('#home');
  res.cases.A_adopted = await waitTheme(a.page, 'midnight');
  await sleep(1500);
  res.cases.A = judge(await read(a.page));
  await a.page.screenshot({ path: path.join(OUT, 'verify-theme-color-stale-after-server-theme-1-A.png'), scale: 'css', clip: { x: 0, y: 0, width: 430, height: 300 } });
  // A2: reload the same device -> boot syncThemeColor runs with midnight already in localStorage
  await a.page.reload({ waitUntil: 'load' }); await sleep(2000);
  res.cases.A2_reload = judge(await read(a.page));
  // A3: control, a Me theme tap: switch to Frost by tap then check
  // Case B: same device now on midnight; another device picks parchment (server row), then this device pulls
  await sleep(50);
  res.putB = (await put('eli', 'parchment')).status;
  res.cases.B0_beforePull = judge(await read(a.page));
  await a.page.evaluate(() => hub.pull());
  res.cases.B_adopted = await waitTheme(a.page, 'parchment');
  await sleep(1000);
  res.cases.B1_afterPull = judge(await read(a.page));
  // B via the real trigger path too: visibilitychange -> pull (put forest, fire visibilitychange)
  res.putB2 = (await put('eli', 'forest')).status;
  await a.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  res.cases.B2_adopted = await waitTheme(a.page, 'forest');
  await sleep(1000);
  res.cases.B2_afterVisibility = judge(await read(a.page));
  // D control: tap a theme card in Me -> metas follow
  await a.goto('#me'); await sleep(1500);
  const tapped = await a.page.evaluate(() => { const b = document.querySelector('#theme button[data-theme="frost"]'); if (!b) return false; b.click(); return true; });
  await sleep(500);
  res.cases.D_meTap = { tapped, ...judge(await read(a.page)) };
  await a.close();
  // Case C: System theme, OS flips light -> dark
  res.putC = (await put('eli', 'system')).status;
  const c = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'eli' });
  await c.goto('#home'); await sleep(2500);
  res.cases.C0_light = judge(await read(c.page));
  await c.page.emulateMedia({ colorScheme: 'dark' }); await sleep(800);
  res.cases.C1_osDark = judge(await read(c.page));
  res.logs = c.logs.filter(l => /error/i.test(l)).slice(0, 10);
  await c.close();
} catch (e) { res.error = String(e && e.stack || e); }
finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'verify-theme-color-stale-after-server-theme-1.json'), JSON.stringify(res, null, 2));
for (const [k, v] of Object.entries(res.cases)) console.log(k, typeof v === 'object' ? `theme=${v.dataTheme} bg=${v.bg} metas=${v.metas && v.metas.map(m => m.content).join('/')} match=${v.match}` : v);
if (res.error) console.log(res.error);
