// Skeptic #2 for finding "tv-verse-kid-line-dead": the TV verse pane's kid line (index.html:1056 reads wk.line || wk.kid ||
// wk.text from the family kidverse 'week' row) — does any real writer ever put one of those fields there?
//   node "audits/tools/phase2/HOME/verify2-tv-verse-kid-line-dead-2.mjs"
// Steps: (0) static scan of every file that could write the row; (1) seeded row + TV pane; (2) an adult steps the week in
// Kid Verse (the one UI writer) → row shape + TV pane; (3) control: a row that *does* carry `line` (written straight to the
// local API) → the TV renders it, so the renderer works and only a writer is missing; (4) the adult steps the week again →
// the Kid Verse writer replaces the whole row and the line is gone.
// Evidence → audits/evidence/p2/HOME/verify2-tv-verse-kid-line-dead-2.json (+ -tv-seeded.png, -tv-control.png at 1×)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p2/HOME');
fs.mkdirSync(OUT, { recursive: true });
const res = { static: {}, runtime: {} };

// ── (0) static: every place outside the seeds that could write kidverse/family/'week' ──
const files = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(html|js|mjs)$/.test(e.name)) files.push(p); } };
walk(path.join(ROOT, 'apps')); walk(path.join(ROOT, 'worker', 'src')); files.push(path.join(ROOT, 'index.html'), path.join(ROOT, 'sw.js'));
const hits = [];
for (const f of files) {
  if (/apps[\\/]dollywood/.test(f)) continue;                 // generated park map, never touches kidverse
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => { if (/set\(\s*['"]week['"]/.test(l) || /key:\s*['"]week['"]/.test(l) || /['"]kidverse['"][^\n]*['"]week['"]/.test(l)) hits.push(`${path.relative(ROOT, f).replace(/\\/g, '/')}:${i + 1}: ${l.trim().slice(0, 200)}`); });
}
res.static.weekRowWriters = hits;
res.static.tvReader = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /kidline\.textContent/.test(l)).map(([n, l]) => `index.html:${n}: ${l.trim()}`);
const tvTest = fs.readFileSync(path.join(ROOT, 'scripts/test-tv.mjs'), 'utf8').split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /\['week',/.test(l)).map(([n, l]) => `scripts/test-tv.mjs:${n}: ${l.trim()}`);
res.static.testTvSeedsItsOwnLine = tvTest;

const tvPane = d => d.page.evaluate(() => {
  const kl = document.getElementById('tv-kidline');
  return {
    profile: hub.profile && { id: hub.profile.id, kind: hub.profile.kind },
    weekRowInShellCache: hub.get('week', { app: 'kidverse', scope: 'family' }),
    heading: document.getElementById('tv-verse-hd').textContent.trim(),
    refs: [...document.querySelectorAll('#tv-refs span')].map(s => s.textContent.trim()),
    kidlineText: kl.textContent,
    kidlineChildNodes: kl.childNodes.length,
    kidlineDisplay: getComputedStyle(kl).display,
    kidlineRectH: kl.getBoundingClientRect().height,
  };
});
const tvRefresh = async d => { await d.page.evaluate(async () => { await hub.pull(); window.__tv && __tv.paint(); }); await sleep(600); };
const rowNow = async () => { const r = await L.apiAs('eli', '/api/data/kidverse?scope=family&key=week'); return { status: r.status, value: r.body && r.body.item && r.body.item.value, updated_at: r.body && r.body.item && r.body.item.updated_at }; };

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  // (1) seeded row + the TV pane
  res.runtime.seededRow = await rowNow();
  const tv = await L.device({ device: 'tv', profile: 'tv' });
  await tv.goto('');
  await tv.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0 && document.getElementById('tv-kidline'), null, { timeout: 20000 });
  await sleep(1200);
  res.runtime.tvSeeded = await tvPane(tv);
  await tv.page.screenshot({ path: path.join(OUT, 'verify2-tv-verse-kid-line-dead-2-tv-seeded.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  // (2) an adult steps the week in Kid Verse — the only UI writer (apps/kidverse.html:336-339, buttons :374-376)
  const eli = await L.device({ device: 'ipad-portrait', profile: 'eli' });
  const kv = await eli.openApp('kidverse', { wait: '#week-up' });
  const before = await kv.evaluate(() => document.getElementById('week-now') && document.getElementById('week-now').textContent.trim());
  await kv.click('#week-up');
  await sleep(300);
  await kv.evaluate(async () => { await hub.flush?.(); });
  await sleep(1500);
  res.runtime.adultStep = { before, after: await kv.evaluate(() => document.getElementById('week-now').textContent.trim()), queue: (await eli.hub(kv)).queue, row: await rowNow() };
  res.runtime.adultStep.rowKeys = res.runtime.adultStep.row.value ? Object.keys(res.runtime.adultStep.row.value) : null;
  await tvRefresh(tv);
  res.runtime.tvAfterAdultStep = await tvPane(tv);

  // (3) control: a row that carries `line`, written straight to the local API as Eli — does the TV render it?
  const cur = res.runtime.adultStep.row.value || { week: 3 };
  const put = await L.apiAs('eli', '/api/data/kidverse/week?scope=family', { method: 'PUT', body: { value: { ...cur, line: 'CONTROL: God keeps his promises.', at: Date.now() }, updated_at: Date.now() } });
  res.runtime.control = { put: put.status };
  await tvRefresh(tv);
  res.runtime.control.tv = await tvPane(tv);
  await tv.page.screenshot({ path: path.join(OUT, 'verify2-tv-verse-kid-line-dead-2-tv-control.png'), scale: 'css', animations: 'disabled', caret: 'hide' });

  // (4) the adult steps the week again: Kid Verse rewrites the whole row { week, by, at } and the line disappears
  await kv.evaluate(async () => { await hub.pull(); });
  await sleep(800);
  await kv.click('#week-down');
  await sleep(300);
  await kv.evaluate(async () => { await hub.flush?.(); });
  await sleep(1500);
  res.runtime.afterSecondStep = { row: await rowNow() };
  await tvRefresh(tv);
  res.runtime.afterSecondStep.tv = await tvPane(tv);

  res.logs = { tv: tv.logs.filter(l => /error/i.test(l)).slice(0, 10), eli: eli.logs.filter(l => /error/i.test(l)).slice(0, 10) };
} catch (e) {
  res.error = String(e && e.stack || e);
} finally {
  await L.close();
}
fs.writeFileSync(path.join(OUT, 'verify2-tv-verse-kid-line-dead-2.json'), JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
