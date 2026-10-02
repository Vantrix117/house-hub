// round 4: kid buttons before a tap on short screens, ratings gap after, XL/XXL; queue references one line
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const { local, sleep, DEMO } = await import(pathToFileURL(REPO + '/audits/tools/lib/local.mjs').href);
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(OUT, 'shots8q'); fs.mkdirSync(SHOTS, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
async function open(d) { const f = await d.openApp('verses'); await f.waitForFunction(() => document.getElementById('trainer').getAttribute('aria-busy') === 'false', null, { timeout: 15000 }).catch(() => {}); await sleep(700); return f; }
async function dev(profile, w, h, device = 'iphone-pwa') { const d = await L.device({ device, profile, installClock: DEMO }); if (w) await d.page.setViewportSize({ width: w, height: h }); await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected')); return d; }
try {
  for (const [w, h, ts, device] of [[375, 667], [430, 740, null, 'iphone-safari'], [390, 844], [430, 932], [375, 667, 'xl'], [375, 667, 'xxl'], [390, 844, 'xxl'], [430, 740, 'xxl', 'iphone-safari']]) {
    const d = await dev('ezra', device ? null : w, h, device); const f = await open(d);
    if (ts) { await f.evaluate(t => document.documentElement.setAttribute('data-text-size', t), ts); await sleep(300); }
    const before = await f.evaluate(() => { const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), Math.round(b.height)]; }; const p = document.getElementById('para'); const sm = p.querySelector('small'); return { vh: innerHeight, say: r('say'), show: r('show'), visible: document.getElementById('show').getBoundingClientRect().bottom <= innerHeight, kicker: p.querySelector('.kicker').textContent, kickerShown: getComputedStyle(p.querySelector('.kicker')).display !== 'none', smallShown: sm ? getComputedStyle(sm).display !== 'none' : false, paraFs: getComputedStyle(p.querySelector('p')).fontSize, hintFs: getComputedStyle(document.getElementById('hint')).fontSize, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; });
    await d.page.screenshot({ path: path.join(SHOTS, `kid-${w}x${h}-${ts || 'm'}-before.png`) });
    await f.evaluate(() => document.getElementById('show').scrollIntoView({ block: 'nearest' }));
    await f.locator('#show').tap(); await sleep(1000);
    const after = await f.evaluate(() => { const r = [...document.querySelectorAll('#act-rate [data-rate]')].map(b => b.getBoundingClientRect()); const bot = Math.max(...r.map(x => x.bottom)), top = Math.min(...r.map(x => x.top)); return { top: Math.round(top), gap: Math.round(innerHeight - bot), h: Math.round(r[0].height), fully: top >= 0 && bot <= innerHeight }; });
    log(`kid-${w}x${h}-${ts || 'm'}`, { before, after });
    await d.page.screenshot({ path: path.join(SHOTS, `kid-${w}x${h}-${ts || 'm'}-after.png`) });
    await d.close();
  }
  for (const [w, ts] of [[375], [390], [430], [375, 'xxl'], [430, 'xxl']]) {
    const d = await dev('eli', w, 844); const f = await open(d);
    if (ts) { await f.evaluate(t => document.documentElement.setAttribute('data-text-size', t), ts); await sleep(300); }
    const m = await f.evaluate(() => { const rows = [...document.querySelectorAll('.queue .rf')]; const broken = rows.filter(rf => { const t = [...rf.childNodes].find(n => n.nodeType === 3); if (!t) return false; const rg = document.createRange(); rg.selectNodeContents(t); return new Set([...rg.getClientRects()].map(r => Math.round(r.top))).size > 1; }).map(rf => rf.firstChild.textContent); const over = [...document.querySelectorAll('.queue .qrow *')].filter(e => e.getBoundingClientRect().right > e.closest('.qrow').getBoundingClientRect().right + 1).length; const rowH = [...document.querySelectorAll('.queue .qrow')].map(q => Math.round(q.getBoundingClientRect().height)); return { rows: rows.length, broken, overflowInRow: over, minRow: Math.min(...rowH), maxRow: Math.max(...rowH), hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; });
    log(`queue-${w}-${ts || 'm'}`, m);
    await f.evaluate(() => document.getElementById('later-list').scrollIntoView()); await sleep(200);
    await d.page.screenshot({ path: path.join(SHOTS, `queue-${w}-${ts || 'm'}.png`) });
    await d.close();
  }
} catch (e) { console.error('ERR', e); }
finally { fs.writeFileSync(path.join(OUT, 'r8q.json'), JSON.stringify(res, null, 1)); await L.close(); }
