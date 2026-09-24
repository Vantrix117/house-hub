// Skeptic #2 for STAB finding "home-f260-readtoday-carries-over" (audit Phase 2). Independent of midnight.mjs:
// the "read today" flag is produced by the F260 app itself (Eli ticks Done on Tuesday), not taken from the seed.
//   node "audits/tools/phase2/STAB/verify-home-f260-readtoday-carries-over-2.mjs"
// Steps (all on the local rig, typical household, demo clock):
//   T  Tue 22 Sep 08:40 NY: Eli (seed: not read today) opens F260 on the iPad and taps Done → server summary/log checked.
//   B  Page left open across midnight: Worker at Tue 23:59:00, an iPad Home with an installed clock, 20 s → read;
//      Worker to Wed 00:00:10, the page runs 3 more simulated minutes (real pulls, advance.mjs) → read.
//   A  Cold launch next morning: Worker at Wed 23 Sep 07:30, a fresh iPad context (clock fixed at Wed 07:30) → Home;
//      the TV (kiosk) at the same instant → its "Reading today" faces.
//   C  Chat f260_status as Eli on Wednesday (scripted upstream) → the tool_result the model receives.
//   E  The Worker's 8 pm evening job forced on Wednesday → whether it judges Eli as read today (mitigation check).
//   F  On the Wednesday iPad, Eli opens F260, then goes back Home → does Home correct itself?
// Output: audits/evidence/p2/STAB/verify-home-f260-readtoday-carries-over-2.json (+ -wed-home.png, -wed-tv.png)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { advance, settle, shot1x } from './advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const TAG = 'verify-home-f260-readtoday-carries-over-2';
const R = {};
const log = (k, v) => { R[k] = v; console.log(k.padEnd(14), JSON.stringify(v)); };
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));
const serverF260 = async pid => {
  const items = (await L.apiAs(pid, '/api/data/f260?scope=person')).body.items || [];
  const row = k => items.find(r => r.key === k);
  const s = row('f260.summary'), lg = row('f260.log');
  return { summary: s && { readToday: s.value.readToday, weekDone: s.value.weekDone, next: s.value.next && s.value.next.ref, streak: s.value.streak, updated_at: new Date(s.updated_at).toString().slice(0, 24) },
    logTail: lg ? Object.keys(lg.value).filter(k => lg.value[k]).sort().slice(-3) : [] };
};
const homeRead = d => d.page.evaluate(() => {
  const c = document.querySelector('#view-home .gcard');
  return { now: new Date().toString().slice(0, 21), kicker: document.querySelector('#view-home .hero-kicker')?.innerText,
    sub: document.querySelector('#view-home .hero-sub')?.innerText,
    f260card: c && /reading/i.test(c.innerText) ? c.innerText.replace(/\s+/g, ' ').trim() : null,
    lastPull: window.hub && hub.sync.lastPull ? new Date(hub.sync.lastPull).toString().slice(0, 24) : null, sync: window.hub && hub.sync.state };
});
const waitPulled = d => d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.querySelector('#view-home .hero-title'), null, { timeout: 20000 });

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  // ── T: Tuesday, Eli ticks today's reading in F260 ──
  log('T.server0', await serverF260('eli'));
  const tue = await L.device({ device: 'ipad-portrait', profile: 'eli' });           // clock fixed at the demo instant (Tue 08:40)
  await tue.goto('#home'); await waitPulled(tue); await sleep(800);
  log('T.homeBefore', await homeRead(tue));
  const f = await tue.openApp('f260', { wait: '#todayDone' });
  await f.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.getElementById('todayDone').dataset.target, null, { timeout: 20000 });
  await f.click('#todayDone');
  for (let i = 0; i < 40; i++) { await sleep(250); const s = await serverF260('eli'); if (s.summary && s.summary.readToday && s.logTail.includes('2026-09-22')) break; }
  log('T.serverAfter', await serverF260('eli'));
  await tue.goto('#home'); await waitPulled(tue); await sleep(800);
  log('T.homeAfter', await homeRead(tue));
  await tue.close();

  // ── B: a Home page left open across midnight ──
  await L.clock('2026-09-22T23:59:00-04:00');
  const nb = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: Date.parse('2026-09-22T23:59:00-04:00') });
  await nb.goto('#home'); await nb.page.waitForSelector('#view-home .hero-title', { timeout: 15000 });
  await advance(nb, 20000); await settle(nb, { min: 500 });
  log('B.before', await homeRead(nb));
  await L.clock('2026-09-23T00:00:10-04:00');
  await advance(nb, 180000); await settle(nb, { min: 500 });
  log('B.after', await homeRead(nb));
  await nb.close();

  // ── A: cold launch on Wednesday morning ──
  const WED = Date.parse('2026-09-23T07:30:00-04:00');
  await L.clock('2026-09-23T07:30:00-04:00');
  const wed = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: WED });
  await wed.goto('#home'); await waitPulled(wed); await sleep(1000);
  log('A.homeWed', await homeRead(wed));
  log('A.serverWed', await serverF260('eli'));
  await shot1x(wed, path.join(OUT, TAG + '-wed-home.png'));
  const tv = await L.device({ device: 'tv', profile: 'tv', fixedTime: WED });
  await tv.goto('#home'); await tv.page.waitForSelector('#tv #clock', { timeout: 15000 });
  await tv.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(1500);
  log('A.tvWed', await tv.page.evaluate(() => ({ date: document.getElementById('tv-date')?.innerText, read: [...document.querySelectorAll('#tv-read .tv-face')].map(x => (x.classList.contains('off') ? '(dim) ' : '') + x.innerText.replace(/\s+/g, ' ').trim()) })));
  await shot1x(tv, path.join(OUT, TAG + '-wed-tv.png'));
  await tv.close();

  // ── C: chat f260_status on Wednesday ──
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name: 'f260_status', input: {} }] }, { text: 'ok' }]);
  const cr = await L.apiAs('eli', '/api/chat', { method: 'POST', body: { message: 'Have I done my reading today?', apps } });
  const up = await L.anthropicLog();
  const second = up[1] && up[1].body; const last = second && second.messages[second.messages.length - 1];
  const tr = last && Array.isArray(last.content) ? last.content.find(b => b.type === 'tool_result') : null;
  log('C.chatStatus', cr.status);
  log('C.toolResult', tr ? String(typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content)).slice(0, 400) : null);

  // ── E: the Worker's own 8 pm check on Wednesday ──
  await L.clock('2026-09-23T20:00:00-04:00');
  const ev = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'evening' } });
  log('E.evening', { status: ev.status, date: ev.body && ev.body.date, eli: ev.body && (ev.body.checked || []).find(c => c.profile === 'eli'), notified: ev.body && ev.body.notified, skipped: ev.body && ev.body.skipped });
  await L.clock('2026-09-23T07:31:00-04:00');

  // ── F: Eli opens F260 on Wednesday, then Home again ──
  const f2 = await wed.openApp('f260', { wait: '#todayKind' });
  await f2.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 20000 }); await sleep(800);
  log('F.f260Wed', await f2.evaluate(() => ({ kind: document.getElementById('todayKind')?.innerText, date: document.getElementById('todayDate')?.innerText })));
  for (let i = 0; i < 40; i++) { await sleep(250); const s = await serverF260('eli'); if (s.summary && s.summary.readToday === false) break; }
  log('F.serverAfter', await serverF260('eli'));
  await wed.goto('#home'); await waitPulled(wed); await sleep(1000);
  log('F.homeAfter', await homeRead(wed));
  fs.writeFileSync(path.join(OUT, TAG + '.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
