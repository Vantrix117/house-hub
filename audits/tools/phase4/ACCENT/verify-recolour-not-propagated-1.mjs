#!/usr/bin/env node
// Phase 4 ACCENT skeptic #1 — "An admin recolour never reaches a person who is already signed in".
// Independent re-run: Mae (christian) signed in on the Kitchen iPad (WebKit, light). The admin recolours her to a
// different swatch (#5B6FA8, not the investigator's plum) with PUT /api/admin/profiles/christian. On Mae's iPad we read,
// after each of: an explicit hub.pull(), a visibilitychange, a full reload, 35 s of timed pulls, and hub.profiles():
//   --accent inline on <html> (hub.js:80), hub.profile.color, the stored hub.session profile colour (localStorage),
//   hub.people() colour for Mae, the computed background of an accent-driven element, Mae's feed-line --tint on Home.
// Then an app frame (tally) and the signed-out picker as control.
//   node audits/tools/phase4/ACCENT/verify-recolour-not-propagated-1.mjs
//     → audits/evidence/p4/ACCENT/verify-recolour-not-propagated-1.json (+ -home.png, -tally.png)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p4/ACCENT');
const TAG = 'verify-recolour-not-propagated-1';
const NEW = '#5B6FA8';
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const res = { newColour: NEW, steps: {}, requests: {} };
try {
  const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'christian', fixedTime: false });
  const meReq = [];
  d.page.on('request', r => { if (/\/api\/me(\?|$)/.test(r.url())) meReq.push(r.url()); });
  await d.goto('#home'); await sleep(2500);
  const read = async (page = d.page) => page.evaluate(() => {
    const root = document.documentElement;
    let stored = null; try { stored = JSON.parse(localStorage.getItem('hub.session')).profile.color; } catch {}
    const me = window.hub && hub.profile;
    const ppl = (window.hub && hub.people && hub.people()) || [];
    const mine = ppl.find(p => p.id === (me && me.id));
    // an element whose background is var(--accent): probe
    const probe = document.createElement('div'); probe.style.background = 'var(--accent)'; document.body.appendChild(probe);
    const probeBg = getComputedStyle(probe).backgroundColor; probe.remove();
    const feed = [...document.querySelectorAll('.feed li, #feed li')].filter(li => /\bMae\b/.test(li.textContent)).map(li => li.style.getPropertyValue('--tint'));
    return { accentInline: root.style.getPropertyValue('--accent'), accentComputed: getComputedStyle(root).getPropertyValue('--accent').trim(), probeBg,
      hubProfileColour: me && me.color, storedSessionColour: stored, peopleColour: mine && mine.color, maeFeedTints: [...new Set(feed)] };
  });
  res.steps.before = await read();
  const put = await L.apiAs('eli', '/api/admin/profiles/christian', { method: 'PUT', body: { color: NEW } });
  res.requests.adminPut = { status: put.status, colour: put.body && put.body.profile && put.body.profile.color };
  const me = await L.apiAs('christian', '/api/me');
  res.requests.serverMe = { status: me.status, colour: me.body && me.body.profile && me.body.profile.color };
  await d.page.evaluate(() => hub.pull()); await sleep(800);
  res.steps.afterExplicitPull = await read();
  await d.page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); }); await sleep(1500);
  res.steps.afterVisibility = await read();
  await d.page.reload({ waitUntil: 'load' }); await sleep(3000);
  res.steps.afterReload = await read();
  await sleep(35000);
  res.steps.after35s = await read();
  await d.page.evaluate(() => hub.profiles()).catch(e => String(e));
  await d.goto('#me'); await sleep(800); await d.goto('#home'); await sleep(2500);
  res.steps.afterProfilesRefresh = await read();
  await d.page.screenshot({ path: path.join(OUT, TAG + '-home.png'), scale: 'css' });
  const f = await d.openApp('tally'); await sleep(2500);
  res.steps.tallyFrame = await f.evaluate(() => ({ accentInline: document.documentElement.style.getPropertyValue('--accent'), accentComputed: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), hubProfileColour: window.hub && hub.profile && hub.profile.color }));
  await d.page.screenshot({ path: path.join(OUT, TAG + '-tally.png'), scale: 'css' });
  res.requests.apiMeCallsFromClient = meReq.length;
  // control: the picker on a signed-out device (the real client path: GET /api/profiles). The rig pre-signed sessions
  // (lib/local.mjs:113, S.sessions cached at start-up) carry the old colour, so they are not a valid control.
  const d2 = await L.device({ device: "iphone-pwa", mode: "light", profile: null, fixedTime: false });
  await d2.goto(""); await sleep(2000);
  res.control = { pickerTint: await d2.page.evaluate(() => { const b = document.querySelector(".pcard[data-id=\"christian\"]"); return b && b.style.getPropertyValue("--tint"); }) };
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, TAG + '.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
