// PROF (audit Phase 2), brief items 1-3: the profile picker per device, offline and error pickers, first-tap PIN
// creation (Mea), PIN entry, wrong PINs and the lockout, keyboard use. Local rig only (typical seed, real clock).
//
//   node "audits/tools/phase2/PROF/picker-pin.mjs"
//
// Evidence: audits/evidence/p2/PROF/picker-*.png, pin-*.png and picker-pin.json.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PROF');
fs.mkdirSync(OUT, { recursive: true });
const shot = async (d, name) => { const f = path.join(OUT, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, f); };
const R = {};
const log = (k, v) => { console.log(k.padEnd(46), typeof v === 'string' ? v : JSON.stringify(v)); };
const L = await local({ variant: 'typical', clock: 'real' });

const measurePicker = page => page.evaluate(() => {
  const g = document.getElementById('gate'), h1 = document.querySelector('.gate-title h1'), who = document.querySelector('.gate-title p');
  g.scrollTop = 0; const top0 = h1.getBoundingClientRect().top;
  g.scrollTop = -500; const minTop = g.scrollTop;
  const cards = [...document.querySelectorAll('#profiles .pcard')].map(b => { const r = b.getBoundingClientRect(); return { id: b.dataset.id, w: Math.round(r.width), h: Math.round(r.height), sub: b.querySelector('.psub').textContent, subPx: parseFloat(getComputedStyle(b.querySelector('.psub')).fontSize) }; });
  g.scrollTop = g.scrollHeight; const last = document.querySelector('#profiles .pcard:last-child').getBoundingClientRect();
  const out = { viewportH: innerHeight, gateClient: g.clientHeight, gateScroll: g.scrollHeight, h1TopAtScroll0: Math.round(top0), whoTopAtScroll0: Math.round(who.getBoundingClientRect().top + (0)), minScrollTop: minTop,
    lastCardBottomAtEnd: Math.round(last.bottom), cards: cards.length, kioskCard: cards.some(c => c.id === 'tv'), guests: cards.filter(c => /^guest-/.test(c.id)).map(c => c.sub),
    minCard: cards.reduce((m, c) => ({ w: Math.min(m.w, c.w), h: Math.min(m.h, c.h) }), { w: 1e9, h: 1e9 }), subPx: cards[0] && cards[0].subPx, subs: Object.fromEntries(cards.map(c => [c.id, c.sub])) };
  g.scrollTop = 0; return out;
});

