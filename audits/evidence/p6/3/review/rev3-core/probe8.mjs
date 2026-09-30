// Round 3: the hub:immersive listener (the shell puts its bar back → Pray mode / Kitchen view close) and the run's feed line.
import fs from 'node:fs';
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev3-core/probe8.json';
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
const out = {}; const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const lines = async t0 => (await L.apiAs('eli', '/api/activity?limit=50')).body.activity.filter(a => a.created_at >= t0 - 1500 && a.app_id === 'prayer').map(a => a.profile_id + ': ' + a.text);
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const open = async () => { const f = await d.openApp('prayer', { wait: '#todayLine' }); await f.waitForFunction(() => typeof D !== 'undefined' && D && hub.isLoaded()); await sleep(400); await f.evaluate(() => { D.activeList = 'shared'; save(); go('today'); }); await sleep(300); return f; };
  const st = f => d.page.evaluate(() => ({ viewer: document.getElementById('viewer').classList.contains('on'), immersive: document.getElementById('viewer').classList.contains('immersive') })).then(async s => ({ ...s, pray: await f.evaluate(() => el('pray').classList.contains('on')).catch(() => 'gone'), kitchen: await f.evaluate(() => el('kitchen').classList.contains('on')).catch(() => 'gone') }));
  const flushAll = async f => { await f.evaluate(() => hub.flush()).catch(() => {}); await d.page.evaluate(() => hub.flush && hub.flush()).catch(() => {}); await sleep(1500); };

  // S1: Prayed ×2, then Home (the pill, hidden while immersive: clicked by script as a back gesture would)
  let f = await open(); let t0 = Date.now();
  await f.click('#startPray'); await sleep(500); await f.click('#prayNext'); await sleep(200); await f.click('#prayNext'); await sleep(200);
  await d.page.evaluate(() => document.getElementById('pill-home').click()); await sleep(800);
  const s1 = await st(f); await flushAll(f);
  await d.page.evaluate(() => { location.hash = '#prayer'; }); await sleep(1000);
  log('S1_home', { afterClose: s1, reopened: await st(d.frame('prayer')), sameFrame: d.frame('prayer') === f, lines: await lines(t0) });

  // S2: Prayed ×1, then Escape with focus in the shell (first press puts the bar back)
  f = d.frame('prayer'); t0 = Date.now();
  await f.click('#startPray'); await sleep(500); await f.click('#prayNext'); await sleep(200);
  await d.page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))); await sleep(600);
  const s2 = await st(f); await flushAll(f);
  log('S2_shellEscape', { state: s2, lines: await lines(t0) });

  // S3: Prayed ×1, then another app opened (the frame navigates away)
  t0 = Date.now();
  await f.click('#startPray'); await sleep(500); await f.click('#prayNext'); await sleep(200);
  await d.page.evaluate(() => { location.hash = '#tally'; }); await sleep(1500); await d.page.evaluate(() => hub.flush && hub.flush()); await sleep(1500);
  const aq3 = await d.page.evaluate(() => Object.keys(localStorage).filter(k => /^hub.a(queue|lock)/.test(k)).map(k => k + '=' + localStorage.getItem(k).slice(0,120)));
  const w3 = []; for (let i = 0; i < 8; i++) { await sleep(5000); const l = await lines(t0); w3.push(l.filter(x => /^eli: Prayed/.test(x) && !/Our small group|Mae.s job|settling/.test(x)).length); }
  log('S3_wait', { aq3, newLinesEvery5s: w3 });
  log('S3_otherApp', { immersive: await d.page.evaluate(() => document.getElementById('viewer').classList.contains('immersive')), lines: await lines(t0) });

  // S4: the Kitchen view, then Escape in the shell
  f = await open();
  await f.click('#moreBtn'); await sleep(400); await f.evaluate(() => { el('kitchen').scrollTop = 0; }); await f.click('[data-more="kitchen"]'); await sleep(500);
  const k0 = await st(f);
  await d.page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))); await sleep(500);
  log('S4_kitchenShellEscape', { before: k0, after: await st(f) });
  // Kitchen view opened by hand after scrolling it: starts at the top
  await f.click('#moreBtn'); await sleep(400); await f.click('[data-more="kitchen"]'); await sleep(400);
  await f.evaluate(() => { const k = el('kitchen'); k.scrollTop = 400; }); const sc = await f.evaluate(() => el('kitchen').scrollTop);
  await f.click('#kitchenShut'); await sleep(300); await f.click('#moreBtn'); await sleep(400); await f.click('[data-more="kitchen"]'); await sleep(400);
  log('S4b_scrollTop', { scrolledTo: sc, reopenedAt: await f.evaluate(() => el('kitchen').scrollTop), scrollable: await f.evaluate(() => el('kitchen').scrollHeight > el('kitchen').clientHeight) });
  await f.click('#kitchenShut'); await sleep(300);

  // S5: Switch profile while Pray mode is open (the shell's own sign-out path, hub:reauth)
  t0 = Date.now();
  await f.click('#startPray'); await sleep(500); await f.click('#prayNext'); await sleep(200);
  await f.evaluate(() => { try { window.parent.postMessage({ source: 'hub', type: 'hub:reauth', reason: 'signed_out' }, location.origin); } catch (e) {} }); await sleep(1500);
  await d.page.evaluate(() => hub.flush && hub.flush()).catch(() => {}); await sleep(1500);
  const aq5 = await d.page.evaluate(() => Object.keys(localStorage).filter(k => /^hub.a(queue|lock)|hub.retiring/.test(k)).map(k => k + '=' + localStorage.getItem(k).slice(0,120)));
  const w5 = []; for (let i = 0; i < 8; i++) { await sleep(5000); const l = await lines(t0); w5.push(l.filter(x => /^eli: Prayed/.test(x) && !/Our small group|Mae.s job|settling/.test(x)).length); }
  log('S5_wait', { aq5, newLinesEvery5s: w5 });
  log('S5_reauth', { viewer: await d.page.evaluate(() => document.getElementById('viewer').classList.contains('on')), frameGone: !d.frame('prayer'), lines: await lines(t0) });
  log('pageErrors', d.logs.filter(l => /pageerror|Error/.test(l)).slice(0, 6));
} catch (e) { console.error(e); out.error = String(e.stack || e); }
finally { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); await L.close(); }
