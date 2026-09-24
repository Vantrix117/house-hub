// Skeptic #2 (lens: intent and context) for critic-heard-stale-device-drops-heard-day-2:
// "I heard it" on a kid's second device holding an older copy of the story row erases the other device's heard day.
//   node "audits/tools/phase3/kidverse/verify-critic-heard-stale-device-drops-heard-day-2-2.mjs"            both arms (~1 min)
//   node "audits/tools/phase3/kidverse/verify-critic-heard-stale-device-drops-heard-day-2-2.mjs" stale|control
// Independent of the investigator's script: the phone's clock is moved with clock.setSystemTime (not fastForward), the
// server rows are read raw with L.apiAs, and an ADULT (Mom) reads the family row + F260's "Kids:" line afterwards.
// stale:   Ezra's phone (second paired device) opens Kid Verse Thu 24 Sep 17:00 NY, pulls, goes offline.
//          Kitchen iPad (Ezra) Fri 25 Sep 17:00 taps "I heard it". Phone clock -> Sat 26 Sep 17:00, taps "I heard it"
//          while still offline, then reconnects. iPad pulls; Mom reads the rows.
// control: same, but the phone stays online and pulls before its Saturday tap.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits', 'evidence', 'p3', 'kidverse');
const PFX = 'verify-critic-heard-stale-device-drops-heard-day-2-2';
fs.mkdirSync(EV, { recursive: true });
const NY = s => Date.parse(s);
const log = (...a) => console.log(...a);

async function rawRow(L, as, scope, key) {
  const r = await L.apiAs(as, `/api/data/kidverse?scope=${scope}&key=${encodeURIComponent(key)}`);
  const it = r.body && r.body.item; return it ? { value: it.value, updated_at: it.updated_at } : null;
}
const days = r => r && r.value && r.value.days ? Object.keys(r.value.days).sort() : null;
async function server(L) {
  const p = await rawRow(L, 'ezra', 'person', 'story'), f = await rawRow(L, 'mom', 'family', 'story:ezra'), st = await rawRow(L, 'ezra', 'person', 'stars');
  const sv = st && st.value;
  return { personDays: days(p), personWeek: p && p.value && p.value.week, familyDays: days(f), familyWeek: f && f.value && f.value.week,
    stars: sv ? { total: sv.total, earned: sv.earned, creditedStoryW39: Object.keys(sv.credited?.story || {}).filter(k => k >= '2026-09-21').sort() } : null };
}
async function waitFor(f, fn, ms = 15000) { const u = Date.now() + ms; while (Date.now() < u) { if (await f.evaluate(fn).catch(() => false)) return true; await sleep(200); } return false; }
const hasPulled = f => waitFor(f, () => !!(window.hub && hub.sync && hub.sync.lastPull));
const isFlushed = f => waitFor(f, () => window.hub && hub.sync.state === 'synced' && !Object.keys(localStorage).some(k => k.startsWith('hub.queue.') && Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length));
const storyUi = f => f.evaluate(() => { const t = s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  return { heard: t('#story-heard'), heardDisabled: !!(document.querySelector('#story-heard') || {}).disabled, sub: t('#story-sub'), sync: window.hub && hub.sync.state, now: new Date().toString().slice(0, 24) }; });

async function arm(name) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const o = { arm: name };
  try {
    o.s0 = await server(L);
    const dev = await L.newDevice({ name: 'Ezra second phone ' + name, profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: NY('2026-09-24T17:00:00-04:00'), as: dev });
    const fp = await phone.openApp('kidverse', { wait: '#story-heard:not([hidden])' });
    await hasPulled(fp); await sleep(1500); await isFlushed(fp);
    o.phoneThu = await storyUi(fp);
    if (name === 'stale') await phone.setOffline(true);

    const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: NY('2026-09-25T17:00:00-04:00') });
    const fi = await ipad.openApp('kidverse', { wait: '#story-heard:not([hidden])' });
    await hasPulled(fi); await sleep(1500);
    await fi.click('#story-heard'); await sleep(800); await isFlushed(fi);
    o.s1_ipadFri = { server: await server(L), ipad: await storyUi(fi) };

    await phone.ctx.clock.setSystemTime(new Date(NY('2026-09-26T17:00:00-04:00'))); await sleep(800);
    if (name === 'control') { await fp.evaluate(() => hub.pull()); await sleep(2000); }
    o.phoneBeforeTap = await storyUi(fp);
    await fp.click('#story-heard'); await sleep(1000);
    o.phoneAfterTap = await storyUi(fp);
    if (name === 'stale') await phone.setOffline(false);
    await sleep(2500); await isFlushed(fp);
    o.s2_phoneSat = await server(L);

    await fi.evaluate(() => hub.pull()); await sleep(2500); await isFlushed(fi);
    o.s3_ipadPulled = { server: await server(L), ipad: await storyUi(fi) };
    await fi.evaluate(() => document.querySelector('#story').scrollIntoView({ block: 'start' }));
    const png = path.join(EV, `${PFX}-${name}-ipad-after-pull.png`);
    await ipad.page.screenshot({ path: png, scale: 'css', animations: 'disabled' }); o.shot = path.relative(ROOT, png).replace(/\\/g, '/');

    // An adult on another device, Saturday: what F260's "Kids:" line reads from the family row.
    const mom = await L.device({ device: 'iphone-pwa', profile: 'mom', installClock: NY('2026-09-26T19:00:00-04:00') });
    const fm = await mom.openApp('f260'); await hasPulled(fm); await sleep(2500);
    o.momF260 = await fm.evaluate(() => { const e = document.getElementById('todayKids'); return e ? { text: e.textContent.trim(), hidden: e.hidden } : null; });
    o.s4_final = await server(L);
    await mom.close(); await ipad.close(); await phone.close();
  } finally { await L.close(); }
  const sm = s => JSON.stringify({ person: s.personDays, family: s.familyDays, week: s.familyWeek, stars: s.stars });
  log(`[${name}] start           `, sm(o.s0));
  log(`[${name}] phone Thu ui    `, JSON.stringify(o.phoneThu));
  log(`[${name}] iPad Fri heard  `, sm(o.s1_ipadFri.server), JSON.stringify(o.s1_ipadFri.ipad));
  log(`[${name}] phone before tap`, JSON.stringify(o.phoneBeforeTap));
  log(`[${name}] phone after tap `, JSON.stringify(o.phoneAfterTap));
  log(`[${name}] server after ph `, sm(o.s2_phoneSat));
  log(`[${name}] iPad after pull `, sm(o.s3_ipadPulled.server), JSON.stringify(o.s3_ipadPulled.ipad));
  log(`[${name}] Mom F260 Kids   `, JSON.stringify(o.momF260));
  log(`[${name}] final           `, sm(o.s4_final));
  return o;
}

const which = process.argv[2] ? [process.argv[2]] : ['stale', 'control'];
const res = {};
for (const w of which) res[w] = await arm(w);
const out = path.join(EV, PFX + (process.argv[2] ? '-' + process.argv[2] : '') + '.json');
fs.writeFileSync(out, JSON.stringify(res, null, 1));
log('wrote', path.relative(ROOT, out).replace(/\\/g, '/'));
