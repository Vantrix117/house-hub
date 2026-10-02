// rev5-visual probe 1: focus, toast placement after a scroll, editor, word order reveal, reduce-motion flash, XXL ratings
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const { local, sleep, DEMO } = await import(pathToFileURL(REPO + '/audits/tools/lib/local.mjs').href);
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(OUT, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const engine = process.env.ENGINE || 'webkit';
const L = await local({ variant: 'typical', clock: 'demo', engine });
const PH = 'Alpha bravo charlie, delta echo foxtrot golf; hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango.';
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
async function open(d) { const f = await d.openApp('verses'); await f.waitForFunction(() => document.getElementById('trainer').getAttribute('aria-busy') === 'false' || !document.getElementById('done').hidden || !document.getElementById('empty').hidden, null, { timeout: 15000 }).catch(() => {}); await sleep(600); return f; }
const active = f => f.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.className || a.tagName) + (a === document.body ? ' (body)' : '') : null; });
const pageActive = d => d.page.evaluate(() => { const a = document.activeElement; return a ? (a.tagName + '#' + a.id) : null; });
try {
  // ── 1. focus after rate / undo / row, toast after scroll ────────────────────────────────
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    await d.page.setViewportSize({ width: 390, height: 844 });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    const f = await open(d);
    // tab order on the card
    log('tabOrderBeforeShow', await f.evaluate(() => [...document.querySelectorAll('#trainer button, #trainer textarea, #trainer [tabindex]')].filter(e => !e.disabled && e.offsetParent && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[inert]')).map(e => e.id || e.dataset.mode || e.className)));
    await f.focus('#show'); await d.page.keyboard.press('Enter'); await sleep(300);
    log('focusAfterShowEnter', await active(f));
    await f.focus('#act-rate [data-rate="almost"]'); await d.page.keyboard.press('Enter'); await sleep(800);
    log('focusAfterRateEnter', await active(f));
    const t1 = await f.evaluate(() => { const t = document.getElementById('hub-toast'); const r = t.getBoundingClientRect(), w = document.getElementById('who').getBoundingClientRect(), ref = document.getElementById('ref').getBoundingClientRect(); return { toast: [Math.round(r.top), Math.round(r.bottom)], who: [Math.round(w.top), Math.round(w.bottom)], ref: [Math.round(ref.top), Math.round(ref.bottom)], role: t.getAttribute('role'), live: t.getAttribute('aria-live'), text: t.textContent, scrollY }; });
    log('toastAtScroll0', t1);
    await d.page.screenshot({ path: path.join(SHOTS, 'toast-scroll0-390.png') });
    // undo via keyboard: is the Undo button reachable by Tab from where focus is now?
    const tabs = [];
    for (let i = 0; i < 25; i++) { await d.page.keyboard.press('Tab'); const a = await f.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.className || a.tagName) + '|' + (a.textContent || '').trim().slice(0, 20) : null; }); tabs.push(a); if (/toast-act/.test(a)) break; }
    log('tabToUndo', tabs);
    await f.click('#hub-toast .toast-act').catch(e => log('undoClickErr', String(e).slice(0, 200)));
    await sleep(500);
    log('focusAfterUndo', await active(f));
    log('afterUndoCard', await f.evaluate(() => ({ cur: verses.currentId(), revealed: verses.revealedNow() })));
    // a row tap from the bottom of the page, then rate: where is the toast relative to the next card's reference?
    await f.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(300);
    const rows = await f.$$('#queue-list .qrow, #later-list .qrow');
    log('rows', rows.length);
    if (rows.length) {
      const last = rows[rows.length - 1]; await last.click(); await sleep(900);
      log('focusAfterRowTap', await active(f));
      log('scrollAfterRow', await f.evaluate(() => ({ y: Math.round(scrollY), trTop: Math.round(document.getElementById('trainer').getBoundingClientRect().top) })));
      await f.click('#show'); await sleep(300); await f.click('#act-rate [data-rate="got"]'); await sleep(900);
      const t2 = await f.evaluate(() => { const t = document.getElementById('hub-toast'); const r = t.getBoundingClientRect(), ref = document.getElementById('ref').getBoundingClientRect(), tr = document.getElementById('trainer'); const over = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; const ctl = [...document.querySelectorAll('#ref, #kick, #boxchip, #trainer button, #done .big, #done p, #done .btn')].filter(e => e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]')); return { toast: [Math.round(r.top), Math.round(r.bottom)], hidden: t.hidden, ref: [Math.round(ref.top), Math.round(ref.bottom)], trHidden: tr.hidden, covered: ctl.filter(e => over(r, e.getBoundingClientRect())).map(e => e.id || e.className), y: Math.round(scrollY) }; });
      log('toastAfterRowScroll', t2);
      await d.page.screenshot({ path: path.join(SHOTS, 'toast-after-row-390.png') });
    }
    await d.close();
  }
  // ── 2. editor: label, focus, Escape, Enter, focus after save ────────────────────────────
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    await d.page.setViewportSize({ width: 390, height: 844 });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    const f = await open(d);
    const hasAdd = await f.evaluate(() => !document.getElementById('addtext').hidden);
    log('addTextShown', hasAdd);
    if (hasAdd) {
      await f.click('#addtext'); await sleep(300);
      log('editorFocus', await active(f));
      log('editorLabel', await f.evaluate(() => { const t = document.getElementById('text-input'); return { labels: [...t.labels].map(l => l.textContent), note: document.getElementById('text-note').textContent, describedby: t.getAttribute('aria-describedby') }; }));
      await d.page.keyboard.press('Escape'); await sleep(300);
      log('focusAfterEscape', await active(f));
      log('viewerBarAfterEscape', await d.page.evaluate(() => { const v = document.getElementById('viewer'); return v ? { hidden: v.hidden, cls: v.className } : null; }));
      await f.click('#addtext'); await sleep(200);
      await f.fill('#text-input', PH); await d.page.keyboard.press('Enter'); await sleep(500);
      log('focusAfterSaveEnter', await active(f));
      log('textShown', await f.evaluate(() => ({ text: !document.getElementById('text').hidden, edit: document.getElementById('edittext').hidden, pm: !document.getElementById('pm').hidden })));
      await d.page.screenshot({ path: path.join(SHOTS, 'after-save-390.png') });
      // visual order vs DOM order in First letters
      await f.evaluate(() => versesB.setMode('letters')); await sleep(300);
      const ord = await f.evaluate(() => { const els = [...document.querySelectorAll('#trainer button')].filter(e => !e.disabled && e.offsetParent && getComputedStyle(e).visibility !== 'hidden'); return { dom: els.map(e => e.id || e.dataset.mode || ('w' + (e.dataset.i || ''))).slice(0, 40), visual: els.map(e => [e.id || e.dataset.mode || ('w' + (e.dataset.i || '')), Math.round(e.getBoundingClientRect().top)]).sort((a, b) => a[1] - b[1]).map(x => x[0]).slice(0, 40) }; });
      log('lettersOrder', ord);
      await d.page.screenshot({ path: path.join(SHOTS, 'letters-390.png') });
      // word order: card height before and after the last piece / Show
      await f.evaluate(() => versesB.setMode('order')); await sleep(300);
      const h0 = await f.evaluate(() => Math.round(document.getElementById('trainer').getBoundingClientRect().height));
      await d.page.screenshot({ path: path.join(SHOTS, 'order-before-390.png') });
      // reduced motion wrong piece
      await f.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduce'));
      const wrong = await f.evaluate(() => { const p = versesB.practice(); const k = p.pool.find(k => p.chunks[k] !== p.chunks[p.next]); return k; });
      await f.click(`#pm-pool .pm-chunk[data-k="${wrong}"]`); await sleep(60);
      log('reduceWrong', await f.evaluate(k => { const c = document.querySelector(`#pm-pool .pm-chunk[data-k="${k}"]`); const cs = getComputedStyle(c); return { cls: c.className, anim: cs.animationName, dur: cs.animationDuration, bg: cs.backgroundColor, transform: cs.transform }; }, wrong));
      await sleep(600);
      log('reduceWrongAfter', await f.evaluate(k => { const c = document.querySelector(`#pm-pool .pm-chunk[data-k="${k}"]`); return c.className; }, wrong));
      await f.evaluate(() => document.documentElement.removeAttribute('data-motion'));
      // a screen reader: does a wrong piece say anything?
      log('orderLive', await f.evaluate(() => ({ help: document.getElementById('pm-help')?.getAttribute('aria-live'), poolLabel: document.getElementById('pm-pool')?.getAttribute('aria-label') })));
      await f.click('#show'); await sleep(400);
      const h1 = await f.evaluate(() => Math.round(document.getElementById('trainer').getBoundingClientRect().height));
      log('orderShowHeight', { before: h0, after: h1 });
      await d.page.screenshot({ path: path.join(SHOTS, 'order-after-show-390.png') });
      log('focusAfterShowClick', await active(f));
      // Edit the text after Show, then Save via button: focus
      await f.click('#edittext'); await sleep(200); await f.click('#text-save'); await sleep(400);
      log('focusAfterSaveClick', await active(f));
      await f.evaluate(() => versesB.setMode('recall'));
    }
    await d.close();
  }
  // ── 3. XXL / XL ratings at 375 and 390, adult + kid ────────────────────────────────────
  for (const [who, w, ts] of [['eli', 375, null], ['eli', 390, null], ['eli', 390, 'xl'], ['eli', 390, 'xxl'], ['eli', 375, 'xxl'], ['ezra', 390, null], ['ezra', 390, 'xl'], ['ezra', 390, 'xxl'], ['ezra', 375, 'xxl'], ['eli', 1180, 'xxl']]) {
    const d = await L.device({ device: w > 800 ? 'ipad-landscape' : 'iphone-pwa', profile: who, installClock: DEMO });
    if (w < 800) await d.page.setViewportSize({ width: w, height: 844 });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    const f = await open(d);
    if (ts) { await f.evaluate(t => document.documentElement.setAttribute('data-text-size', t), ts); await sleep(300); }
    if (await f.evaluate(() => document.getElementById('trainer').hidden)) { log(`rate-${who}-${w}-${ts}`, 'no card'); await d.close(); continue; }
    await f.click('#show'); await sleep(450);
    const m = await f.evaluate(() => {
      const lh = e => parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2;
      return [...document.querySelectorAll('#act-rate [data-rate]')].map(b => { const r = b.getBoundingClientRect(), s = b.querySelector('span'), nx = b.querySelector('.nx'), sr = s.getBoundingClientRect();
        const lines = e => { if (!e || e.hidden || getComputedStyle(e).display === 'none') return 0; const rr = e.getClientRects(); return rr.length; };
        // a broken word: a span whose single word wraps (Range rects per line)
        const brokenWord = e => { if (!e || getComputedStyle(e).display === 'none') return false; const words = e.textContent.split(/\s+/); const rg = document.createRange(); let broken = false; const tn = e.firstChild; if (!tn || tn.nodeType !== 3) return false; let off = 0; for (const wd of words) { const i = e.textContent.indexOf(wd, off); rg.setStart(tn, i); rg.setEnd(tn, i + wd.length); const rects = [...rg.getClientRects()].filter(x => x.width > 0); if (new Set(rects.map(x => Math.round(x.top))).size > 1) broken = true; off = i + wd.length; } return broken; };
        return { rate: b.dataset.rate, w: Math.round(r.width), h: Math.round(r.height), spanLines: Math.round(sr.height / lh(s)), brokenWord: brokenWord(s) || brokenWord(nx), nx: nx && nx.textContent, nxH: nx ? Math.round(nx.getBoundingClientRect().height) : 0 }; });
    });
    const hs = await f.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    log(`rate-${who}-${w}-${ts}`, { buttons: m, hscroll: hs });
    await d.page.screenshot({ path: path.join(SHOTS, `rate-${who}-${w}-${ts || 'm'}.png`), fullPage: false });
    await d.close();
  }
  // ── 4. Open F260 from inside the hub (someone with nothing memorised) ─────────────────
  for (const who of ['niece', 'mom', 'dad', 'christian']) {
    const d = await L.device({ device: 'iphone-pwa', profile: who, installClock: DEMO });
    const f = await open(d);
    const empty = await f.evaluate(() => !document.getElementById('empty').hidden && !document.getElementById('open-f260').hidden);
    if (!empty) { await d.close(); continue; }
    await d.page.screenshot({ path: path.join(SHOTS, `empty-${who}.png`) });
    await f.click('#open-f260'); await sleep(1500);
    log('openF260', { who, frames: d.page.frames().map(x => x.url().replace(/^.*\/apps\//, '')).filter(u => u.endsWith('.html')), hash: await d.page.evaluate(() => location.hash) });
    await d.page.screenshot({ path: path.join(SHOTS, `open-f260-${who}.png`) });
    await d.close(); break;
  }
} catch (e) { console.error('ERR', e); }
finally { fs.writeFileSync(path.join(OUT, `probe1-${engine}.json`), JSON.stringify(res, null, 1)); await L.close(); }
