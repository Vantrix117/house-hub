// Kid, kiosk and guest use of the Kitchen timer (local rig, WebKit, typical seed, real clock), through the real UI.
//  K  Ezra (kid) on the iPhone and iPad: taps from kid Home, what the controls say and how big they are, a full kid flow.
//  T  The TV (kiosk): does the launcher offer the timer; the standalone page opened on the TV: Start / preset / server.
//  G  Guest Grandma Jo: taps from Home and a start.
// Run: node "audits/tools/phase3/timer/audience.mjs"   Output: audits/evidence/p3/timer/audience.json + PNGs
import { local, sleep } from '../../lib/local.mjs';
import { save, shot, appState, serverTimer } from './_util.mjs';
const out = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const measure = f => f.evaluate(() => {
  const box = el => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) }; };
  return { kind: document.documentElement.dataset.kind, timeFont: getComputedStyle(document.getElementById('t')).fontSize,
    buttons: [...document.querySelectorAll('button')].map(b => ({ label: b.textContent.trim(), hasIcon: !!b.querySelector('svg,img'), ...box(b), font: getComputedStyle(b).fontSize })),
    images: [...document.querySelectorAll('img,svg')].map(i => i.getAttribute('src') || i.getAttribute('class')) };
});
try {
  for (const device of ['iphone-pwa', 'ipad-portrait']) {
    const d = await L.device({ device, profile: 'ezra', fixedTime: false });
    await d.goto('#home'); await sleep(1500);
    const home = await d.page.evaluate(() => ({ timerOnHome: document.querySelectorAll('#view-home [data-open="timer"], #view-home [data-id="timer"]').length, tabs: [...document.querySelectorAll('.tab')].filter(t => t.offsetParent).map(t => t.textContent.trim()) }));
    let taps = 0;
    await d.page.click('.tab[data-tab="apps"]'); taps++;
    const tiles = await d.page.evaluate(() => [...document.querySelectorAll('.tile')].map(t => ({ id: t.dataset.id, label: t.textContent.trim() })));
    await d.page.click('.tile[data-id="timer"]'); taps++;
    let f; for (let i = 0; i < 60 && !(f = d.frame('timer')); i++) await sleep(100);
    await f.waitForFunction(() => window.hub && hub.profile && document.getElementById('go')); await sleep(900);
    const m = await measure(f);
    const s0 = await shot(d.page, `audience-kid-idle-${device}.png`);
    await f.click('[data-s="60"]'); taps++; await f.click('#go'); taps++;
    await sleep(2200);
    out['K_' + device] = { home, tiles, measure: m, tapsToRunning1min: taps, running: await appState(f), server: await serverTimer(L, 'ezra'), shots: [s0, await shot(d.page, `audience-kid-running-${device}.png`)] };
    await f.click('#reset'); await sleep(800); await d.close();
  }
  // TV kiosk
  { const d = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
    await d.goto('#home'); await sleep(2000);
    const launcher = await d.page.evaluate(() => ({ tiles: document.querySelectorAll('.tile').length, pillShown: !document.getElementById('timer-pill').hidden }));
    await d.goto('#timer'); await sleep(1500);
    const viaHash = await d.page.evaluate(() => ({ viewerOn: document.getElementById('viewer').classList.contains('on'), frameSrc: document.getElementById('frame').getAttribute('src') }));
    await d.page.goto(L.site + '/apps/timer.html'); await d.page.waitForFunction(() => window.hub && hub.profile); await sleep(1500);
    const f = d.page.mainFrame();
    const idle = await appState(f); const canWrite = await d.page.evaluate(() => hub.canWrite);
    await d.page.click('[data-s="180"]'); await d.page.click('#go'); await sleep(2200);
    const running = await appState(f);
    const toast = await d.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
    const pending = await d.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hub.queue.')).map(k => [k, localStorage.getItem(k)]));
    out.T_kiosk = { launcher, viaHash, standalone: { canWrite, idle, running, toast, queue: pending, server: await serverTimer(L, 'tv').catch(e => String(e)) }, shot: await shot(d.page, 'audience-kiosk-standalone-tv.png') };
    await d.close(); }
  // Guest (Grandma Jo)
  { const d = await L.device({ device: 'ipad-portrait', profile: 'guest-grandmajo', fixedTime: false });
    await d.goto('#home'); await sleep(1500);
    let taps = 0; await d.page.click('.tab[data-tab="apps"]'); taps++;
    const hasTile = await d.page.$('.tile[data-id="timer"]');
    if (hasTile) { await hasTile.click(); taps++;
      let f; for (let i = 0; i < 60 && !(f = d.frame('timer')); i++) await sleep(100);
      await f.waitForFunction(() => window.hub && hub.profile && document.getElementById('go')); await sleep(900);
      const idle = await appState(f); await f.click('#go'); taps++; await sleep(1500);
      out.G_guest = { tapsToRunningDefault: taps, idle, running: await appState(f), server: await serverTimer(L, 'guest-grandmajo') };
      await f.click('#reset'); } else out.G_guest = { tile: false };
    await d.close(); }
} finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
console.log('saved', save('audience.json', out));
