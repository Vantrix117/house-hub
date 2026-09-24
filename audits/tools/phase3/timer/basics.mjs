// Timer basics on the local rig (WebKit, real clock, typical seed), driven through the real UI:
//  A taps from Home to a running timer (adult), B DOM measurements (type, targets, thumb zone), C a preset tap while running,
//  D pause -> leave -> come back, E the done state's dial shape, F accent per profile.
// Run: node "audits/tools/phase3/timer/basics.mjs"   Output: audits/evidence/p3/timer/basics.json + PNGs
import { local, sleep } from '../../lib/local.mjs';
import { shot, save, appState, pillState, serverTimer, audioProbe } from './_util.mjs';
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await audioProbe(d.ctx);
  const page = d.page;
  await d.goto('#home'); await sleep(1500);
  // A. Home has no timer card; count taps
  out.homeTimerControls = await page.evaluate(() => [...document.querySelectorAll('#view-home [data-open="timer"], #view-home [data-id="timer"]')].length);
  let taps = 0;
  await page.click('.tab[data-tab="apps"]'); taps++;
  await page.click('.tile[data-id="timer"]'); taps++;
  let f; for (let i = 0; i < 50 && !(f = d.frame('timer')); i++) await sleep(100);
  await f.waitForFunction(() => window.hub && document.getElementById('go'));
  await sleep(800);
  out.A_opened = await appState(f);
  // B. measurements (iPhone 430x932)
  out.B_measure = await f.evaluate(() => {
    const box = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const cs = el => getComputedStyle(el);
    const q = s => document.querySelector(s);
    const btns = [...document.querySelectorAll('button')].map(b => ({ text: b.textContent.trim(), ...box(b), fontSize: cs(b).fontSize, weight: cs(b).fontWeight }));
    return { viewport: [innerWidth, innerHeight], time: { ...box(q('#t')), fontSize: cs(q('#t')).fontSize, weight: cs(q('#t')).fontWeight, family: cs(q('#t')).fontFamily },
      h1: { ...box(q('.hd h1')), fontSize: cs(q('.hd h1')).fontSize, family: cs(q('.hd h1')).fontFamily, display: cs(q('.hd')).display },
      dial: box(q('#dial')), ringStroke: cs(q('.ring .fg')).strokeWidth, btns,
      ariaLive: document.querySelectorAll('[aria-live]').length, ariaPressed: document.querySelectorAll('[aria-pressed]').length };
  });
  out.B_measure.frameTop = await page.evaluate(() => Math.round(document.getElementById('frame').getBoundingClientRect().y));
  await shot(page, 'basics-idle-iphone-light.png');
  // start the last preset
  await f.click('#go'); taps++;
  out.A_tapsToRunningLastPreset = taps;   // Apps + tile + Start
  await sleep(2200);
  out.A_running = await appState(f); await page.evaluate(() => 0);
  await sleep(600); out.A_server = await serverTimer(L, 'eli');
  // C. one tap on a preset chip while the countdown runs
  const beforeC = await appState(f);
  await f.click('[data-s="180"]');
  await sleep(1500);
  out.C_presetWhileRunning = { before: beforeC, after: await appState(f), server: await serverTimer(L, 'eli') };
  // D. start 3 min, pause after ~3 s, leave to Home, come back
  await f.click('#go'); await sleep(3200); await f.click('#go');
  out.D_paused = await appState(f); await sleep(1200); out.D_serverAfterPause = await serverTimer(L, 'eli');
  await shot(page, 'basics-paused-iphone-light.png');
  await page.click('#pill-home'); await sleep(600);
  await page.click('.tab[data-tab="home"]'); await sleep(800);
  out.D_homePill = await pillState(page);
  await page.click('.tab[data-tab="apps"]'); await page.click('.tile[data-id="timer"]'); await sleep(300);
  f = d.frame('timer'); await f.waitForFunction(() => window.hub && document.getElementById('go')); await sleep(800);
  out.D_reopened = await appState(f);
  // E. done state: a 4 s timer written as Eli (same shape the app writes), app open
  const now = Date.now();
  await L.apiAs('eli', '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer.active', value: { endAt: now + 5000, total: 60, startedAt: now - 55000 }, updated_at: now }] } });
  await page.evaluate(() => hub.pull()); await f.evaluate(() => hub.pull()); await sleep(1200);
  out.E_runningDial = { state: await appState(f), dial: await f.evaluate(() => { const r = document.getElementById('dial').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), padding: getComputedStyle(document.getElementById('dial')).padding }; }) };
  await sleep(6000);
  out.E_done = { state: await appState(f), dial: await f.evaluate(() => { const el = document.getElementById('dial'); const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), padding: getComputedStyle(el).padding, classes: el.className, text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 120) }; }), server: await serverTimer(L, 'eli'), shellToast: await page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; }) };
  await shot(page, 'basics-done-iphone-light.png');
  // F. accent per profile (frame computed tokens), and the dial time colour
  const acc = async pid => { const dd = await L.device({ device: 'iphone-pwa', profile: pid, fixedTime: false }); const ff = await dd.openApp('timer', { wait: '#go' }); await sleep(1200);
    const r = await ff.evaluate(() => { const s = getComputedStyle(document.documentElement); return { accent: s.getPropertyValue('--accent').trim(), accentStrong: s.getPropertyValue('--accent-strong').trim(), kind: document.documentElement.dataset.kind || null, timeColor: getComputedStyle(document.getElementById('t')).color, profile: hub.profile && hub.profile.name }; });
    r.state = await appState(ff); await dd.close(); return r; };
  out.F_accent = { eli: await acc('eli'), mom: await acc('mom'), ezra: await acc('ezra') };
} finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('basics.json', out));
