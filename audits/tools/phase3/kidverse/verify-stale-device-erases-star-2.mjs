// Skeptic #2 for "stale-device-erases-star" (Kid Verse): does a kid's second device holding an older copy of the whole
// `stars` row erase a verse star earned on the first device?
//   node "audits/tools/phase3/kidverse/verify-stale-device-erases-star-2.mjs"            all scenarios
//   node "audits/tools/phase3/kidverse/verify-stale-device-erases-star-2.mjs" race|offline|control
// race:    both online. Ezra's phone (second paired device) opens Kid Verse and pulls; the Kitchen iPad (Ezra) taps Done ★;
//          the phone taps "I heard it" before its next 30 s poll. The phone's lastPull is recorded to prove it had not pulled.
// offline: same, but the phone is offline from before the iPad's star until after its tap, then reconnects.
// control: same as race, but the phone pulls (hub.pull()) just before its tap.
// Then: the iPad pulls; what does it show; can the kid re-tap Done ★ today (re-earnable today, not for an earlier day)?
// Real clock, WebKit, local instance only. Evidence -> audits/evidence/p3/kidverse/verify-stale-device-erases-star-2*.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'kidverse');
fs.mkdirSync(EVID, { recursive: true });
const PFX = 'verify-stale-device-erases-star-2';
const dk = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

async function serverRow(L, profile, scope, key) {
  const r = await L.apiAs(profile, `/api/data/kidverse?scope=${scope}&key=${encodeURIComponent(key)}`);
  const it = r.body && r.body.item; if (!it || !it.value) return null;
  const v = it.value, today = dk();
  return { total: v.total, earned: v.earned, count: v.count, verseToday: v.days ? v.days[today] ?? null : null,
    storyToday: v.credited && v.credited.story ? v.credited.story[today] ?? null : null, updated_at: it.updated_at };
}
const both = async L => ({ person: await serverRow(L, 'ezra', 'person', 'stars'), mirror: await serverRow(L, 'eli', 'family', 'stars:ezra') });
async function waitFor(f, fn, ms = 15000) { const until = Date.now() + ms; while (Date.now() < until) { if (await f.evaluate(fn).catch(() => false)) return true; await sleep(150); } return false; }
const hasPulled = f => waitFor(f, () => !!(window.hub && hub.sync && hub.sync.lastPull));
const isFlushed = f => waitFor(f, () => window.hub && hub.sync.state === 'synced' && !Object.keys(localStorage).some(k => k.startsWith('hub.queue.') && Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length));
const view = f => f.evaluate(() => { const t = s => { const e = document.querySelector(s); return e && !e.hidden ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  return { done: t('#done'), pressed: document.querySelector('#done') && document.querySelector('#done').getAttribute('aria-pressed'), starCount: t('#star-count'), rwTotal: t('#rw-total'), rwEarned: t('#rw-earned'), heard: t('#story-heard') }; });

async function run(name) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const o = { name, today: dk(), steps: [] };
  const note = (k, v) => { o[k] = v; o.steps.push(k); console.log(`[${name}] ${k.padEnd(18)} ${JSON.stringify(v)}`); };
  try {
    note('s0_server', await both(L));
    const ph = await L.newDevice({ name: 'Second phone (Ezra)', profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: ph });
    const fp = await phone.openApp('kidverse', { wait: '#story-heard:not([hidden])' });
    await hasPulled(fp); await sleep(1200);
    const phonePull0 = await fp.evaluate(() => hub.sync.lastPull);
    note('phone_warm', await view(fp));
    if (name === 'offline') await phone.setOffline(true);

    const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
    const fi = await ipad.openApp('kidverse', { wait: '#done:not([hidden])' });
    await hasPulled(fi); await sleep(800);
    await fi.click('#done'); const tStar = Date.now(); await sleep(400); await isFlushed(fi);
    note('s1_after_ipad_star', await both(L));
    note('ipad_after_star', await view(fi));

    if (name === 'control') { await fp.evaluate(() => hub.pull()); await sleep(1200); }
    const phonePullBeforeTap = await fp.evaluate(() => hub.sync.lastPull);
    note('phone_pull_state', { phonePull0, phonePullBeforeTap, ipadStarAt: tStar, phonePulledSinceStar: phonePullBeforeTap > tStar, msSincePhonePull: Date.now() - phonePullBeforeTap });
    note('phone_before_tap', await view(fp));
    await fp.click('#story-heard'); await sleep(600);
    if (name === 'offline') { await sleep(1000); await phone.setOffline(false); }
    await sleep(1500); await isFlushed(fp);
    note('s2_after_phone', await both(L));

    await fi.evaluate(() => hub.pull()); await sleep(1500);
    note('ipad_after_pull', await view(fi));
    await fi.evaluate(() => document.querySelector('#done').scrollIntoView({ block: 'center' }));
    const png = path.join(EVID, `${PFX}-${name}-ipad-after-pull.png`);
    await ipad.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
    o.shot = path.relative(ROOT, png).replace(/\\/g, '/');

    // can the kid re-tap today? (a star from an earlier day cannot be re-earned: award() only sets days[dayKey()])
    await fi.click('#done'); await sleep(400); await isFlushed(fi);
    note('ipad_retap', await view(fi));
    note('s3_after_retap', await both(L));
  } finally { await L.close(); }
  return o;
}
const which = process.argv[2] ? [process.argv[2]] : ['race', 'offline', 'control'];
const res = {}; for (const w of which) res[w] = await run(w);
const f = path.join(EVID, PFX + (process.argv[2] ? '-' + process.argv[2] : '') + '.json');
fs.writeFileSync(f, JSON.stringify(res, null, 1)); console.log('wrote', path.relative(ROOT, f));
