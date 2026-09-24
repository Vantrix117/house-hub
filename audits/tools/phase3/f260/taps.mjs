// F260 — ease of use: taps from Home for the top jobs, where the controls sit on a 430x932 iPhone, and whether kids can
// reach the app at all (Home, Apps, #f260 hash, chat's f260 tools). Local rig only (typical demo household, demo clock).
//   node "audits/tools/phase3/f260/taps.mjs"
import { local, sleep, save, shot, rows, texts, ready } from './_lib.mjs';

const out = { jobs: [], reach: {}, kids: {} };
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  // ── Job 1: tick today's reading (Eli, iPhone PWA) ──
  {
    const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, as: ph });
    await d.goto('#home'); await d.page.waitForSelector('[data-open="f260"]', { timeout: 15000 }); await sleep(800);
    const before = await rows(L, 'eli');
    const steps = [];
    const btn = d.page.locator('[data-open="f260"]').first();
    const hb = await btn.boundingBox();
    await btn.tap(); steps.push('Home card "Open F260"');
    let f; for (let i = 0; i < 100 && !f; i++) { f = d.frame('f260'); if (!f) await sleep(100); }
    await ready(f);
    const frameBox = await (await d.page.$('iframe')).boundingBox();
    const done = f.locator('#todayDone');
    const db = await done.boundingBox();   // page coordinates (Playwright reports frame elements in page space)
    await done.tap(); steps.push('Today "Done"');
    await sleep(1500);
    const after = await rows(L, 'eli');
    const newTicks = Object.keys(after['f260.done'] || {}).filter(k => !(before['f260.done'] || {})[k]);
    out.jobs.push({ job: 'Tick today\'s reading', profile: 'eli', device: 'iphone-pwa 430x932', taps: steps.length, typed: 0, steps, serverNewTicks: newTicks,
      homeButton: hb && { y: Math.round(hb.y), h: Math.round(hb.height) }, doneButton: db && { x: Math.round(db.x), y: Math.round(db.y), w: Math.round(db.width), h: Math.round(db.height), centreYfraction: +((db.y + db.height / 2) / 932).toFixed(2) } });
    out.reach.iphoneFrameTop = frameBox && Math.round(frameBox.y);
    // where the other primary controls sit on the phone (document y inside the app, viewport 932)
    out.reach.iphone = await f.evaluate(() => {
      const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { y: Math.round(b.top + scrollY), h: Math.round(b.height), w: Math.round(b.width) }; };
      return { viewportH: innerHeight, docH: document.documentElement.scrollHeight, today: r('#today'), done: r('#todayDone'), undo: r('#todayUndo'), switchBar: r('.switch'), heroGoToReading: r('#nextUp'),
        weekPicker: r('.wkpick'), settings: r('#settingsBtn'), currentWeek: r('.week.current'), firstWeek: r('#week-1'), heatmap: r('#heat') };
    });
    await shot(d.page, 'taps-after-done-iphone.png');
    // Job 1b: Undo right after (1 more tap)
    out.reach.undoVisibleAfterDone = await f.evaluate(() => !document.getElementById('todayUndo').hidden);
    await d.close();
  }
  // ── Job 2: write today's HEAR entry (Mae, first time: no passcode yet) ──
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false });
    await d.goto('#home'); await d.page.waitForSelector('[data-open="f260"]', { timeout: 15000 }); await sleep(800);
    const steps = []; let typed = 0;
    await d.page.locator('[data-open="f260"]').first().tap(); steps.push('Home card "Open F260"');
    let f; for (let i = 0; i < 100 && !f; i++) { f = d.frame('f260'); if (!f) await sleep(100); }
    await ready(f);
    // The Today card has no journal control. The only in-app route to today's HEAR panel: the hero's "Go to reading"
    // (below the progress grids and heatmap on a phone), then the day's HEAR button.
    const go = f.locator('#nextUp'); const gy = await f.evaluate(() => Math.round(document.getElementById('nextUp').getBoundingClientRect().top + scrollY));
    await go.scrollIntoViewIfNeeded(); steps.push('(scroll ' + gy + ' px down to the hero)');
    await go.tap(); steps.push('Hero "Go to reading"');
    await sleep(900);
    const target = await f.evaluate(() => document.getElementById('nextUp').dataset.target);
    const hear = f.locator(`[data-jr="${target}"]`);
    await hear.scrollIntoViewIfNeeded(); await hear.tap(); steps.push('Day "HEAR"');
    await f.waitForSelector('#pass.on', { timeout: 5000 }); await sleep(120);
    await f.fill('#pass1', '2468'); typed++; await f.fill('#pass2', '2468'); typed++;
    steps.push('type passcode', 'type it again');
    await f.locator('#passOk').tap(); steps.push('"Save passcode"');
    await f.waitForSelector('#pass.on', { state: 'detached', timeout: 8000 }).catch(() => {});
    await sleep(400);
    const ta = f.locator(`#jf-${target}-h`); await ta.tap(); await ta.fill('He is risen.'); typed++; steps.push('tap Highlight', 'type Highlight');
    await f.locator(`#jf-${target}-a`).tap(); await f.locator(`#jf-${target}-a`).fill('Pray with the kids tonight.'); typed++; steps.push('tap Apply', 'type Apply');
    await sleep(1200);
    const saved = await texts(f, [`#jr-${target} .jsaved`]);
    const taps = steps.filter(s => !s.startsWith('type') && !s.startsWith('(')).length;
    out.jobs.push({ job: 'Write today\'s HEAR entry (first time, sets a passcode)', profile: 'christian', device: 'iphone-pwa', taps, typed, steps, target, saved });
    await shot(d.page, 'taps-hear-iphone.png');
    await d.close();
  }
  // ── Job 3: mark this week's memory verse and practise it (Eli, iPad portrait) ──
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.goto('#home'); await d.page.waitForSelector('[data-open="f260"]', { timeout: 15000 }); await sleep(800);
    const steps = [];
    await d.page.locator('[data-open="f260"]').first().tap(); steps.push('Home card "Open F260"');
    let f; for (let i = 0; i < 100 && !f; i++) { f = d.frame('f260'); if (!f) await sleep(100); }
    await ready(f);
    const cw = await f.evaluate(() => { const w = document.querySelector('.week.current'); return { open: w.classList.contains('open'), y: Math.round(w.getBoundingClientRect().top + scrollY) }; });
    const mv = f.locator('.week.current .mv').first(); const id = await mv.getAttribute('data-mem');
    const was = await f.evaluate(i => !!document.querySelector(`[data-mem="${i}"]`).classList.contains('memd'), id);
    await mv.scrollIntoViewIfNeeded(); steps.push('(scroll ' + cw.y + ' px down to the current week, open: ' + cw.open + ')');
    await f.locator(`[data-mem="${id}"] .mkm`).tap(); steps.push('memory verse circle (' + (was ? 'un-mark' : 'mark') + ')');
    await sleep(500);
    const now = await f.evaluate(i => document.querySelector(`[data-mem="${i}"]`).classList.contains('memd'), id);
    out.jobs.push({ job: 'Mark a memory verse as memorized', profile: 'eli', device: 'ipad-portrait', taps: steps.filter(s => !s.startsWith('(')).length, typed: 0, steps, id, memorizedBefore: was, memorizedAfter: now });
    await d.close();
  }
  // ── Apps tab wide tile path ──
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await d.goto('#apps'); await sleep(1500);
    const tile = await d.page.evaluate(() => { const t = [...document.querySelectorAll('[data-app="f260"],[data-id="f260"],a[href="#f260"],button')].find(e => /F260/.test(e.textContent) && e.getBoundingClientRect().width > 0); if (!t) return null; const b = t.getBoundingClientRect(); return { tag: t.tagName, text: t.textContent.replace(/\s+/g, ' ').trim().slice(0, 90), w: Math.round(b.width), h: Math.round(b.height) }; });
    out.jobs.push({ job: 'Apps tab wide tile (alternative path)', taps: 2, note: 'tile (1) + Today Done (2); the tile shows week, next ref and streak', tile });
    await d.close();
  }
  // ── kids cannot reach F260 ──
  for (const kid of ['ezra', 'kiara']) {
    const d = await L.device({ device: 'ipad-portrait', profile: kid, fixedTime: false });
    await d.goto('#home'); await sleep(2500);
    const home = await d.page.evaluate(() => ({ openF260: document.querySelectorAll('[data-open="f260"]').length, textHasF260: /F260/.test(document.body.innerText) }));
    await d.goto('#apps'); await sleep(1500);
    const apps = await d.page.evaluate(() => ({ textHasF260: /F260/.test(document.body.innerText) }));
    await d.goto('#f260'); await sleep(2500);
    const hash = await d.page.evaluate(() => ({ frameLoaded: [...document.querySelectorAll('iframe')].some(i => /f260/.test(i.src)), hash: location.hash, toast: [...document.querySelectorAll('.toast,[role=status]')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 3) }));
    const chatStatus = await L.apiAs(kid, '/api/data/f260?scope=person');
    out.kids[kid] = { home, apps, hash, apiOwnF260Rows: (chatStatus.body.items || []).length };
    await d.close();
  }
} finally { await L.close(); }
for (const j of out.jobs) console.log(JSON.stringify(j));
console.log('reach', JSON.stringify(out.reach));
console.log('kids', JSON.stringify(out.kids));
console.log('evidence →', save('taps.json', out));
