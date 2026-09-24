// KV: taps from Home to finish each top job, counted through the shipped UI (typical variant, real clock). Every tap and
// every scroll gesture needed to reach a control is counted; the job is checked on the server.
//   node "audits/tools/phase3/kidverse/taps.mjs"
// Kid Ezra, iPhone 430×932 and iPad 820×1180, from kid Home:
//   K1 earn today's verse ★ via Home's "Open Kid Verse" · K1b via the Apps tab · K2 hear the verse read aloud ·
//   K3 hear the story and tap "I heard it".
// Adult (Mom), iPhone: A1 see the kids' stars (Home Kids card; Kid Verse's panel) · A2 set the family week (+1) ·
//   A3 cash in a kid's stars (Me → Kids' rewards).
import { local, sleep, log, saveJson, pulled, flushed, row, shot } from './_kv.mjs';

const out = [];
const inView = (f, s) => f.evaluate(sel => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, s);
async function frameInView(d, f, s) {   // in-shell: the frame's element inside the page viewport
  const box = await (await f.$(s)).boundingBox(); const vh = d.page.viewportSize().height; return box && box.y >= 0 && box.y + box.height <= vh;
}
async function job(L, name, profile, device, steps) {
  const d = await L.device({ device, profile, fixedTime: false });
  d.page.on('dialog', x => x.accept());
  await d.goto('#home'); await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }); await sleep(1000);
  const r = { job: name, profile, device, taps: 0, scrolls: 0, path: [] };
  try { await steps(d, r); } catch (e) { r.error = String(e.message).slice(0, 200); }
  out.push(r); await d.close(); return r;
}
const tap = async (r, target, sel, label) => { await target.click(sel); r.taps++; r.path.push(label); await sleep(700); };
async function reach(d, f, r, sel, label) { if (!(await frameInView(d, f, sel))) { await f.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), sel); r.scrolls++; r.path.push('scroll to ' + label); await sleep(400); } }

