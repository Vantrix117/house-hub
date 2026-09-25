#!/usr/bin/env node
// Phase 4 ACCENT skeptic #2 — "An admin recolour never reaches a person who is already signed in".
// Independent: a different person (Dad), device (iPhone PWA), engine (Chromium) and colour (#2E7D5B). Dad is signed in;
// the admin recolours him via PUT /api/admin/profiles/dad (worker/src/index.js:453). On Dad's phone we read, after
// hub.pull(), a full reload, 35 s of timed pulls, hub.profiles() and an app frame (timer): --accent on <html>
// (hub.js:80), hub.profile.color, hub.people() colour, the computed colour of the selected tab bar item, and Dad's
// Home feed-line --tint. We also count GET /api/me requests. Control: a fresh device's picker card tint.
//   node audits/tools/phase4/ACCENT/verify-recolour-not-propagated-2.mjs
//     → audits/evidence/p4/ACCENT/verify-recolour-not-propagated-2.json (+ -home.png)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p4/ACCENT');
const TAG = 'verify-recolour-not-propagated-2';
const NEW = '#2E7D5B';
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const res = { person: 'dad', device: 'iphone-pwa', engine: 'chromium', newColour: NEW, steps: {} };
try {
  const d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'dad', fixedTime: false });
  let meCalls = 0, pulls = 0;
  d.page.on('request', r => { const u = r.url(); if (/\/api\/me(\?|$)/.test(u)) meCalls++; if (/\/api\/(data|sync|pull)/.test(u)) pulls++; });
  await d.goto('#home'); await sleep(2500);
  const read = (page = d.page) => page.evaluate(() => {
    const root = document.documentElement, me = window.hub && hub.profile;
    const mine = ((window.hub && hub.people && hub.people()) || []).find(p => p.id === (me && me.id));
    const sel = document.querySelector('.tabbar [aria-selected="true"], .tabbar .active, .tabbar [aria-current="page"]');
    const feed = [...document.querySelectorAll('.feed li, #feed li')].filter(li => /\bDad\b|\bDavid\b/.test(li.textContent)).map(li => li.style.getPropertyValue('--tint'));
    return { accent: root.style.getPropertyValue('--accent') || getComputedStyle(root).getPropertyValue('--accent').trim(),
      hubProfileColour: me && me.color, peopleColour: mine && mine.color,
      selectedTabColour: sel ? getComputedStyle(sel).color : null, dadFeedTints: [...new Set(feed)] };
  });
  res.steps.before = await read();
  const r = await L.apiAs('eli', '/api/admin/profiles/dad', { method: 'PUT', body: { color: NEW } });
  res.adminPut = { status: r.status, colour: r.body && r.body.profile && r.body.profile.color };
  const me = await L.apiAs('dad', '/api/me');
  res.serverMe = me.body && me.body.profile && me.body.profile.color;
  await d.page.evaluate(() => window.hub && hub.pull && hub.pull()).catch(() => {}); await sleep(2000);
  res.steps.afterPull = await read();
  await d.page.reload({ waitUntil: 'load' }); await sleep(3000);
  res.steps.afterReload = await read();
  await sleep(35000);
  res.steps.after35s = await read();
  await d.page.evaluate(() => window.hub && hub.profiles && hub.profiles()).catch(() => {}); await sleep(1000);
  await d.goto('#me'); await sleep(800); await d.goto('#home'); await sleep(2500);
  res.steps.afterProfiles = await read();
  await d.page.screenshot({ path: path.join(OUT, `${TAG}-home.png`), scale: 'css' });
  const f = await d.openApp('timer'); await sleep(2500);
  res.steps.timerFrame = await f.evaluate(() => ({ accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), hubProfileColour: window.hub && hub.profile && hub.profile.color }));
  res.apiMeRequestsFromClient = meCalls;
  const d2 = await L.device({ device: 'iphone-pwa', profile: null, fixedTime: false });
  await d2.goto(''); await sleep(1500);
  res.control = { freshPickerTint: await d2.page.evaluate(() => { const b = document.querySelector('.pcard[data-id="dad"]'); return b && b.style.getPropertyValue('--tint'); }) };
} catch (e) { res.error = String(e && e.stack || e); }
finally { await L.close(); }
fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