try {
  // ── 1. picker per device (signed out on the paired Kitchen iPad) ──
  R.picker = {};
  for (const dev of ['iphone-pwa', 'iphone-safari', 'ipad-portrait', 'ipad-landscape', 'desktop', 'tv']) {
    const d = await L.device({ device: dev, profile: null, fixedTime: false });
    await d.goto(''); await d.page.waitForSelector('#profiles .pcard[data-id]', { timeout: 15000 }); await sleep(600);
    const m = await measurePicker(d.page);
    R.picker[dev] = m;
    log(`1. picker ${dev}`, `h1 top @scroll0=${m.h1TopAtScroll0}px, "Who's this?" top=${m.whoTopAtScroll0}px, scrollTop can go to ${m.minScrollTop}, gate ${m.gateClient}/${m.gateScroll}, cards=${m.cards} (min ${m.minCard.w}×${m.minCard.h}, sub ${m.subPx}px), kiosk card=${m.kioskCard}, guests=${JSON.stringify(m.guests)}`);
    if (dev === 'iphone-pwa' || dev === 'tv') R[dev + 'Shot'] = await shot(d, `picker-${dev}.png`);
    await d.close();
  }
  log('1. card sub-labels (iPad, last profile = null)', R.picker['ipad-portrait'].subs);
  // overflow names on the iPhone
  await L.reset('overflow');
  { const d = await L.device({ device: 'iphone-pwa', profile: null, fixedTime: false }); await d.goto(''); await d.page.waitForSelector('#profiles .pcard[data-id]'); await sleep(600);
    const m = await measurePicker(d.page); R.picker['iphone-pwa-overflow'] = m;
    log('1. picker iphone-pwa overflow', `h1 top @scroll0=${m.h1TopAtScroll0}px, "Who's this?" top=${m.whoTopAtScroll0}px, cards=${m.cards}, guests shown=${m.guests.length}`);
    await d.close(); }
  await L.reset('typical');

  // ── 1b. offline picker (cached list) and error picker (no cache) ──
  { const d = await L.device({ device: 'iphone-pwa', profile: null, fixedTime: false });
    await d.goto(''); await d.page.waitForSelector('#profiles .pcard[data-id]'); await d.setOffline(true);
    await d.goto(''); await d.page.waitForSelector('#profiles .pcard[data-id]', { timeout: 15000 }); await sleep(800);
    log('1b. offline picker: message before any tap', JSON.stringify(await d.page.textContent('#pickmsg')));
    await d.page.click('#profiles .pcard[data-id="ezra"]'); await sleep(1500);
    log('1b. offline: tap Ezra →', JSON.stringify(await d.page.textContent('#pickmsg')) + `  (still on picker: ${await d.page.isVisible('#profiles')})`);
    await d.page.click('#profiles .pcard[data-id="mom"]'); await sleep(500);
    log('1b. offline: tap Elizabeth (PIN) →', (await d.page.isVisible('#pad')) ? 'PIN pad opens offline' : 'no pad');
    if (await d.page.isVisible('#pad')) { for (const k of '1234') await d.page.keyboard.press(k); await d.page.keyboard.press('Enter'); await sleep(1500); log('1b. offline: submit a PIN →', JSON.stringify(await d.page.textContent('#pinmsg'))); }
    R.offlineShot = await shot(d, 'picker-offline-after-tap-iphone.png');
    await d.close(); }
  { const d = await L.device({ device: 'iphone-pwa', profile: null, fixedTime: false, localStorage: { 'hub.profiles': '[]' } });
    await d.ctx.route(L.api + '/api/profiles', r => r.abort('internetdisconnected'));
    await d.goto(''); await sleep(2500);
    log('1b. no cache + /api/profiles fails', `msg=${JSON.stringify(await d.page.textContent('#pickmsg'))}, skeleton cards left=${await d.page.locator('#profiles .pcard.skeleton').count()}, retry button=${await d.page.locator('#gate button:not(.pcard)').count()}`);
    await d.close(); }

  // ── 2. first-tap PIN creation: Mea (no PIN yet), on the Kitchen iPad, nobody signed in ──
  { const d = await L.device({ device: 'ipad-portrait', profile: null, fixedTime: false }); const { page } = d;
    await d.goto(''); await page.waitForSelector('#profiles .pcard[data-id="niece"]'); await page.click('#profiles .pcard[data-id="niece"]');
    await page.waitForSelector('#pad');
    const padInfo = await page.evaluate(() => ({ title: document.querySelector('.pin-who h2').textContent, hint: document.getElementById('pinhint').textContent,
      nameShown: document.getElementById('gate').innerText.includes('Mea'), focus: document.activeElement && (document.activeElement.id || document.activeElement.tagName),
      keys: [...document.querySelectorAll('#pad .btn')].map(b => { const r = b.getBoundingClientRect(); return Math.round(r.width) + '×' + Math.round(r.height); }).slice(0, 3),
      go: (() => { const r = document.getElementById('pingo').getBoundingClientRect(); return Math.round(r.width) + '×' + Math.round(r.height); })() }));
    log('2. Mea: create pad', padInfo);
    for (const k of '1111') await page.click(`#pad [data-d="${k}"]`);
    const dot = await page.evaluate(() => { const i = document.querySelector('.pin-dots i.on'); return i ? getComputedStyle(i).backgroundColor : null; });
    log('2. filled dot colour (Mea is #5B8143 in seed)', dot + ' | --accent on <html>=' + JSON.stringify(await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))));
    R.createShot = await shot(d, 'pin-create-mea-ipad.png');
    await page.click('#pingo'); await sleep(300);
    log('2. after first entry: hint', await page.textContent('#pinhint'));
    for (const k of '1212') await page.click(`#pad [data-d="${k}"]`); await page.click('#pingo'); await sleep(300);
    log('2. mismatch: message / hint', `${await page.textContent('#pinmsg')} / ${await page.textContent('#pinhint')}`);
    R.mismatchShot = await shot(d, 'pin-create-mismatch-ipad.png');
    for (const k of '1111') await page.keyboard.press(k); await page.keyboard.press('Enter'); await sleep(300);
    for (const k of '1111') await page.keyboard.press(k); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.getElementById('shell').hidden, null, { timeout: 10000 });
    log('2. Mea signed in as', await page.evaluate(() => JSON.stringify({ id: hub.profile.id, kind: hub.profile.kind, apps: [...document.querySelectorAll('#grid .tile')].map(t => t.dataset.id) })));
    await d.close(); }
  // who can claim: a second paired device (the TV) with no session claims an adult whose PIN was just reset
  { await L.apiAs('eli', '/api/admin/profiles/dad/reset-pin', { method: 'POST', body: {} });
    const tvDev = await L.newDevice({ name: 'Downstairs TV (rig)', profiles: ['tv'] });
    const r = await L.apiAs(null, '/api/profiles/dad/pin', { method: 'POST', body: { pin: '9999' }, deviceToken: tvDev.device.token, profileToken: null });
    log('2. after Reset PIN on David: TV device (no profile) claims David', `${r.status} ${r.body.error || ('kind=' + r.body.profile.kind)}`);
    const again = await L.apiAs(null, '/api/profiles/dad/pin', { method: 'POST', body: { pin: '1234' }, deviceToken: tvDev.device.token, profileToken: null });
    log('2. David himself then tries to create his PIN', `${again.status} ${again.body.error}: ${again.body.message}`);
    const bad = []; for (let i = 0; i < 12; i++) bad.push((await L.apiAs(null, '/api/profiles/kiara/pin', { method: 'POST', body: { pin: '12' } })).status);
    log('2. 12 rapid create calls (bad input) — any 429?', bad.includes(429) ? 'yes' : `no (${[...new Set(bad)].join(',')})`); }

  // ── 3. PIN entry, wrong PINs, lockout, keyboard ──
  await L.apiAs('eli', '/api/admin/profiles/christian/reset-pin', { method: 'POST', body: {} });
  await L.apiAs(null, '/api/profiles/christian/pin', { method: 'POST', body: { pin: '2580' } });
  { const d = await L.device({ device: 'ipad-portrait', profile: null, fixedTime: false }); const { page } = d;
    await d.goto(''); await page.waitForSelector('#profiles .pcard[data-id="christian"]'); await page.click('#profiles .pcard[data-id="christian"]'); await page.waitForSelector('#pad');
    log('3. Mae pad title / hint', `${await page.textContent('.pin-who h2')} / ${await page.textContent('#pinhint')}`);
    await page.keyboard.press('Escape'); await sleep(300);
    log('3. Escape →', (await page.isVisible('#profiles')) ? 'back to the picker' : 'still on pad');
    await page.click('#profiles .pcard[data-id="christian"]'); await page.waitForSelector('#pad');
    const msgs = [];
    for (let i = 1; i <= 6; i++) {
      for (const k of '0000') await page.keyboard.press(k); await page.keyboard.press('Enter'); await sleep(700);
      msgs.push(`${i}: ${await page.textContent('#pinmsg')}`);
    }
    log('3. six wrong PINs (keyboard)', msgs);
    for (const k of '2580') await page.click(`#pad [data-d="${k}"]`); await page.click('#pingo'); await sleep(800);
    log('3. then the RIGHT PIN during the lockout', JSON.stringify(await page.textContent('#pinmsg')));
    log('3. pad state while locked', await page.evaluate(() => ({ digitsDisabled: [...document.querySelectorAll('#pad [data-d]')].filter(b => b.disabled).length, continueDisabled: document.getElementById('pingo').disabled, countdownShown: /\d+:\d\d/.test(document.getElementById('gate').innerText) })));
    for (const k of '12') await page.click(`#pad [data-d="${k}"]`);
    R.lockShot = await shot(d, 'pin-locked-ipad.png');
    await d.close(); }
  { const other = await L.newDevice({ name: "Mae's iPhone (rig)", profiles: [] });
    const r = await L.apiAs(null, '/api/login', { method: 'POST', body: { profile_id: 'christian', pin: '2580' }, deviceToken: other.device.token, profileToken: null });
    log('3. same time, another paired device, right PIN', `${r.status} ${r.body.error || 'signed in'}`); }
  fs.writeFileSync(path.join(OUT, 'picker-pin.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
