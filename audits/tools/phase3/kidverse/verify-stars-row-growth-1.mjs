// Skeptic #1 for finding "stars-row-growth": does the stars row keep every credited day forever, and does one star
// upload the whole row twice (person + family mirror)? Independent of rowsize.mjs; imports only the harness.
//   node "audits/tools/phase3/kidverse/verify-stars-row-growth-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EVID = path.join(ROOT, 'audits', 'evidence', 'p3', 'kidverse');
const get = async (L, who, scope, key) => { const r = await L.apiAs(who, `/api/data/kidverse?scope=${scope}&key=${encodeURIComponent(key)}`); return r.body && r.body.item; };
const shape = v => ({ bytes: JSON.stringify(v).length, creditedBytes: JSON.stringify(v.credited).length,
  story: Object.keys(v.credited.story).length, prayed: Object.keys(v.credited.prayed).length,
  storyFirst: Object.keys(v.credited.story).sort()[0], prayedFirst: Object.keys(v.credited.prayed).sort()[0],
  earnedAt: Object.keys(v.earnedAt).length, earnedAtFirst: Object.keys(v.earnedAt).map(k => k.split(':')[1]).sort()[0],
  applied: Object.keys(v.applied).length, payouts: v.payouts.length, total: v.total, earned: v.earned, days: v.days });
const out = {};
const TOMORROW = Date.now() + 24 * 3600e3;
const L = await local({ variant: 'overflow', clock: 'real' });
try {
  for (const kid of ['ezra', 'kiara']) {
    const before = await get(L, kid, 'person', 'stars');
    out[kid] = { before: shape(before.value), beforeUpdated: before.updated_at };
    // both kids already hold today's star in overflow, so the device lives tomorrow (browser clock only) to earn a fresh one
    const d = await L.device({ device: 'iphone-pwa', profile: kid, fixedTime: TOMORROW });
    const posts = [];
    d.page.on('request', q => { if (q.method() === 'POST' && /\/api\/data\/kidverse\/batch/.test(q.url())) {
      const body = JSON.parse(q.postData() || '{}'); posts.push({ url: q.url().replace(/^.*\/api/, '/api'), bytes: (q.postData() || '').length, keys: (body.items || []).map(i => i.key) }); } });
    const f = await d.openApp('kidverse', { wait: '#done' });
    for (let i = 0; i < 60 && !(await f.evaluate(() => !!(window.hub && hub.sync && hub.sync.lastPull)).catch(() => false)); i++) await sleep(250);
    await sleep(1500);
    out[kid].postsOnOpen = posts.splice(0);
    const doneToday = await f.evaluate(() => document.querySelector('#done').classList.contains('today'));
    out[kid].doneAlreadyToday = doneToday;
    if (!doneToday) { await f.click('#done'); await sleep(2500); }
    out[kid].postsOnTap = posts.splice(0);
    const after = await get(L, kid, 'person', 'stars'); const mirror = await get(L, 'eli', 'family', 'stars:' + kid);
    out[kid].after = shape(after.value); out[kid].afterUpdated = after.updated_at;
    out[kid].mirrorAfter = { bytes: JSON.stringify(mirror.value).length, updated: mirror.updated_at, sameAsPerson: JSON.stringify(mirror.value) === JSON.stringify(after.value) };
    await d.close();
    console.log(kid, 'before', JSON.stringify(out[kid].before));
    console.log(kid, 'posts on open', JSON.stringify(out[kid].postsOnOpen));
    console.log(kid, 'doneAlreadyToday', doneToday, 'posts on tap', JSON.stringify(out[kid].postsOnTap));
    console.log(kid, 'after', JSON.stringify(out[kid].after), 'mirror', JSON.stringify(out[kid].mirrorAfter));
  }
} finally { await L.close(); }
fs.writeFileSync(path.join(EVID, 'verify-stars-row-growth-1.json'), JSON.stringify(out, null, 1));
console.log('wrote audits/evidence/p3/kidverse/verify-stars-row-growth-1.json');
