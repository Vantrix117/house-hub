#!/usr/bin/env node
// Phase 4 ACCENT — does an admin recolour reach a person who is already signed in on another device?
// Mae (christian, #BC5A38) is signed in on the Kitchen iPad. The admin changes her colour to the plum swatch (#8C4F7A,
// index.html:449) through the real admin route (PUT /api/admin/profiles/:id, worker/src/index.js:453). Then, on Mae's
// iPad: (A) a full reload, (B) a Home visit after the profiles list is refreshed, (C) 35 s of waiting (the 30 s pull),
// and in each state read: her --accent on <html> (hub.js:80, from hub.session.profile), the colour hub.people() holds for
// her (the faces/feed source), and the --tint of her own feed line and avatar on Home. An app frame is checked too.
//
//   node audits/tools/phase4/ACCENT/recolour.mjs   → audits/evidence/p4/ACCENT/recolour.json (+ 2 PNGs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p4/ACCENT');
const NEW = '#8C4F7A';
const L = await local({ variant: 'typical', clock: 'real' });
const res = { newColour: NEW, steps: {} };
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'christian', fixedTime: false });
  await d.goto('#home'); await sleep(2500);
  const read = async () => d.page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const me = window.hub && hub.profile;
    const ppl = (window.hub && hub.people()) || [];
    const mine = ppl.find(p => p.id === (me && me.id));
    const feed = [...document.querySelectorAll('.feed li, #feed li')].filter(li => li.textContent.includes('Mae')).map(li => li.style.getPropertyValue('--tint'));
    return { accentInline: document.documentElement.style.getPropertyValue('--accent'), accentComputed: cs.getPropertyValue('--accent').trim(), sessionColour: me && me.color, peopleColour: mine && mine.color, feedTints: [...new Set(feed)].slice(0, 3) };
  });
  res.steps.before = await read();
  const r = await L.apiAs('eli', '/api/admin/profiles/christian', { method: 'PUT', body: { color: NEW } });
  res.adminPut = { status: r.status, colour: r.body && (r.body.profile ? r.body.profile.color : r.body.color) };
  const srv = await L.apiAs('christian', '/api/me');
  res.serverMe = srv.body && srv.body.profile && srv.body.profile.color;
  await d.page.reload({ waitUntil: 'load' }); await sleep(3000);
  res.steps.afterReload = await read();
  await sleep(35000);
  res.steps.after35s = await read();
  await d.page.evaluate(() => window.hub && hub.profiles && hub.profiles()).catch(() => {});
  await d.goto('#me'); await sleep(800); await d.goto('#home'); await sleep(2500);
  res.steps.afterProfilesRefresh = await read();
  await d.page.screenshot({ path: path.join(OUT, 'recolour-mae-home-after.png'), scale: 'css' });
  const f = await d.openApp('tally'); await sleep(2500);
  res.steps.tallyFrame = await f.evaluate(() => ({ accentComputed: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), sessionColour: window.hub && hub.profile && hub.profile.color }));
  await d.page.screenshot({ path: path.join(OUT, 'recolour-mae-tally-after.png'), scale: 'css' });
  // control: a fresh sign-in picks the new colour up
  const d2 = await L.device({ device: 'iphone-pwa', profile: null, fixedTime: false });
  await d2.goto(''); await sleep(1500);
  res.control = { pickerTint: await d2.page.evaluate(() => { const b = document.querySelector('.pcard[data-id="christian"]'); return b && b.style.getPropertyValue('--tint'); }) };
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'recolour.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
