// Phase 3 / dollywood: who can reach the build guide (apps.json:9 visibleTo = the five household adults).
// Kids (Ezra, Kiara) and the kiosk: Apps grid, Home, the #dollywood deep link, the viewer's app switcher, chat
// get_data/set_data through the mock upstream, and the file opened by URL. The guest (Grandma Jo): tile + tick.
//   node "audits/tools/phase3/dollywood/visibility.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const APPS = JSON.parse(fs.readFileSync('apps.json', 'utf8')).apps.map(a => ({ id: a.id, name: a.name, scope: a.scope, visibleTo: a.visibleTo }));
function sse(t) { return String(t).split('\n\n').filter(Boolean).map(c => { let ev = 'message', data = null; for (const l of c.split('\n')) { if (l.startsWith('event:')) ev = l.slice(6).trim(); else if (l.startsWith('data:')) { try { data = JSON.parse(l.slice(5)); } catch { data = l.slice(5); } } } return { ev, data }; }); }
async function chatTool(L, pid, name, input) {
  await L.anthropicLog({ clear: true });
  await L.anthropic([{ tools: [{ name, input }] }, { text: 'Done.' }]);
  const r = await L.apiAs(pid, '/api/chat', { method: 'POST', body: { message: 'please ' + name, apps: APPS } });
  const evs = typeof r.body === 'string' ? sse(r.body) : [];
  const tool = (evs.find(e => e.ev === 'tool') || {}).data || null;
  const lg = await L.anthropicLog(); const second = lg[1] && lg[1].body; let tr = null;
  if (second) { const last = second.messages[second.messages.length - 1]; const b = Array.isArray(last.content) ? last.content.find(x => x.type === 'tool_result') : null; tr = b ? { is_error: b.is_error, content: String(typeof b.content === 'string' ? b.content : JSON.stringify(b.content)).slice(0, 200) } : null; }
  return { status: r.status, ok: tool && tool.ok, chip: tool && tool.chip, toolResult: tr };
}
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const pid of ['ezra', 'kiara', 'tv', 'guest-grandmajo', 'christian']) {
    const dev = pid === 'tv' ? 'tv' : 'iphone-pwa';
    const d = await L.device({ device: dev, profile: pid, fixedTime: false });
    await d.goto('#apps'); await sleep(1500);
    const tiles = await d.page.evaluate(() => [...document.querySelectorAll('.tile[data-id]')].map(t => t.dataset.id));
    const homeMentions = await (async () => { await d.goto('#home'); await sleep(1200); return d.page.evaluate(() => /build guide|dollywood\.html|data-open="dollywood"/i.test(document.body.innerHTML.replace(/dollywood-live/g, ''))); })();
    await d.page.evaluate(() => { location.hash = '#dollywood'; }); await sleep(2500);
    const frame = d.frame('dollywood');
    const toast = await d.page.evaluate(() => [...document.querySelectorAll('.toast, [role=status]')].map(t => t.textContent.trim()).filter(Boolean).slice(0, 3));
    log(pid + '.shell', { device: dev, appsTiles: tiles, hasBuildGuideTile: tiles.includes('dollywood'), homeMentionsBuildGuide: homeMentions, deepLinkOpenedFrame: !!frame, toast });
    await d.close();
  }
  // chat: kids asking for the build guide's rows
  for (const pid of ['ezra']) {
    log(pid + '.chat.get_data', await chatTool(L, pid, 'get_data', { app_id: 'dollywood', scope: 'person', key: 'progress' }));
    log(pid + '.chat.set_data', await chatTool(L, pid, 'set_data', { app_id: 'dollywood', scope: 'person', key: 'progress', value: { 'entrance-01': true } }));
  }
  log('eli.chat.get_data (control)', await chatTool(L, 'eli', 'get_data', { app_id: 'dollywood', scope: 'person', key: 'plot' }));
  // the file opened by URL as a kid (visibleTo is client-side only: P2-SEC-02)
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
    await d.goto('#home'); await sleep(800);
    await d.page.goto(L.site + '/apps/dollywood.html'); await d.page.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
    await sleep(1500);
    const st = await d.page.evaluate(() => ({ profile: hub.profile.id, kind: hub.profile.kind, canWrite: hub.canWrite, webSearchOnCards: (() => { lastPt = [50, 50]; showOfficial(OFF.find(o => o.pos)); const has = !!document.getElementById('pop-q'); closePop(); return has; })() }));
    await d.page.evaluate(() => { document.getElementById('build').dataset.state = 'half'; document.getElementById('b-done').click(); }); await sleep(2000);
    const srv = await L.apiAs('ezra', '/api/data/dollywood?scope=person&since=0');
    log('ezra.byUrl', { ...st, serverRowsAfterTick: (srv.body.items || []).map(i => i.key + '=' + JSON.stringify(i.value).slice(0, 60)) });
    await d.close();
  }
  // the kiosk by URL: Mark done is shown, the tap is refused with the toast
  {
    const d = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
    await d.page.goto(L.site + '/apps/dollywood.html'); await d.page.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
    await sleep(800);
    const shown = await d.page.evaluate(() => ({ markDone: !!document.getElementById('b-done'), reset: !!document.getElementById('b-reset'), import: !!document.getElementById('b-import') }));
    await d.page.evaluate(() => document.getElementById('b-done').click()); await sleep(600);
    const toast = await d.page.evaluate(() => [...document.querySelectorAll('div')].map(t => t.textContent.trim()).filter(t => /only looks/.test(t)).slice(-1)[0] || null);
    const srv = await L.apiAs('tv', '/api/data/dollywood?scope=person&since=0');
    log('tv.byUrl', { ...shown, toastAfterMarkDone: toast, count: await d.page.evaluate(() => document.getElementById('b-count').textContent), serverRows: (srv.body.items || []).length, serverStatus: srv.status });
    await d.close();
  }
  // the guest ticks a step: it lands in the guest's own person scope
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'guest-grandmajo', fixedTime: false });
    const f = await d.openApp('dollywood', { wait: '#b-count' });
    await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 }); await sleep(600);
    const before = await f.evaluate(() => document.getElementById('b-count').textContent);
    await f.evaluate(() => document.getElementById('b-done').click()); await sleep(2000);
    const srv = await L.apiAs('guest-grandmajo', '/api/data/dollywood?scope=person&since=0');
    log('guest.tick', { before, after: await f.evaluate(() => document.getElementById('b-count').textContent), serverRows: (srv.body.items || []).map(i => i.key) });
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'visibility.json'), JSON.stringify(out, null, 1));
  await L.close();
}
