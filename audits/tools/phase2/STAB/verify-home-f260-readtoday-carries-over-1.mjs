// Skeptic #1 for STAB finding "home-f260-readtoday-carries-over".
//   node "audits/tools/phase2/STAB/verify-home-f260-readtoday-carries-over-1.mjs"
// Independent of midnight.mjs. Demo clock moved to Tue 22 Sep 2026 23:58 New York and the typical household re-seeded
// relative to it (so Elizabeth = 'mom' read on Tuesday and her f260.summary says readToday:true, as F260 writes it).
//   A  Home left open across midnight: page clock installed Tue 23:59:30, Worker clock moved to Wed 00:00:05, page run
//      3 simulated minutes with real pulls → read hero sub + F260 card.
//   B  Home freshly loaded Wednesday 07:30 (nothing left open overnight: a brand-new page) → same read.
//   C  Chat f260_status on Wednesday 07:30 as Elizabeth (scripted upstream) → the tool_result the Worker sent back.
//   D  On the B device, open F260 on Wednesday, then return Home → does it flip to "a reading waiting"?
// Output: audits/evidence/p2/STAB/verify-readtoday-1.json + verify-readtoday-1-<A|B|D>.png
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';
import { advance, settle, shot1x } from './advance.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/STAB');
const R = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const readHome = d => d.page.evaluate(() => ({
  now: new Date().toString().slice(0, 21),
  kicker: document.querySelector('#view-home .hero-kicker')?.innerText,
  sub: document.querySelector('#view-home .hero-sub')?.innerText,
  f260card: [...document.querySelectorAll('#view-home .gcard')].map(c => c.innerText.replace(/\s+/g, ' ').trim()).find(t => /Today's reading/.test(t)),
  cached: (() => { try { const k = Object.keys(localStorage).find(k => /f260/.test(k) && /person/.test(k) && !/queue/.test(k)); return k ? { key: k, summary: (JSON.parse(localStorage.getItem(k)) || {})['f260.summary'] } : null; } catch (e) { return String(e); } })(),
}));
const serverF260 = async () => {
  const r = await L.apiAs('mom', '/api/data/f260?scope=person');
  const items = r.body.items || [];
  const get = k => (items.find(i => i.key === k) || {}).value;
  const log = get('f260.log') || {};
  return { summary: get('f260.summary'), logLast3: Object.keys(log).filter(k => log[k]).sort().slice(-3) };
};
try {
  await L.clock('2026-09-22T23:58:00-04:00'); await L.reset('typical');
  R.serverTue = await serverF260();
  console.log('server Tue 23:58  ', JSON.stringify(R.serverTue));

  // A: Home left open across midnight
  const A = await L.device({ device: 'ipad-portrait', profile: 'mom', installClock: Date.parse('2026-09-22T23:59:30-04:00') });
  await A.goto('#home'); await A.page.waitForSelector('#view-home .hero-title', { timeout: 15000 });
  await advance(A, 20000); await settle(A, { min: 500 });
  R.A_before = await readHome(A);
  await L.clock('2026-09-23T00:00:05-04:00');
  await advance(A, 180000); await settle(A, { min: 500 });
  R.A_after = await readHome(A);
  await shot1x(A, path.join(OUT, 'verify-readtoday-1-A.png'));
  await A.close();
  console.log('A before', JSON.stringify({ now: R.A_before.now, sub: R.A_before.sub, card: R.A_before.f260card }));
  console.log('A after ', JSON.stringify({ now: R.A_after.now, kicker: R.A_after.kicker, sub: R.A_after.sub, card: R.A_after.f260card }));

  // B: fresh load Wednesday morning
  await L.clock('2026-09-23T07:30:00-04:00');
  R.serverWedBeforeOpen = await serverF260();
  console.log('server Wed 07:30  ', JSON.stringify(R.serverWedBeforeOpen));
  const B = await L.device({ device: 'ipad-portrait', profile: 'mom', installClock: Date.parse('2026-09-23T07:30:00-04:00') });
  await B.goto('#home'); await B.page.waitForSelector('#view-home .hero-title', { timeout: 15000 });
  await advance(B, 20000); await settle(B, { min: 500 });
  R.B = await readHome(B); R.B.sync = (await B.hub()).sync;
  await shot1x(B, path.join(OUT, 'verify-readtoday-1-B.png'));
  console.log('B fresh Wed', JSON.stringify({ now: R.B.now, kicker: R.B.kicker, sub: R.B.sub, card: R.B.f260card, lastPull: R.B.sync && R.B.sync.lastPull, state: R.B.sync && R.B.sync.state }));

  // C: chat f260_status on Wednesday
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name: 'f260_status', input: {} }] }, { text: 'ok' }]);
  const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8'));
  const list = (apps.apps || apps).map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));
  const chat = await L.apiAs('mom', '/api/chat', { method: 'POST', body: { message: 'Did I do my reading today?', apps: list } });
  const log = await L.anthropicLog();
  const toolResults = log.flatMap(e => (e.body.messages || []).flatMap(m => Array.isArray(m.content) ? m.content.filter(b => b.type === 'tool_result') : []));
  R.C = { status: chat.status, toolResult: toolResults.map(t => typeof t.content === 'string' ? t.content : JSON.stringify(t.content)).slice(-1)[0] };
  const sys = log.length ? log[log.length - 1].body.system : null;
  R.C.systemMentionsDate = typeof sys === 'string' ? (sys.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[^\n.]{0,40}/) || [null])[0] : JSON.stringify(sys || '').match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[^\\.]{0,40}/)?.[0];
  console.log('C chat status', R.C.status, 'f260_status tool_result:', (R.C.toolResult || '').slice(0, 300));
  console.log('C system prompt date:', R.C.systemMentionsDate);

  // D: open F260 on Wednesday, then back Home
  const f = await B.openApp('f260');
  await f.waitForSelector('#todayKind', { timeout: 15000 }).catch(() => {});
  await advance(B, 10000); await settle(B, { min: 800 });
  R.D_f260 = await f.evaluate(() => ({ todayKind: document.getElementById('todayKind')?.innerText, todayDate: document.getElementById('todayDate')?.innerText }));
  await B.page.evaluate(() => { location.hash = '#home'; });
  await advance(B, 10000); await settle(B, { min: 800 });
  R.D_home = await readHome(B);
  R.serverWedAfterOpen = await serverF260();
  await shot1x(B, path.join(OUT, 'verify-readtoday-1-D.png'));
  console.log('D f260 app', JSON.stringify(R.D_f260));
  console.log('D home   ', JSON.stringify({ sub: R.D_home.sub, card: R.D_home.f260card }));
  console.log('server Wed after F260 open', JSON.stringify(R.serverWedAfterOpen));
  const errs = [...A.logs, ...B.logs].filter(l => /error/i.test(l)).slice(0, 10);
  if (errs.length) console.log('page errors:', errs);
  fs.writeFileSync(path.join(OUT, 'verify-readtoday-1.json'), JSON.stringify(R, null, 1));
} finally { await L.close(); }
