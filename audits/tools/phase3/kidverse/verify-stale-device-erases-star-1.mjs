// Skeptic #1 for "stale-device-erases-star": a kid's second device holding an older copy of the whole stars row
// writes it back and erases a verse star earned on the first device.
//   node "audits/tools/phase3/kidverse/verify-stale-device-erases-star-1.mjs"          all scenarios (A B C)
//   node "audits/tools/phase3/kidverse/verify-stale-device-erases-star-1.mjs" A C      a subset
// A offline : Ezra's phone (second paired device) opens Kid Verse (warm cache), goes offline; on the Kitchen iPad Ezra taps
//             Done ★; on the phone, still offline, Ezra taps "I heard it"; the phone reconnects and flushes.
// B online  : both online; the phone taps "I heard it" right after the iPad's Done ★, before its next 30 s poll.
// C control : as B, but the phone pulls (hub.pull()) before the tap.
// Each scenario: fresh local instance (typical seed, real clock). After the phone flushes, the iPad pulls; then the iPad
// taps Done ★ again, to see whether today's lost star can be re-earned.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'kidverse');
fs.mkdirSync(EVID, { recursive: true });
const PFX = 'verify-stale-device-erases-star-1';
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

async function serverStars(L) {
  const r = await L.apiAs('ezra', '/api/data/kidverse?scope=person&key=stars');
  const it = r.body && r.body.item; if (!it) return null; const v = it.value || {};
  const m = await L.apiAs('eli', '/api/data/kidverse?scope=family&key=' + encodeURIComponent('stars:ezra'));
  const mv = m.body && m.body.item && m.body.item.value || {};
  return { total: v.total, earned: v.earned, count: v.count, verseToday: v.days ? v.days[today()] === true : false, storyToday: !!(v.credited && v.credited.story && v.credited.story[today()]),
    days: v.days, updated_at: it.updated_at, mirror: { total: mv.total, earned: mv.earned, verseToday: mv.days ? mv.days[today()] === true : false } };
}
async function waitFor(f, fn, ms = 15000) { const until = Date.now() + ms; while (Date.now() < until) { if (await f.evaluate(fn).catch(() => false)) return true; await sleep(150); } return false; }
const hasPulled = f => waitFor(f, () => !!(window.hub && hub.sync && hub.sync.lastPull));
const isFlushed = f => waitFor(f, () => window.hub && hub.sync.state === 'synced' && !Object.keys(localStorage).some(k => k.startsWith('hub.queue.') && Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length));
const view = f => f.evaluate(() => {
  const t = s => { const e = document.querySelector(s); return e && !e.hidden ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  return { done: t('#done'), pressed: document.querySelector('#done') && document.querySelector('#done').getAttribute('aria-pressed'), star: t('#star-count'), rwTotal: t('#rw-total'), rwEarned: t('#rw-earned'), heard: t('#story-heard'), sync: hub.sync.state };
});

async function run(name) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const o = { scenario: name, today: today() };
  try {
    o.start = await serverStars(L);
    const ph = await L.newDevice({ name: 'Parent phone (Ezra)', profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: ph });
    const fp = await phone.openApp('kidverse', { wait: '#story-heard:not([hidden])' });
    await hasPulled(fp); await sleep(1200);
    o.phoneWarm = await view(fp);
    if (name === 'A') await phone.setOffline(true);

    const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
    const fi = await ipad.openApp('kidverse', { wait: '#done:not([hidden])' });
    await hasPulled(fi); await sleep(1000);
    await fi.click('#done'); await sleep(400); await isFlushed(fi);
    o.afterIpadStar = await serverStars(L);
    o.ipadAfterStar = await view(fi);

    if (name === 'C') { await fp.evaluate(() => hub.pull()); await sleep(1500); o.phoneAfterControlPull = await view(fp); }
    const tTap = Date.now();
    await fp.click('#story-heard'); await sleep(600);
    o.phoneQueuedStars = await fp.evaluate(d => { const q = JSON.parse(localStorage.getItem('hub.queue.kidverse.person.ezra') || '{}'); const s = q.stars && q.stars.value; return s ? { total: s.total, earned: s.earned, verseToday: !!(s.days && s.days[d] === true) } : null; }, o.today);
    if (name === 'A') { await sleep(1000); await phone.setOffline(false); }
    await sleep(2000); await isFlushed(fp);
    o.msTapToFlush = Date.now() - tTap;
    o.afterPhoneFlush = await serverStars(L);
    o.phoneAfter = await view(fp);

    await fi.evaluate(() => hub.pull()); await sleep(1500);
    o.ipadAfterPull = await view(fi);
    await fi.evaluate(() => document.querySelector('#done').scrollIntoView({ block: 'center' }));
    const png = path.join(EVID, `${PFX}-${name}-ipad-after-pull.png`);
    await ipad.page.screenshot({ path: png, scale: 'css', animations: 'disabled', caret: 'hide' });
    o.shot = path.relative(ROOT, png).replace(/\\/g, '/');

    // can today's lost star be earned again? (the day is no longer marked, so Done ★ is live)
    await fi.click('#done'); await sleep(400); await isFlushed(fi);
    o.afterRetap = await serverStars(L);
    o.ipadAfterRetap = await view(fi);
    o.logsErrors = [...phone.logs, ...ipad.logs].filter(l => /error/i.test(l)).slice(0, 10);
  } finally { await L.close(); }
  const c = s => s && JSON.stringify({ total: s.total, earned: s.earned, verseToday: s.verseToday, storyToday: s.storyToday, mirror: s.mirror });
  log(`[${name}] start              ${c(o.start)}`);
  log(`[${name}] iPad Done ★         server ${c(o.afterIpadStar)} | iPad ${o.ipadAfterStar.done} ★${o.ipadAfterStar.star}`);
  log(`[${name}] phone queued stars  ${JSON.stringify(o.phoneQueuedStars)}`);
  log(`[${name}] phone flushed       server ${c(o.afterPhoneFlush)} (${o.msTapToFlush} ms after tap)`);
  log(`[${name}] iPad after pull     ${JSON.stringify(o.ipadAfterPull)}`);
  log(`[${name}] iPad re-taps Done ★ server ${c(o.afterRetap)} | iPad ${JSON.stringify(o.ipadAfterRetap)}`);
  return o;
}

const which = process.argv.slice(2).length ? process.argv.slice(2) : ['A', 'B', 'C'];
const res = {};
for (const w of which) res[w] = await run(w);
const f = path.join(EVID, PFX + (process.argv.slice(2).length ? '-' + which.join('') : '') + '.json');
fs.writeFileSync(f, JSON.stringify(res, null, 1));
log('wrote', path.relative(ROOT, f).replace(/\\/g, '/'));
