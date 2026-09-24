// Skeptic #1 for finding critic-share-copies-for-and-category-2 (Prayer): "Send to family list" asks only for the title,
// but copies the private request's For + category into the family row; the prayer push then puts "(for <for>)" on
// other adults' lock screens. Fresh local rig, WebKit, demo clock, VAPID throwaway pair + scripts/push-receiver.mjs
// (local stand-in push service; nothing reaches production).
// Run: node "audits/tools/phase3/prayer/verify-critic-share-copies-for-and-category-2-1.mjs"
//   -> audits/evidence/p3/prayer/verify-critic-share-copies-for-and-category-2-1.json (+ -panel.png, -mom-sheet.png, -kid.png)
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/prayer';
const P = 'verify-critic-share-copies-for-and-category-2-1';
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 700)); };
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

// stand-in push service
const rxPort = await freePort();
const rx = spawn(process.execPath, [path.resolve('scripts/push-receiver.mjs'), String(rxPort)], { stdio: ['ignore', 'pipe', 'pipe'] });
let baseSub = null; const pushes = []; let buf = '';
rx.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
  if (line.startsWith('SUBSCRIPTION ')) baseSub = JSON.parse(line.slice(13));
  const m = /^PUSH #(\d+) url=(\S+) .*payload=(.*)$/.exec(line); if (m) { let p; try { p = JSON.parse(m[3]); } catch { p = m[3]; } pushes.push({ to: m[2].split('/').pop(), payload: p }); } } });
for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
if (!baseSub) { rx.kill(); throw new Error('push receiver did not start'); }

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit', vapid: true });
const job = async () => { const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'prayer' } }); const b = r.body || {}; return { status: r.status, new: b.new, notified: (b.notified || []).map(n => n.profile), skipped: b.skipped, seeded: b.seeded }; };
async function app(profile, device = 'iphone-pwa') {
  const d = await L.device({ device, profile });
  const f = await d.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 }); await sleep(800);
  return { d, f };
}
try {
  for (const pid of ['mom', 'dad', 'christian', 'niece']) await L.apiAs(pid, '/api/push/subscribe', { method: 'POST', body: { subscription: { ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/${pid}` } } });
  await L.clock('2026-09-22T20:00:00-04:00');
  log('job baseline Tue 8 pm', await job());

  // Eli shares a private request with a For, rewriting the title to be discreet
  const { d: ed, f: ef } = await app('eli');
  if (await ef.evaluate(() => D.activeList) !== 'personal') { await ef.click('#listSwitch [data-list="personal"]'); await sleep(400); }
  const src = await ef.evaluate(() => { const p = D.lists.personal.prayers.find(x => x.id === 'p009') || D.lists.personal.prayers.find(x => x.status === 'active' && x.for); return p && { id: p.id, title: p.title, for: p.for, category: p.category }; });
  log('privateSource', src);
  await ef.click('nav [data-go="all"]'); await ef.fill('#f-search', src.title.slice(0, 14)); await sleep(300);
  await ef.click(`#allList [data-open="${src.id}"]`); await sleep(400);
  await ef.click(`[data-share="${src.id}"]`); await sleep(400);
  log('sharePanel', await ef.evaluate(() => { const a = document.querySelector('.ask'); return { text: a.innerText.replace(/\s+/g, ' ').trim(), fields: [...a.querySelectorAll('input,textarea,select')].map(i => (i.id || i.tagName) + '=' + i.value) }; }));
  await ed.shot(`${OUT}/${P}-panel.png`);
  await ef.fill('#askIn', 'A hard season for a friend');
  await ef.click('#askSave'); await sleep(3500);
  await ed.close();

  const srv = await L.apiAs('mom', '/api/data/prayer?scope=family');
  const copy = (srv.body.items || []).find(i => i.value && i.value.sharedFrom === src.id);
  log('familyRowOnServer', copy && { key: copy.key, title: copy.value.title, for: copy.value.for, category: copy.value.category, by: copy.value.by });

  // push: next scheduled run, Wed 8 am
  await L.clock('2026-09-23T08:00:00-04:00');
  const pre = pushes.length;
  log('job Wed 8 am after the share', await job());
  await sleep(800);
  log('decryptedPushes', pushes.slice(pre).map(p => ({ to: p.to, body: p.payload && p.payload.body })));

  // what another adult (Mom) sees on the family list
  const { d: md, f: mf } = await app('mom');
  if (await mf.evaluate(() => D.activeList) !== 'shared') { await mf.click('#listSwitch [data-list="shared"]'); await sleep(500); }
  const id = copy && copy.value.id;
  log('momFamilyHasCategory', await mf.evaluate(c => D.lists.shared.categories.includes(c), src.category));
  await mf.click('nav [data-go="all"]'); await mf.fill('#f-search', 'hard season'); await sleep(300);
  await mf.click(`#allList [data-open="${id}"]`); await sleep(400);
  log('momDetailSheet', await mf.evaluate(() => document.getElementById('sheetInner').innerText.replace(/\s+/g, ' ').trim().slice(0, 300)));
  await md.shot(`${OUT}/${P}-mom-sheet.png`);
  log('momCopyText', await mf.evaluate(id => { const p = D.lists.shared.prayers.find(x => x.id === id); return p && ('• ' + p.title + (p.for ? ' — ' + p.for : '')); }, id));
  await md.close();

  // what a kid sees
  const { d: kd, f: kf } = await app('kiara', 'ipad-portrait');
  log('kid', await kf.evaluate(({ id, forW, cat }) => { const body = document.body.innerText; const b = document.querySelector(`[data-kpray="${id}"]`);
    return { card: b ? b.closest('li').innerText.replace(/\s+/g, ' ').trim() : null, pageMentionsFor: body.includes(forW), pageMentionsCategory: body.includes(cat), inData: !!D.lists.shared.prayers.find(x => x.id === id) }; }, { id, forW: src.for, cat: src.category }));
  await kd.shot(`${OUT}/${P}-kid.png`);
  await kd.close();
} catch (e) { log('error', String(e.stack || e)); }
finally { fs.writeFileSync(`${OUT}/${P}.json`, JSON.stringify(res, null, 2)); await L.close(); rx.kill(); }
