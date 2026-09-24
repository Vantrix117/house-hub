// Taps from Home to finish each top Prayer job, on the local instance through the real UI (iPhone PWA, demo clock).
// Every click() and fill() below is counted: a tap is one click, a typed entry is one fill. Home is the shell (#home);
// the app is the viewer frame. Kid Home entry points are discovered at runtime (every element that opens Prayer).
// Run: node "audits/tools/phase3/prayer/taps.mjs" -> audits/evidence/p3/prayer/taps.json
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const jobs = [];
function counter(d) {
  const c = { taps: 0, typed: 0, path: [] };
  c.tap = async (where, sel, label) => { await where.click(sel); c.taps++; c.path.push(label || sel); await sleep(350); };
  c.type = async (where, sel, text, label) => { await where.fill(sel, text); c.typed++; c.path.push('type: ' + (label || text)); await sleep(150); };
  c.frame = async () => { for (let i = 0; i < 50; i++) { const f = d.frame('prayer'); if (f) { await f.waitForSelector('#todayLine', { timeout: 10000 }); await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0); await sleep(500); return f; } await sleep(100); } throw new Error('no frame'); };
  return c;
}
const home = async (profile, device = 'iphone-pwa') => { const d = await L.device({ device, profile }); await d.goto('#home'); await sleep(1200); return d; };
async function job(name, profile, fn) {
  await L.reset('typical');
  const d = await home(profile); const c = counter(d);
  let ok = null, note = '';
  try { const r = await fn(d, c); ok = r.ok; note = r.note || ''; } catch (e) { ok = false; note = String(e.message || e).slice(0, 200); }
  const rec = { job: name, profile, taps: c.taps, typed: c.typed, path: c.path.join(' → '), ok, note };
  jobs.push(rec); console.log(JSON.stringify(rec));
  await d.close();
}
try {
  // 1. The daily job: mark one request on my list as prayed (Home card → circle)
  await job('Mark one of today\'s requests prayed (Home card)', 'eli', async (d, c) => {
    await c.tap(d.page, '[data-open="prayer"]', 'Home: Open prayer'); const f = await c.frame();
    await c.tap(f, '#todayList [data-pray="p004"]', 'circle on "Patience and gentleness at home"');
    return { ok: await f.evaluate(() => D.lists.personal.prayers.find(p => p.id === 'p004').lastPrayedAt === TODAY) };
  });
  // 1b. Pray through the whole list with Pray now
  await job('Pray through today\'s list with Pray now', 'eli', async (d, c) => {
    await c.tap(d.page, '[data-open="prayer"]', 'Home: Open prayer'); const f = await c.frame();
    await c.tap(f, '#startPray', 'Pray now');
    const n = await f.evaluate(() => prayList.length);
    for (let i = 0; i < n; i++) await c.tap(f, '#prayNext', 'Prayed');
    return { ok: await f.evaluate(() => todaySet().every(p => p.lastPrayedAt === TODAY)), note: n + ' requests in the queue' };
  });
  // 1c. Family list: pray one family request (last list was Mine)
  await job('Mark a family request prayed', 'eli', async (d, c) => {
    await c.tap(d.page, '[data-open="prayer"]', 'Home: Open prayer'); const f = await c.frame();
    await c.tap(f, '#listSwitch [data-list="shared"]', 'Family');
    await c.tap(f, '#todayList [data-pray="s004"]', 'circle on "Kiara\'s first weeks at preschool"');
    return { ok: await f.evaluate(() => (D.lists.shared.prayers.find(p => p.id === 's004').prayedBy[TODAY] || []).includes('Eli')) };
  });
  // 2. Add a request to my list
  await job('Add a request to my list', 'eli', async (d, c) => {
    await c.tap(d.page, '[data-open="prayer"]', 'Home: Open prayer'); const f = await c.frame();
    await c.tap(f, '#fab', '+ button');
    await c.type(f, '#f-title', 'Wisdom for the school board vote', 'title');
    const hidden = await f.evaluate(() => document.getElementById('f-save').getBoundingClientRect().top >= document.querySelector('nav').getBoundingClientRect().top);
    await f.evaluate(() => document.getElementById('f-save').scrollIntoView({ block: 'center' })); c.path.push('(scroll: "Add to the list" starts under the nav)');
    await c.tap(f, '#f-save', 'Add to the list');
    return { ok: await f.evaluate(() => D.lists.personal.prayers.some(p => p.title === 'Wisdom for the school board vote')), note: 'Add button under the nav at open: ' + hidden };
  });
  // 3. Record an answer (the request is on Today)
  await job('Mark a request answered, with the answer', 'eli', async (d, c) => {
    await c.tap(d.page, '[data-open="prayer"]', 'Home: Open prayer'); const f = await c.frame();
    await c.tap(f, '#todayList [data-open="p002"]', 'row "Mae\'s job interview on Thursday"');
    await c.tap(f, '[data-answer="p002"]', 'Mark answered');
    await c.type(f, '#askIn', 'She got the job.', 'how it was answered');
    await c.tap(f, '#askSave', 'Mark answered (save)');
    return { ok: await f.evaluate(() => D.lists.personal.prayers.find(p => p.id === 'p002').status === 'answered') };
  });
  // 3b. Record an answer for a request that is not on Today (rotation not due): List → search
  await job('Mark answered a request not on Today (via List)', 'eli', async (d, c) => {
    await c.tap(d.page, '[data-open="prayer"]', 'Home: Open prayer'); const f = await c.frame();
    await c.tap(f, 'nav [data-go="all"]', 'List');
    await c.tap(f, '#allList details.cat:has([data-copycat="Coworkers"]) > summary', 'open "Coworkers"');
    await c.tap(f, '#allList [data-open="p010"]', 'row');
    await c.tap(f, '[data-answer="p010"]', 'Mark answered');
    await c.type(f, '#askIn', 'Peaceful last days; Sam is doing OK.', 'answer');
    await c.tap(f, '#askSave', 'Mark answered (save)');
    return { ok: await f.evaluate(() => D.lists.personal.prayers.find(p => p.id === 'p010').status === 'answered') };
  });
  // 4. Kid: Kiara prays for a family request
  await job('Kid (Kiara): say "I prayed" for a family request', 'kiara', async (d, c) => {
    const entries = await d.page.evaluate(() => [...document.querySelectorAll('[data-open="prayer"], [data-app="prayer"], a[href*="prayer"]')].filter(e => e.offsetParent).map(e => (e.className || e.tagName) + ': ' + e.textContent.trim().slice(0, 30)));
    let note = 'kid Home has no Prayer entry (entries on Home: ' + JSON.stringify(entries) + '); path goes through the Apps grid';
    await c.tap(d.page, '.kid-cta', 'Home: "Let\'s play — open your apps"');
    const sel = await d.page.evaluate(() => { const e = [...document.querySelectorAll('[data-open="prayer"], [data-app="prayer"], [data-id="prayer"]')].find(e => e.offsetParent); if (!e) return null; e.setAttribute('data-rig-pick', '1'); return '[data-rig-pick="1"]'; });
    if (!sel) return { ok: false, note: note + '; no Prayer tile found on Apps either' };
    await c.tap(d.page, sel, 'Apps: Prayer tile'); const f = await c.frame();
    await c.tap(f, '[data-kpray="s004"]', 'Prayed on "Kiara\'s first weeks at preschool"');
    return { ok: await f.evaluate(() => (D.lists.shared.prayers.find(p => p.id === 's004').prayedBy[TODAY] || []).includes('Kiara')), note };
  });
} catch (e) { console.error(e); jobs.push({ error: String(e.stack || e) }); }
finally { fs.writeFileSync(`${OUT}/taps.json`, JSON.stringify(jobs, null, 1)); await L.close(); }
