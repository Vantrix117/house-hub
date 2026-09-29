// Batch 0f check: Kid Verse on two devices of one kid, with the new one-row-per-star storage.
//   A  both devices: Ezra's phone goes offline and taps Done ★; the Kitchen iPad (online) taps "I heard it"; the phone
//      reconnects. Both stars must land (mirror total +2) and both devices must show the same numbers.
//   B  mirror flap: after A both devices stay open ~75 s with pulls; the family mirror stars:ezra / story:ezra must not be
//      rewritten (their updated_at stays put) - two devices build the same sorted mirror.
//   C  late star vs a parent's reset: the phone (offline) earns today's verse ★ BEFORE Eli resets the week; the iPad applies
//      the reset first, then the phone reconnects with its star. The star was earned before the reset, so it is taken by
//      it: the total must not grow, today's ★ must stay spent, and both devices must agree.
// Run from the repo root: node audits/tools/phase6/0f/kid-two-devices.mjs  -> audits/evidence/p6/0f/kid-two-devices.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/0f';
fs.mkdirSync(OUT, { recursive: true });
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's', ...a);
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
async function waitFor(f, fn, ms = 15000) { const until = Date.now() + ms; while (Date.now() < until) { if (await f.evaluate(fn).catch(() => false)) return true; await sleep(150); } return false; }
const hasPulled = f => waitFor(f, () => !!(window.hub && hub.sync && hub.sync.lastPull));
const isFlushed = f => waitFor(f, () => window.hub && hub.sync.state === 'synced' && !Object.keys(localStorage).some(k => k.startsWith('hub.queue.') && Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length));
const view = f => f.evaluate(() => {
  const t = s => { const e = document.querySelector(s); return e && !e.hidden ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  const s = window.kidverse && window.kidverse.rewards ? window.kidverse.rewards.deriveStars() : null;
  return { done: t('#done'), rwTotal: t('#rw-total'), rwEarned: t('#rw-earned'), heard: t('#story-heard'), sync: hub.sync.state, derived: s && { total: s.total, earned: s.earned, count: s.count } };
});
async function mirror(L) {
  const g = async k => { const r = await L.apiAs('eli', '/api/data/kidverse?scope=family&key=' + encodeURIComponent(k)); return r.body && r.body.item ? { value: r.body.item.value, updated_at: r.body.item.updated_at } : null; };
  const s = await g('stars:ezra'), st = await g('story:ezra'); const d = today();
  const v = (s && s.value) || {};
  return { total: v.total, earned: v.earned, count: v.count, verseToday: v.days ? v.days[d] : undefined, storyToday: v.credited && v.credited.story ? v.credited.story[d] : undefined,
    starsAt: s && s.updated_at, storyAt: st && st.updated_at };
}
const pullBoth = async (...fs_) => { for (const f of fs_) await f.evaluate(() => hub.pull()).catch(() => {}); await sleep(1500); };

async function run(name) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const o = { scenario: name, today: today() };
  try {
    const ph = await L.newDevice({ name: 'Parent phone (Ezra)', profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: ph });
    const fp = await phone.openApp('kidverse', { wait: '#done:not([hidden])' });
    await hasPulled(fp); await sleep(1200);
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'ezra', fixedTime: false });
    const fi = await ipad.openApp('kidverse', { wait: '#story-heard:not([hidden])' });
    await hasPulled(fi); await sleep(1500); await isFlushed(fi); await isFlushed(fp);
    o.start = await mirror(L);

    if (name === 'A') {
      await phone.setOffline(true);
      await fp.click('#done'); await sleep(600);
      await fi.click('#story-heard'); await sleep(600); await isFlushed(fi);
      o.afterIpadHeard = await mirror(L);
      await phone.setOffline(false); await sleep(2500); await isFlushed(fp);
      await pullBoth(fp, fi); await pullBoth(fp, fi); await isFlushed(fp); await isFlushed(fi);
      o.end = await mirror(L); o.phone = await view(fp); o.ipad = await view(fi);
      o.pass = o.end.total === o.start.total + 2 && o.end.verseToday === true && !!o.end.storyToday
        && o.phone.rwTotal === o.ipad.rwTotal && String(o.end.total) === o.ipad.rwTotal;
      // B: stay open, pulling; the mirrors must not be rewritten
      const before = await mirror(L); const t = Date.now();
      while (Date.now() - t < 75000) { await pullBoth(fp, fi); await sleep(8000); }
      await isFlushed(fp); await isFlushed(fi);
      const after = await mirror(L);
      o.B = { before, after, pass: before.starsAt === after.starsAt && before.storyAt === after.storyAt && before.total === after.total };
    } else if (name === 'C') {
      await phone.setOffline(true);
      await fp.click('#done'); await sleep(600);                        // earned now, before the reset
      o.phoneOfflineStar = await view(fp);
      await sleep(1500);
      // Eli resets the week, exactly as Me -> Kids' rewards writes it
      const d = today();
      const mon = (() => { const x = new Date(); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return x; })();
      const days = []; for (let i = 0; i < 7; i++) { const x = new Date(mon); x.setDate(mon.getDate() + i); const k = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); if (k <= d) days.push(k); }
      const at = Date.now();
      const w = await L.apiAs('eli', '/api/data/kidverse/batch?scope=family', { method: 'POST', body: { items: [{ key: 'ledger:ezra:t0f-' + at.toString(36), value: { kind: 'reset', date: d, days, by: 'eli', at }, updated_at: at }] } });
      o.resetWrite = { status: w.status, applied: w.body && w.body.results && w.body.results[0] && w.body.results[0].applied };
      await pullBoth(fi); await sleep(1500); await isFlushed(fi);
      o.afterReset = await mirror(L); o.ipadAfterReset = await view(fi);
      await phone.setOffline(false); await sleep(2500); await isFlushed(fp);
      await pullBoth(fp, fi); await pullBoth(fp, fi); await isFlushed(fp); await isFlushed(fi); await pullBoth(fp, fi);
      o.end = await mirror(L); o.phone = await view(fp); o.ipad = await view(fi);
      // the iPad taps Done again: today's star stays spent
      await fi.evaluate(() => { const b = document.querySelector('#done'); if (b && !b.disabled) b.click(); }); await sleep(800); await isFlushed(fi);
      o.afterRetap = await mirror(L);
      o.pass = o.start.verseToday !== true && o.phoneOfflineStar.derived && o.phoneOfflineStar.derived.total === o.start.total + 1   // the offline tap really earned a star
        && o.end.total === o.afterReset.total && o.afterRetap.total === o.afterReset.total && o.end.verseToday !== true
        && o.phone.rwTotal === o.ipad.rwTotal && String(o.end.total) === o.ipad.rwTotal;
    }
    o.errors = [...phone.logs, ...ipad.logs].filter(l => /pageerror|error/i.test(l)).slice(0, 10);
  } finally { await L.close(); }
  log(`[${name}]`, JSON.stringify({ start: o.start && o.start.total, end: o.end && o.end.total, afterReset: o.afterReset && o.afterReset.total, phone: o.phone && o.phone.rwTotal, ipad: o.ipad && o.ipad.rwTotal, pass: o.pass, B: o.B && o.B.pass }));
  return o;
}
const res = {};
for (const w of ['A', 'C']) res[w] = await run(w);
res.summary = { A: res.A.pass, B: res.A.B && res.A.B.pass, C: res.C.pass };
fs.writeFileSync(OUT + '/kid-two-devices.json', JSON.stringify(res, null, 1));
log('summary', JSON.stringify(res.summary));
log('wrote', OUT + '/kid-two-devices.json');
