// Skeptic #1 for Prayer finding "tap-before-ready": do taps before hub.ready / load() throw, lose the Mine/Family tap,
// and leave the Record screen with the + button showing?
// A brand-new paired device (no prayer cache, so hub.ready waits for the first pull, up to 6 s: apps/hub.js:334-336);
// every /api/data/prayer? request is held HOLD ms. We tap Family, then Record, before the pull returns, and record
// D, the active screen and the fab state after each tap, then again after the hold ends.
// Control: the same taps on a second fresh device with no hold (after load).
// Run: node "audits/tools/phase3/prayer/verify-tap-before-ready-1.mjs" -> audits/evidence/p3/prayer/verify-tap-before-ready-1.json (+ PNGs)
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const HOLD = 4000;
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v)); };
const state = f => f.evaluate(() => ({
  Ddefined: typeof D !== 'undefined' && D !== undefined,
  activeList: (typeof D !== 'undefined' && D) ? D.activeList : null,
  screen: (document.querySelector('.screen.on') || {}).id || null,
  screensOn: [...document.querySelectorAll('.screen.on')].map(s => s.id),
  fabOn: document.getElementById('fab').classList.contains('on'),
  fabVisible: getComputedStyle(document.getElementById('fab')).display !== 'none',
  switchPressed: [...document.querySelectorAll('#listSwitch [data-list]')].map(b => b.dataset.list + ':' + b.getAttribute('aria-pressed')),
  navCurrent: [...document.querySelectorAll('nav button')].filter(b => b.getAttribute('aria-current') === 'true').map(b => b.dataset.go),
  todayLine: (document.getElementById('todayLine') || {}).textContent || '',
}));
try {
  // ── A: pulls held ──
  {
    const ph = await L.newDevice({ name: 'Verify spare A', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', as: ph });
    let held = 0;
    await d.ctx.route(u => /\/api\/data\/prayer\?/.test(u.href), async r => { held++; await sleep(HOLD); r.continue().catch(() => {}); });
    const t0 = Date.now();
    await d.goto('#prayer');
    let f; for (let i = 0; i < 80 && !(f = d.frame('prayer')); i++) await sleep(100);
    await f.waitForSelector('#listSwitch');
    await sleep(400);
    log('A0-beforeTaps', { ms: Date.now() - t0, held, ...(await state(f)) });
    const e0 = d.logs.length;
    await f.click('#listSwitch [data-list="shared"]', { timeout: 3000 }).catch(e => log('A1-clickErr', String(e).slice(0, 200)));
    await sleep(200);
    log('A1-afterFamilyTap', { ms: Date.now() - t0, newErrors: d.logs.slice(e0).filter(l => l.startsWith('pageerror')), ...(await state(f)) });
    const e1 = d.logs.length;
    await f.click('nav [data-go="answered"]', { timeout: 3000 }).catch(e => log('A2-clickErr', String(e).slice(0, 200)));
    await sleep(300);
    log('A2-afterRecordTap', { ms: Date.now() - t0, newErrors: d.logs.slice(e1).filter(l => l.startsWith('pageerror')), ...(await state(f)) });
    await d.shot(`${OUT}/verify-tap-before-ready-1-A-record-before-load.png`);
    await sleep(HOLD + 2500);
    log('A3-afterLoad', { ms: Date.now() - t0, allPageErrors: d.logs.filter(l => l.startsWith('pageerror')), ...(await state(f)) });
    await d.shot(`${OUT}/verify-tap-before-ready-1-A-after-load.png`);
    await d.close();
  }
  // ── B: control, no hold; same taps after the app has loaded ──
  {
    const ph = await L.newDevice({ name: 'Verify spare B', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', as: ph });
    const f = await d.openApp('prayer', { wait: '#todayLine' });
    await f.waitForFunction(() => typeof D !== 'undefined' && D, null, { timeout: 10000 }); await sleep(500);
    await f.click('#listSwitch [data-list="shared"]'); await sleep(300);
    const afterFamily = await state(f);
    await f.click('nav [data-go="answered"]'); await sleep(300);
    log('B-control', { afterFamily, afterRecord: await state(f), pageErrors: d.logs.filter(l => l.startsWith('pageerror')) });
    await d.close();
  }
} catch (e) { console.error(e); res.error = String(e.stack || e); }
finally { fs.writeFileSync(`${OUT}/verify-tap-before-ready-1.json`, JSON.stringify(res, null, 1)); await L.close(); }
