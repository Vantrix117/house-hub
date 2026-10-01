// Probe 3: journal search escaping (P3-F260-20) with hostile entry text, plus "saves only on changed text" (P3-F260-17):
// a blur with no change writes no vault row; a real change writes one.
import { local, sleep, DEMO, rows, texts, ready, watchWrites } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  await L.reset('typical');
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const writes = watchWrites(d.page);
  const f = await d.openApp('f260'); await ready(f);
  // set a passcode via the Journal tab's locked state
  await f.evaluate(() => document.getElementById('tabJournal').click()); await sleep(400);
  await f.evaluate(() => document.querySelector('[data-unlock-view]').click()); await f.waitForSelector('#pass.on');
  await f.fill('#pass1', '135790'); await f.fill('#pass2', '135790'); await f.evaluate(() => document.getElementById('passOk').click());
  await f.waitForFunction(() => !document.getElementById('pass').classList.contains('on'), null, { timeout: 15000 });
  // write a hostile entry into 38-0 via the plan
  await f.evaluate(() => document.getElementById('tabPlan').click()); await sleep(300);
  await f.evaluate(() => { const b = document.querySelector('[data-jr="38-0"]'); b.click(); }); await sleep(500);
  const H = '<img src=x onerror="window.__x=1"> Tom & Jerry &amp; <b>bold</b> "q" \u2019';
  await f.fill('#jf-38-0-h', H); await f.evaluate(() => document.getElementById('jf-38-0-h').blur()); await sleep(1500);
  // a week note too
  await f.evaluate(() => document.querySelector('[data-wntoggle="38"]').click()); await sleep(300);
  await f.fill('#wn-38', '<svg onload="window.__y=1"></svg> & note'); await f.evaluate(() => document.getElementById('wn-38').blur()); await sleep(1500);
  await f.evaluate(() => hub.flush()); await sleep(800);
  // no-change blur: focus and blur the HEAR field, count vault writes
  const before = writes.filter(w => w.keys.includes('f260.journal.vault') || /journal\.vault/.test(w.path)).length;
  const vaultAt1 = (await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.journal.vault')).body.item.updated_at;
  await f.evaluate(() => { const t = document.getElementById('jf-38-0-h'); t.focus(); t.blur(); }); await sleep(1200);
  await f.evaluate(() => { const t = document.getElementById('wn-38'); t.focus(); t.blur(); }); await sleep(1200);
  await f.evaluate(() => hub.flush()); await sleep(800);
  const vaultAt2 = (await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.journal.vault')).body.item.updated_at;
  out.noChange = { vaultUnchanged: vaultAt1 === vaultAt2 };
  // search
  await f.evaluate(() => document.getElementById('tabJournal').click()); await sleep(400);
  const res = {};
  for (const q of ['img', '&', 'amp', '<', 'onerror', '"', 'b>', 'tom & j', 'svg', '\u2019']) {
    await f.fill('#jSearch', q); await sleep(250);
    res[q] = await f.evaluate(() => { const l = document.getElementById('jList'); return { imgs: l.querySelectorAll('img:not(.il)').length, svgsInTxt: l.querySelectorAll('.txt svg').length, bolds: l.querySelectorAll('dd b').length, marks: l.querySelectorAll('mark').length, stat: document.getElementById('jStat').textContent.slice(0, 40) }; });
  }
  out.search = res;
  out.flags = await f.evaluate(() => ({ x: window.__x || 0, y: window.__y || 0 }));
  out.ddText = await f.evaluate(() => { const dd = document.querySelector('#jList [data-entry="38-0"] dd'); return dd && dd.textContent; });
} catch (e) { out.err = String(e && e.stack || e); }
finally { await L.close(); }
console.log(JSON.stringify(out, null, 1));
