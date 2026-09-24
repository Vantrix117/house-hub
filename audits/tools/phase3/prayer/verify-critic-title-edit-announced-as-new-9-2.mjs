// Phase 3 / Prayer — skeptic #2 for "critic-title-edit-announced-as-new-9".
//   node "audits/tools/phase3/prayer/verify-critic-title-edit-announced-as-new-9-2.mjs"
// Claim: editing an existing family request's title (Edit sheet, apps/prayer.html:1050-1063) changes the prayer job's
// fingerprint createdAt|title (worker/src/reminders.js:157, 181) so the next prayer run pushes it as "New on the family list".
// Independent of critic-push-share.mjs: real end-to-end push through the stand-in receiver (scripts/push-receiver.mjs),
// every adult subscribed, and two controls: (a) a run with nothing changed, (b) Mae edits only the Detail field.
// Server clock moved to Wed 23 Sep so no earlier push_log row gates the day. Writes
// audits/evidence/p3/prayer/verify-critic-title-edit-announced-as-new-9-2.json (+ a PNG of the edited request).
import { local, sleep } from '../../lib/local.mjs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p3/prayer');
const NAME = 'verify-critic-title-edit-announced-as-new-9-2';
const res = { steps: [] };
const log = (k, v) => { res[k] = v; console.log(k, '->', JSON.stringify(v).slice(0, 700)); };
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

const rxPort = await freePort();
const rx = spawn(process.execPath, [path.join(ROOT, 'scripts/push-receiver.mjs'), String(rxPort)], { stdio: ['ignore', 'pipe', 'pipe'] });
let baseSub = null, buf = ''; const pushes = [];
rx.stdout.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (line.startsWith('SUBSCRIPTION ')) baseSub = JSON.parse(line.slice(13));
    const m = /^PUSH #\d+ url=(\S+) .*payload=(.*)$/.exec(line);
    if (m) { let p; try { p = JSON.parse(m[2]); } catch { p = { body: m[2] }; } pushes.push({ to: m[1].split('/').pop(), body: p.body }); }
  }
});
for (let t = 0; !baseSub && t < 100; t++) await sleep(100);
if (!baseSub) { rx.kill(); throw new Error('push receiver did not start'); }

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit', vapid: true });
const run = async label => {
  const mark = pushes.length;
  const r = await L.apiAs('eli', '/api/admin/cron/run', { method: 'POST', body: { job: 'prayer' } });
  await sleep(800);
  const b = r.body || {};
  const s = { label, status: r.status, seeded: b.seeded || null, new: b.new, notified: (b.notified || []).map(n => n.profile),
    skipped: (b.skipped || []).map(x => `${x.profile}:${x.why}`), pushesReceived: pushes.slice(mark) };
  res.steps.push(s); console.log(label, '->', JSON.stringify(s));
  return s;
};
const row = async () => { const r = await L.apiAs('christian', '/api/data/prayer?scope=family'); const i = (r.body.items || []).find(x => x.key === 'prayer:s002'); return i && { title: i.value.title, detail: i.value.detail, createdAt: i.value.createdAt, by: i.value.by, updatedAt: i.value.updatedAt }; };
let md;
try {
  const adults = L.S.profiles.filter(p => p.kind === 'adult').map(p => p.id);
  log('adults', adults);
  for (const id of adults) {
    const r = await L.apiAs(id, '/api/push/subscribe', { method: 'POST', body: { subscription: { ...baseSub, endpoint: `http://127.0.0.1:${rxPort}/push/${id}` } } });
    if (r.status !== 200) throw new Error('subscribe ' + id + ' -> ' + r.status);
  }
  await L.clock('2026-09-23T07:00:00-04:00');
  await run('run0 baseline (seed/advance watermark)');
  await run('run1 control: nothing changed');
  log('s002 before', await row());

  md = await L.device({ device: 'iphone-pwa', profile: 'christian' });
  const f = await md.openApp('prayer', { wait: '#todayLine' });
  await f.waitForFunction(() => document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 15000 }); await sleep(800);
  await f.click('#listSwitch [data-list="shared"]'); await sleep(600);
  const openEdit = async () => {
    await f.click('nav [data-go="all"]'); await sleep(300);
    await f.fill('#f-search', 'Grandma'); await sleep(400);
    await f.click('#allList [data-open="s002"]'); await sleep(400);
    await f.click('[data-edit="s002"]'); await sleep(400);
  };
  // control (b): detail-only edit
  await openEdit();
  await f.fill('#e-detail', 'Flight lands Saturday noon.');
  await f.click('[data-esave="s002"]'); await sleep(3500);
  log('s002 after detail-only edit', await row());
  await run('run2 control: after a detail-only edit');
  // the claim: title edit
  // Save re-renders the request's sheet (sheetFor, apps/prayer.html:1062); open Edit again from there
  await L.clock('2026-09-23T12:00:00-04:00');
  await f.click('[data-edit="s002"]'); await sleep(400);
  const oldTitle = await f.inputValue('#e-title');
  await f.fill('#e-title', oldTitle.replace('this week', 'this weekend'));
  await f.click('[data-esave="s002"]'); await sleep(3500);
  await md.shot(path.join(OUT, `${NAME}-edited-sheet.png`));
  log('s002 after title edit', await row());
  await L.clock('2026-09-23T20:00:00-04:00');
  const s3 = await run('run3 after the title edit (Wed 8 pm)');
  log('verdictData', { newAfterTitleEdit: s3.new, pushedTo: s3.pushesReceived.map(p => p.to), editorMaeGotIt: s3.pushesReceived.some(p => p.to === 'christian'),
    authorEliGotIt: s3.pushesReceived.some(p => p.to === 'eli'), bodies: [...new Set(s3.pushesReceived.map(p => p.body))] });
} catch (e) { log('error', String(e.stack || e)); }
finally {
  fs.writeFileSync(path.join(OUT, `${NAME}.json`), JSON.stringify(res, null, 2));
  if (md) await md.close();
  await L.close(); rx.kill();
}
