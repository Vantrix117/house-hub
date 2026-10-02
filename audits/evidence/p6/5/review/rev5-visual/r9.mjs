// round 8: the kicker/line slot, no jump, the line in view after a rating on iPad landscape, top band, kid icons, mode labels
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const { local, sleep, DEMO } = await import(pathToFileURL(REPO + '/audits/tools/lib/local.mjs').href);
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(OUT, 'shots9'); fs.mkdirSync(SHOTS, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
async function open(d) { const f = await d.openApp('verses'); await f.waitForFunction(() => document.getElementById('trainer').getAttribute('aria-busy') === 'false', null, { timeout: 15000 }).catch(() => {}); await sleep(800); return f; }
async function dev(profile, w, h, device = 'iphone-pwa') { const d = await L.device({ device, profile, installClock: DEMO }); if (w) await d.page.setViewportSize({ width: w, height: h }); await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected')); return d; }
const geo = f => f.evaluate(() => { const g = id => { const e = document.getElementById(id); if (!e || e.hidden || !e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; }; const tr = document.getElementById('trainer').getBoundingClientRect(); const k = document.querySelector('#trainer .kick'); return { vh: innerHeight, y: Math.round(scrollY), trTop: Math.round(tr.top), trH: Math.round(tr.height), kick: k ? [Math.round(k.getBoundingClientRect().top), Math.round(k.getBoundingClientRect().bottom), getComputedStyle(k).visibility] : null, rated: g('rated'), ref: g('ref'), show: g('show'), actRate: g('act-rate'), addtext: g('addtext'), say: g('say') }; });
try {
  for (const [who, w, h, device, withText] of []) {
    const d = await dev(who, w, h, device || 'iphone-pwa'); const f = await open(d);
    if (who === 'eli' && withText !== undefined) { const id = await f.evaluate(t => verses.trained().find(i => !!verses.textOf(i) === t), withText); await f.evaluate(i => verses.practise(i), id); await f.evaluate(() => scrollTo(0, 0)); await sleep(500); }
    const a = await geo(f);
    // the top of the card: gap from card top to the kicker before any rating
    const topGap = a.kick ? a.kick[0] - a.trTop : null;
    await d.page.screenshot({ path: path.join(SHOTS, `${who}-${w || device}-${withText ? 'text' : 'm'}-0.png`) });
    await f.locator('#show').click(); await sleep(900);
    const b = await geo(f);
    await d.page.screenshot({ path: path.join(SHOTS, `${who}-${w || device}-${withText ? 'text' : 'm'}-1shown.png`) });
    await f.locator('#act-rate [data-rate="almost"]').click(); await sleep(60);
    const c = await geo(f);
    await sleep(900);
    const e = await geo(f);
    const line = await f.evaluate(() => { const l = document.getElementById('rated'), t = document.getElementById('rated-text'), r = l.getBoundingClientRect(); return { text: t.textContent, top: Math.round(r.top), bottom: Math.round(r.bottom), inView: r.top >= 0 && r.bottom <= innerHeight, parent: l.parentElement.id }; });
    await d.page.screenshot({ path: path.join(SHOTS, `${who}-${w || device}-${withText ? 'text' : 'm'}-2rated.png`) });
    try { await d.ctx.clock.runFor(10500); } catch { await sleep(10500); } await sleep(400);
    const g2 = await geo(f);
    const kidIcons = who === 'ezra' ? await f.evaluate(() => [...document.querySelectorAll('#act-rate [data-rate] .pic use, #show use, #say use')].map(u => u.getAttribute('href').replace(/^.*#/, ''))) : null;
    log(`${who}-${w || device}-${withText ? 'text' : 'm'}`, { topGap, before: { trTop: a.trTop, kick: a.kick, ref: a.ref, show: a.show }, shown: { y: b.y, ref: b.ref, actRate: b.actRate, addtext: b.addtext }, during: { y: c.y, kick: c.kick, rated: c.rated, ref: c.ref, actRate: c.actRate }, next: { y: e.y, kick: e.kick, rated: e.rated, ref: e.ref, show: e.show }, line, afterFade: { kick: g2.kick, rated: g2.rated, ref: g2.ref }, kidIcons });
    await d.close();
  }
  // mode labels at 375/390/430 and XL/XXL
  for (const [w, ts] of [[375], [390], [430], [390, 'xl'], [375, 'xxl']]) {
    const d = await dev('eli', w, 844); const f = await open(d);
    const id = await f.evaluate(() => verses.trained().find(i => verses.textOf(i))); await f.evaluate(i => verses.practise(i), id); await sleep(400);
    if (ts) { await f.evaluate(t => document.documentElement.setAttribute('data-text-size', t), ts); await sleep(300); }
    const m = await f.evaluate(() => { const bs = [...document.querySelectorAll('#pm-modes button')]; return bs.map(b => { const r = b.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(b).lineHeight) || 18; return [b.textContent, Math.round(r.width), Math.round(r.height), Math.round(r.top), b.getAttribute('aria-label')]; }); });
    log(`modes-${w}-${ts || 'm'}`, { rows: new Set(m.map(x => x[3])).size, m, hscroll: await f.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) });
    await f.evaluate(() => document.getElementById('pm').scrollIntoView()); await sleep(150);
    await d.page.screenshot({ path: path.join(SHOTS, `modes-${w}-${ts || 'm'}.png`) });
    await d.close();
  }
  // the Due today header
  { const d = await dev('eli', 390, 844); const f = await open(d); log('queueHeader', await f.evaluate(() => ({ h: document.getElementById('queue-h').textContent, lines: (() => { const s = document.getElementById('queue-sub'); return Math.round(s.getBoundingClientRect().height / (parseFloat(getComputedStyle(s).lineHeight) || 16)); })() }))); await d.close(); }
} catch (e) { console.error('ERR', e); }
finally { fs.writeFileSync(path.join(OUT, 'r9.json'), JSON.stringify(res, null, 1)); await L.close(); }
