// round 3: kid fold gap + one-line labels, row-tap scroll motion, U after toast replaced / with a confirm open
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const { local, sleep, DEMO } = await import(pathToFileURL(REPO + '/audits/tools/lib/local.mjs').href);
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(OUT, 'shots3'); fs.mkdirSync(SHOTS, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
async function open(d) { const f = await d.openApp('verses'); await f.waitForFunction(() => document.getElementById('trainer').getAttribute('aria-busy') === 'false', null, { timeout: 15000 }).catch(() => {}); await sleep(700); return f; }
async function dev(profile, w, h) { const d = await L.device({ device: 'iphone-pwa', profile, installClock: DEMO }); await d.page.setViewportSize({ width: w, height: h }); await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected')); return d; }
const lines = sel => `(() => { const sp = document.querySelector('${sel}'); const lh = parseFloat(getComputedStyle(sp).lineHeight) || 20; return Math.round(sp.getBoundingClientRect().height / lh); })()`;
try {
  for (const [w, h, ts] of [[375, 667], [390, 844], [430, 932], [390, 844, 'xl'], [390, 844, 'xxl'], [375, 667, 'xxl'], [430, 932, 'xxl']]) {
    const d = await dev('ezra', w, h); const f = await open(d);
    if (ts) { await f.evaluate(t => document.documentElement.setAttribute('data-text-size', t), ts); await sleep(300); }
    const before = await f.evaluate(`({ say: ${lines('#say span')}, show: ${lines('#show span')}, sayH: Math.round(document.getElementById('say').getBoundingClientRect().height), hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 })`);
    await f.evaluate(() => document.getElementById('show').scrollIntoView({ block: 'nearest' }));
    await f.locator('#show').tap(); await sleep(1000);
    const after = await f.evaluate(() => { const r = [...document.querySelectorAll('#act-rate [data-rate]')].map(b => b.getBoundingClientRect()); const top = Math.min(...r.map(x => x.top)), bot = Math.max(...r.map(x => x.bottom)); return { top: Math.round(top), bottom: Math.round(bot), gap: Math.round(innerHeight - bot), vh: innerHeight, h: Math.round(r[0].height), hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; });
    log(`kid-${w}x${h}-${ts || 'm'}`, { before, after, fully: after.top >= 0 && after.bottom <= after.vh });
    await d.page.screenshot({ path: path.join(SHOTS, `kid-${w}x${h}-${ts || 'm'}.png`) });
    await d.close();
  }
  // row-tap scroll: OS reduce + Me full (smooth expected), OS none + Me reduce (instant expected)
  for (const [os, me] of [['reduce', 'full'], ['no-preference', 'reduce'], ['no-preference', null]]) {
    const d = await dev('eli', 390, 844); await d.page.emulateMedia({ reducedMotion: os }); const f = await open(d);
    if (me) await f.evaluate(m => document.documentElement.setAttribute('data-motion', m), me);
    await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
    const y0 = await f.evaluate(() => scrollY);
    await f.evaluate(() => document.querySelectorAll('#later-list .qrow')[2].click());
    const s = []; for (let i = 0; i < 6; i++) { s.push(await f.evaluate(() => Math.round(scrollY))); await sleep(60); } await sleep(600); s.push(await f.evaluate(() => Math.round(scrollY)));
    log(`rowScroll-os:${os}-me:${me}`, { y0: Math.round(y0), samples: s, smooth: s[1] !== s[s.length - 1] && s[0] !== s[s.length - 1] });
    await d.close();
  }
  // U after the toast is replaced, and while a confirm is open; round-2 regressions
  {
    const d = await dev('eli', 390, 844); const f = await open(d);
    await f.click('#show'); await sleep(300); await f.click('#act-rate [data-rate="got"]'); await sleep(900);
    const id1 = await f.evaluate(() => verses.currentId());
    await f.evaluate(() => hub.toast('Some other message', 5000)); await sleep(200);
    await f.evaluate(() => document.activeElement && document.activeElement.blur());
    await d.page.keyboard.press('u'); await sleep(700);
    log('uAfterToastReplaced', { before: id1, after: await f.evaluate(() => verses.currentId()), revealed: await f.evaluate(() => verses.revealedNow()) });
    await f.click('#show'); await sleep(300); await f.click('#act-rate [data-rate="got"]'); await sleep(900);
    const id2 = await f.evaluate(() => verses.currentId());
    await f.evaluate(() => { window.__c = hub.confirm('Test?', { title: 'A sheet' }); }); await sleep(300);
    await d.page.keyboard.press('u'); await sleep(400); await d.page.keyboard.press('Control+z'); await sleep(400);
    log('uWithConfirmOpen', { before: id2, after: await f.evaluate(() => verses.currentId()), sheetOpen: await f.evaluate(() => !!document.querySelector('.hub-ask')) });
    await d.page.keyboard.press('Escape'); await sleep(300);
    // the toast still live: U works
    await d.page.keyboard.press('u'); await sleep(700);
    log('uAfterSheetClosedToastLive', { after: await f.evaluate(() => verses.currentId()), revealed: await f.evaluate(() => verses.revealedNow()), focus: await f.evaluate(() => document.activeElement.dataset.rate || document.activeElement.id) });
    // toast dismissed by a tap: U no longer undoes
    await f.click('#act-rate [data-rate="got"]'); await sleep(900);
    const id3 = await f.evaluate(() => verses.currentId());
    await f.click('#hub-toast', { position: { x: 10, y: 10 } }).catch(() => {}); await sleep(200);
    await d.page.keyboard.press('u'); await sleep(600);
    log('uAfterToastDismissed', { before: id3, after: await f.evaluate(() => verses.currentId()) });
    // focus regressions
    await f.focus('#show'); await d.page.keyboard.press('Enter'); await sleep(300);
    const fShow = await f.evaluate(() => document.activeElement.dataset.rate || document.activeElement.id);
    await f.click('#act-rate [data-rate="almost"]'); await sleep(900);
    const fCool = await f.evaluate(() => document.activeElement.dataset.rate || document.activeElement.id);
    await f.click('#hub-toast .toast-act'); await sleep(800);
    log('focusRegress', { afterShow: fShow, afterCooldown: fCool, afterUndo: await f.evaluate(() => document.activeElement.dataset.rate || document.activeElement.id) });
    // toast after a row tap
    await f.click('#act-rate [data-rate="got"]'); await sleep(900);
    await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
    await (await f.$$('#later-list .qrow'))[3].click(); await sleep(1000);
    await f.click('#show'); await sleep(400); await f.click('#act-rate [data-rate="got"]'); await sleep(1100);
    log('toastRow', await f.evaluate(() => { const r = document.getElementById('hub-toast').getBoundingClientRect(), ref = document.getElementById('ref').getBoundingClientRect(), tr = document.getElementById('trainer').getBoundingClientRect(); return { toast: [Math.round(r.top), Math.round(r.bottom)], trTop: Math.round(tr.top), ref: Math.round(ref.top) }; }));
    await d.page.screenshot({ path: path.join(SHOTS, 'toast-row-390.png') });
    await d.close();
  }
  for (const who of ['mom', 'eli']) { const d = await dev(who, 375, 844); const f = await open(d);
    log(`h2-${who}-375`, await f.evaluate(() => { if (document.getElementById('stats').hidden) return null; const h = document.querySelector('#stats h2'); const t = [...h.childNodes].find(n => n.nodeType === 3); const rg = document.createRange(); rg.selectNodeContents(t); return { titleLines: new Set([...rg.getClientRects()].map(r => Math.round(r.top))).size, sub: document.getElementById('stats-sub').textContent }; }));
    if (who === 'eli') {
      await f.evaluate(() => { const id = verses.trained().find(i => !verses.textOf(i)); verses.practise(id); }); await sleep(500);
      await f.click('#addtext'); await f.fill('#text-input', 'Alpha bravo charlie, delta echo foxtrot golf; hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango.'); await f.click('#text-save'); await sleep(600);
      await f.evaluate(() => versesB.setMode('order')); await sleep(300);
      const h0 = await f.evaluate(() => Math.round(document.getElementById('trainer').getBoundingClientRect().height));
      await f.click('#show'); await sleep(500);
      const h1 = await f.evaluate(() => Math.round(document.getElementById('trainer').getBoundingClientRect().height));
      log('orderShow', { h0, h1 });
      await f.evaluate(() => versesB.setMode('recall'));
    }
    await d.close(); }
} catch (e) { console.error('ERR', e); }
finally { fs.writeFileSync(path.join(OUT, 'r3.json'), JSON.stringify(res, null, 1)); await L.close(); }
