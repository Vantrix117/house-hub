// Skeptic #2 for Prayer finding "tap-before-ready": taps on a brand-new device while hub.ready is still waiting.
// Holds GET /api/data/prayer?... for HOLD ms on a freshly paired phone, taps Family then Record before ready,
// records page errors, the + button and the visible screen during the window, then again after boot finishes.
// Run: node "audits/tools/phase3/prayer/verify-tap-before-ready-2.mjs" [webkit|chromium]
//   -> audits/evidence/p3/prayer/verify-tap-before-ready-2[-<engine>].json + two PNGs (webkit only)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const engine = process.argv[2] || 'webkit';
const OUT = 'audits/evidence/p3/prayer';
const tag = 'verify-tap-before-ready-2' + (engine === 'webkit' ? '' : '-' + engine);
const L = await local({ variant: 'typical', clock: 'demo', engine });
const res = { engine };
const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v)); };
const state = f => f.evaluate(() => ({
  Ddefined: typeof D !== 'undefined' && !!D,
  activeList: (typeof D !== 'undefined' && D) ? D.activeList : null,
  screen: document.querySelector('.screen.on').id,
  fabOn: document.getElementById('fab').classList.contains('on'),
  navCurrent: [...document.querySelectorAll('nav button')].filter(b => b.getAttribute('aria-current') === 'true').map(b => b.dataset.go),
  switchPressed: [...document.querySelectorAll('#listSwitch [data-list]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.list),
  todayLine: (document.getElementById('todayLine') || {}).textContent || '',
  answeredText: document.getElementById('s-answered').textContent.replace(/\s+/g, ' ').trim().slice(0, 120),
}));
async function run(label, hold, taps) {
  const ph = await L.newDevice({ name: 'Eli spare ' + label, profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', as: ph, fixedTime: false });
  let held = 0;
  if (hold) await d.ctx.route(u => /\/api\/data\/prayer\?/.test(u.href), async r => { held++; await sleep(hold); r.continue(); });
  const t0 = Date.now();
  await d.goto('#prayer'); let f; for (let i = 0; i < 100 && !(f = d.frame('prayer')); i++) await sleep(100);
  await f.waitForSelector('#listSwitch'); await sleep(300);
  const out = { holdMs: hold, beforeTaps: await state(f), tAtTapsMs: Date.now() - t0 };
  if (taps) {
    await f.click('#listSwitch [data-list="shared"]').catch(e => out.clickErr1 = String(e).slice(0, 80)); await sleep(200);
    out.afterFamilyTap = await state(f);
    await f.click('nav [data-go="answered"]').catch(e => out.clickErr2 = String(e).slice(0, 80)); await sleep(300);
    out.afterRecordTap = await state(f);
    if (engine === 'webkit' && hold === 4000) await d.page.screenshot({ scale: 'css', path: `${OUT}/${tag}-${label}-during-window.png` });
  }
  await f.waitForFunction(() => typeof D !== 'undefined' && !!D, null, { timeout: 15000 });
  out.readyAfterMs = Date.now() - t0; await sleep(600);
  out.afterReady = await state(f);
  if (engine === 'webkit' && hold === 4000 && taps) await d.page.screenshot({ scale: 'css', path: `${OUT}/${tag}-${label}-after-ready.png` });
  // does the app work normally afterwards?
  await f.click('#listSwitch [data-list="shared"]', { timeout: 5000 }).catch(e => out.familyTapAfterReadyErr = String(e).slice(0, 100)); await sleep(300);
  out.familyTapAfterReady = await state(f);
  out.held = held; out.pageErrors = d.logs.filter(l => l.startsWith('pageerror')).map(l => l.slice(0, 140));
  out.prayerRequestsHeld = held;
  log(label, out);
  await d.close();
}
try {
  await run('hold4s', 4000, true);
  await run('hold8s', 8000, true);      // longer than hub.ready's 6 s cap
  await run('noHold', 0, true);         // an ordinary local first open, tapping as soon as the switch exists
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(res, null, 1)); await L.close(); }
