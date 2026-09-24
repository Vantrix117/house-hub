// Phase 2 / PWA — skeptic #2 for candidate "rally-unreachable".
//   node "audits/tools/phase2/PWA/verify3-rally-unreachable-2.mjs"
//
// Claim: "Rally the family" (POST /api/dollywood/rally → "Meet at <name>" push) cannot be reached from any UI.
// This run tries to refute it on a fresh local instance (variant 'park', demo clock, WebKit, iPhone PWA and iPad):
//   A. Static, in the loaded frame: every <script> text of apps/dollywood-live.html, count `rally(` call sites vs the one
//      definition; any element/attribute mentioning "rally" in the DOM.
//   B. Eli (household adult, park day) on the park map: every button on screen before/after, the seeded meeting-point bar,
//      a ride card's "Meet here" (the confirm() is ACCEPTED here — the capture rig dismisses dialogs), then a long press on
//      the map (second path that sets a meet). After each: look for any Rally control, and log every request the page makes
//      to /api/dollywood/rally (context-level request log, all frames).
//   C. What the server holds after the UI paths: the family meet row (written by hub.js sync, not the rally route), the
//      activity feed ("Meeting point: …" from the client vs "Set a meeting point: …" which only the rally route writes).
//   D. Control: the route itself works on the local Worker when called directly (so the gap is the UI, not the API).
// Writes audits/evidence/p2/PWA/verify3-rally-unreachable-2.json and PNGs at 1x CSS scale.
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const png = n => path.join(OUT, `verify3-rally-unreachable-2-${n}.png`);
const R = { started: new Date().toISOString(), steps: [] };
const log = (k, v) => { R.steps.push({ k, v }); console.log(k, JSON.stringify(v).slice(0, 600)); };