const L = await local({ variant: 'typical', clock: 'real' });
try {
  for (const device of ['iphone-pwa', 'ipad-portrait']) {
    await L.reset('typical');
    await job(L, 'K1 verse ★ via Home card', 'ezra', device, async (d, r) => {
      r.homeButtonText = await d.page.textContent('[data-open="kidverse"]');
      await tap(r, d.page, '[data-open="kidverse"]', 'Home: ' + r.homeButtonText.trim());
      const f = await d.openApp('kidverse').catch(() => null) || d.frame('kidverse'); await pulled(f); await sleep(800);
      r.doneAboveFold = await frameInView(d, f, '#done');
      await reach(d, f, r, '#done', 'Done ★'); await tap(r, f, '#done', 'Done ★'); await flushed(f);
      r.done = !!(await row(L, 'ezra', 'person', 'stars')).value.days[new Date().toISOString().slice(0, 10)] || JSON.stringify((await row(L, 'ezra', 'person', 'stars')).value.days);
      if (device === 'iphone-pwa') r.shot = await shot(d.page, 'taps-K1-iphone-after-done.png');
    });
  }
  await L.reset('typical');
  await job(L, 'K1b verse ★ via Apps tab', 'ezra', 'iphone-pwa', async (d, r) => {
    await tap(r, d.page, '#tabbar .tab[data-tab="apps"]', 'Apps tab');
    await tap(r, d.page, '.tile[data-id="kidverse"]', 'Kid Verse tile');
    const f = d.frame('kidverse') || await d.openApp('kidverse'); await pulled(f); await sleep(800);
    await reach(d, f, r, '#done', 'Done ★'); await tap(r, f, '#done', 'Done ★'); await flushed(f);
    r.done = JSON.stringify((await row(L, 'ezra', 'person', 'stars')).value.days);
  });
  await job(L, 'K2 hear the verse', 'ezra', 'iphone-pwa', async (d, r) => {
    await tap(r, d.page, '[data-open="kidverse"]', 'Home: Open Kid Verse');
    const f = d.frame('kidverse'); await pulled(f); await sleep(800);
    r.sayAboveFold = await frameInView(d, f, '#say');
    await reach(d, f, r, '#say', 'Read it to me'); await tap(r, f, '#say', 'Read it to me');
    r.done = 'toast (rig has no speech): ' + JSON.stringify(await d.page.evaluate(() => { const fr = document.querySelector('iframe'); return null; }));
  });
  await job(L, 'K3 story + I heard it', 'kiara', 'iphone-pwa', async (d, r) => {
    await tap(r, d.page, '[data-open="kidverse"]', 'Home: Open Kid Verse');
    const f = d.frame('kidverse'); await pulled(f); await sleep(800);
    await reach(d, f, r, '#story-say', 'story Read it to me'); await tap(r, f, '#story-say', 'story Read it to me');
    await reach(d, f, r, '#story-heard', 'I heard it'); await tap(r, f, '#story-heard', 'I heard it'); await flushed(f);
    r.done = JSON.stringify((await row(L, 'kiara', 'person', 'story')).value);
  });
  await job(L, 'A1 kids\' stars (Home)', 'mom', 'iphone-pwa', async (d, r) => {
    r.homeKids = await d.page.evaluate(() => { const c = [...document.querySelectorAll('#view-home .card')].find(x => /Kids/.test(x.textContent) && /★/.test(x.textContent)); if (!c) return null; const b = c.getBoundingClientRect(); return { text: c.textContent.replace(/\s+/g, ' ').trim().slice(0, 160), top: Math.round(b.top), aboveFold: b.bottom <= innerHeight }; });
    if (r.homeKids && !r.homeKids.aboveFold) { r.scrolls++; r.path.push('scroll Home to the Kids card'); }
    r.done = r.homeKids ? r.homeKids.text : 'no Kids card';
  });
  await job(L, 'A1b kids\' stars (Kid Verse panel)', 'mom', 'iphone-pwa', async (d, r) => {
    await tap(r, d.page, '#tabbar .tab[data-tab="apps"]', 'Apps tab');
    await tap(r, d.page, '.tile[data-id="kidverse"]', 'Kid Verse tile');
    const f = d.frame('kidverse'); await pulled(f); await sleep(800);
    await reach(d, f, r, '#kids', "Kids' stars"); r.done = await f.evaluate(() => [...document.querySelectorAll('#kids li')].map(l => l.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
  });
  await job(L, 'A2 set the family week (+1)', 'mom', 'iphone-pwa', async (d, r) => {
    await tap(r, d.page, '#tabbar .tab[data-tab="apps"]', 'Apps tab');
    await tap(r, d.page, '.tile[data-id="kidverse"]', 'Kid Verse tile');
    const f = d.frame('kidverse'); await pulled(f); await sleep(800);
    await reach(d, f, r, '#week-up', '+'); await tap(r, f, '#week-up', '+'); await flushed(f);
    r.done = JSON.stringify((await row(L, 'eli', 'family', 'week')).value);
  });
  await job(L, 'A3 cash in (Me)', 'mom', 'iphone-pwa', async (d, r) => {
    await tap(r, d.page, '#tabbar .tab[data-tab="me"]', 'Me tab'); await sleep(600);
    const inV = await d.page.evaluate(() => { const b = document.querySelector('#rewards-body [data-cashin="ezra"]').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; });
    if (!inV) { r.scrolls++; r.path.push("scroll Me to Kids' rewards"); }
    await tap(r, d.page, '#rewards-body [data-cashin="ezra"]', 'Cash in'); r.taps++; r.path.push('confirm() OK');
    await sleep(800);
    r.done = await d.page.evaluate(() => document.querySelector('#rewards-body [data-kid="ezra"]').textContent.replace(/\s+/g, ' ').trim().slice(0, 80));
  });
} finally { await L.close(); }
for (const r of out) log(`${r.job} [${r.profile} ${r.device}] taps ${r.taps} + scrolls ${r.scrolls} :: ${r.path.join(' → ')} :: ${r.done || r.error}${r.doneAboveFold !== undefined ? ' :: Done above fold: ' + r.doneAboveFold : ''}${r.sayAboveFold !== undefined ? ' :: Read above fold: ' + r.sayAboveFold : ''}`);
saveJson('taps.json', out);