const L = await local({ variant: 'park', clock: 'demo', engine: 'webkit' });
try {
  for (const devName of ['iphone-pwa', 'ipad-portrait']) {
    const d = await L.device({ device: devName, profile: 'eli' });
    const reqs = [], dialogs = [];
    d.ctx.on('request', r => { const u = r.url(); if (u.includes('/api/')) reqs.push({ m: r.method(), u: u.replace(L.api, '') }); });
    d.page.on('dialog', async dg => { dialogs.push(dg.message()); await dg.accept().catch(() => {}); });
    const f = await d.openApp('dollywood-live');
    await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
    await f.waitForFunction(() => !document.getElementById('lv-meet').hidden, null, { timeout: 8000, polling: 100 }).catch(() => {});
    await sleep(800);
    const shot = async n => { await d.page.screenshot({ path: png(`${devName}-${n}`), scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(ROOT, png(`${devName}-${n}`)).replace(/\\/g, '/'); };

    // A. static, in the running frame
    const stat = await f.evaluate(() => {
      const src = [...document.scripts].map(s => s.textContent).join('\n');
      const calls = [...src.matchAll(/[^A-Za-z0-9_$.]rally\s*\(/g)].map(m => src.slice(Math.max(0, m.index - 40), m.index + 30));
      const byWord = (src.match(/rally/gi) || []).length;
      const domHits = [...document.querySelectorAll('*')].filter(e => /rally/i.test([...e.attributes].map(a => a.value).join(' ')) || (e.children.length === 0 && /rally/i.test(e.textContent))).map(e => e.outerHTML.slice(0, 120));
      return { rallyIsFunction: typeof window.rally === 'function', rallyCallSitesInclDefinition: calls, rallyWordCountInScripts: byWord, domElementsMentioningRally: domHits,
        profile: window.hub && hub.profile && { id: hub.profile.id, kind: hub.profile.kind }, canWrite: window.hub && hub.canWrite };
    });
    log(`${devName} A.static`, stat);

    const buttons = () => f.evaluate(() => [...document.querySelectorAll('button,[role=button],a[href]')].filter(b => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !b.closest('[hidden]'); })
      .map(b => (b.id ? '#' + b.id + ' ' : '') + (b.textContent || b.getAttribute('aria-label') || b.title || '').trim().replace(/\s+/g, ' ').slice(0, 40)));
    const meetBar = () => f.evaluate(() => { const b = document.getElementById('lv-meet'); return { hidden: b.hidden, text: b.innerText.replace(/\s+/g, ' ').trim(), buttons: [...b.querySelectorAll('button')].map(x => ({ id: x.id, text: x.textContent, hidden: x.hidden })) }; });

    // B1. the seeded meet bar (Mae's meeting point, 12 min old)
    log(`${devName} B1.meetBar(seeded)`, await meetBar());
    log(`${devName} B1.visibleButtons`, (await buttons()).filter(Boolean));
    R[`${devName}-shot-open`] = await shot('1-open');

    // B2. Meet here from a ride card (Search → Thunderhead #28), confirm ACCEPTED
    await f.locator('#lv-search').tap();
    await f.waitForSelector('#lv-sheet[data-state="half"]', { timeout: 3000 }).catch(() => {});
    await sleep(450);
    await f.locator('#q').fill('Thunderhead');
    await f.waitForSelector('#tab-list .oi[data-n="28"]', { timeout: 4000 });
    await f.locator('#tab-list .oi[data-n="28"]').tap();
    await f.waitForSelector('#pop.show .pop-head', { timeout: 4000 }).catch(() => {});
    await sleep(1000);
    const cardButtons = await f.evaluate(() => [...document.querySelectorAll('#pop button')].map(b => b.textContent.trim()));
    log(`${devName} B2.cardButtons`, cardButtons);
    R[`${devName}-shot-card`] = await shot('2-card');
    const meetBtn = f.locator('#pop button', { hasText: 'Meet here' });
    log(`${devName} B2.meetHereCount`, await meetBtn.count());
    const before = reqs.length;
    await meetBtn.first().tap();
    await sleep(1500);
    log(`${devName} B2.dialogs`, dialogs.slice());
    log(`${devName} B2.meetBar(after Meet here)`, await meetBar());
    log(`${devName} B2.visibleButtons`, (await buttons()).filter(Boolean));
    log(`${devName} B2.requestsSinceTap`, reqs.slice(before));
    R[`${devName}-shot-after-meet-here`] = await shot('3-after-meet-here');

    // B3. tap the meet bar's text (in case the bar itself is a Rally affordance)
    await f.locator('#lv-meet .t').tap().catch(e => log(`${devName} B3.tapErr`, String(e).slice(0, 200)));
    await sleep(600);
    log(`${devName} B3.after tapping bar text`, { dialogs: dialogs.slice(), meet: await meetBar(), rallyReqs: reqs.filter(r => r.u.includes('/rally')) });

    // B4. long press on the map (the other setMeet path), confirm ACCEPTED
    const nd = dialogs.length, before4 = reqs.length;
    await f.evaluate(async () => {
      const svg = document.querySelector('svg#map') || document.querySelector('#lv-map svg') || document.querySelector('svg');
      const r = svg.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height * 0.4;
      svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true }));
      await new Promise(ok => setTimeout(ok, 900));
      svg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true }));
    });
    await sleep(1200);
    log(`${devName} B4.longPress dialogs`, dialogs.slice(nd));
    log(`${devName} B4.meetBar`, await meetBar());
    log(`${devName} B4.requestsSinceLongPress`, reqs.slice(before4));
    R[`${devName}-shot-after-long-press`] = await shot('4-after-long-press');

    // let hub.js flush the queued family write
    await sleep(3000);
    const rallyReqs = reqs.filter(r => r.u.includes('/api/dollywood/rally'));
    log(`${devName} B.ALL /api/dollywood/rally requests from the page`, rallyReqs);
    log(`${devName} B.ALL api requests (method+path, deduped)`, [...new Set(reqs.map(r => r.m + ' ' + r.u.split('?')[0]))]);
    log(`${devName} logs(errors)`, d.logs.filter(l => /error/i.test(l)).slice(0, 10));
    await d.close();
  }

  // C. server state after the UI paths
  const fam = await L.apiAs('eli', '/api/data/dollywood-live?scope=family');
  const rows = (fam.body && (fam.body.rows || fam.body.items || fam.body.data)) || fam.body;
  const meetRow = Array.isArray(rows) ? rows.find(r => r.key === 'meet') : (rows && rows.meet);
  log('C.meetRow', { status: fam.status, meetRow });
  const act = await L.apiAs('eli', '/api/activity');
  const lines = JSON.stringify(act.body);
  log('C.activity mentions', { clientMeetingPoint: (lines.match(/Meeting point: [^"]*/g) || []).slice(0, 6), rallyRouteLine: (lines.match(/Set a meeting point: [^"]*/g) || []) });

  // D. control: the route answers on the local Worker when called directly (local only; never production)
  const ctl = await L.apiAs('eli', '/api/dollywood/rally', { method: 'POST', body: { name: 'Control point', x: 800, y: 800 } });
  log('D.control POST /api/dollywood/rally (direct)', { status: ctl.status, body: ctl.body });
  const act2 = JSON.stringify((await L.apiAs('eli', '/api/activity')).body);
  log('D.after control, rally-route feed line', act2.match(/Set a meeting point: [^"]*/g) || []);
  R.serverLogRally = L.serverLog.join('').split('\n').filter(l => /rally/i.test(l)).slice(0, 20);
} catch (e) {
  R.error = String(e && e.stack || e);
  console.error(e);
} finally {
  fs.writeFileSync(path.join(OUT, 'verify3-rally-unreachable-2.json'), JSON.stringify(R, null, 2));
  await L.close();
}
