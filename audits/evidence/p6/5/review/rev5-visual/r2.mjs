// rev5-visual round 2: re-check findings 1-9 and hunt regressions from the fixes
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const { local, sleep, DEMO } = await import(pathToFileURL(REPO + '/audits/tools/lib/local.mjs').href);
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(OUT, 'shots2'); fs.mkdirSync(SHOTS, { recursive: true });
const engine = process.env.ENGINE || 'webkit';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = s => !ONLY || ONLY.includes(s);
const L = await local({ variant: 'typical', clock: 'demo', engine });
const PH = 'Alpha bravo charlie, delta echo foxtrot golf; hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango.';
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
async function open(d) { const f = await d.openApp('verses'); await f.waitForFunction(() => document.getElementById('trainer').getAttribute('aria-busy') === 'false' || !document.getElementById('done').hidden || !document.getElementById('empty').hidden, null, { timeout: 15000 }).catch(() => {}); await sleep(700); return f; }
const active = f => f.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.dataset.rate || a.dataset.mode || a.className || a.tagName) + (a === document.body ? ' (body)' : '') : null; });
const noWrite = d => d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
async function dev(profile, w, h, device = 'iphone-pwa') { const d = await L.device({ device, profile, installClock: DEMO }); if (w) await d.page.setViewportSize({ width: w, height: h }); await noWrite(d); return d; }
try {
  // 1. kid fold
  if (want('kid')) for (const [w, h, ts, mot] of [[375, 667], [390, 844], [430, 932], [390, 844, 'xl'], [390, 844, 'xxl'], [375, 667, 'xxl'], [430, 932, 'xxl'], [390, 844, null, 'reduce']]) {
    const d = await dev('ezra', w, h); const f = await open(d);
    if (ts) { await f.evaluate(t => document.documentElement.setAttribute('data-text-size', t), ts); await sleep(300); }
    if (mot) await f.evaluate(m => document.documentElement.setAttribute('data-motion', m), mot);
    if (await f.evaluate(() => document.getElementById('trainer').hidden)) { log(`kid-${w}x${h}-${ts}`, 'no card'); await d.close(); continue; }
    const before = await f.evaluate(() => { const s = document.getElementById('show').getBoundingClientRect(), say = document.getElementById('say').getBoundingClientRect(), p = document.getElementById('para'); const cs = getComputedStyle(p.querySelector('p')); return { vh: innerHeight, show: [Math.round(s.top), Math.round(s.bottom), Math.round(s.width), Math.round(s.height)], say: [Math.round(say.width), Math.round(say.height)], showText: document.getElementById('show').innerText.replace(/\s+/g, ' '), showLines: (() => { const sp = document.querySelector('#show span'); return Math.round(sp.getBoundingClientRect().height / (parseFloat(getComputedStyle(sp).lineHeight) || 20)); })(), sayLines: (() => { const sp = document.querySelector('#say span'); return Math.round(sp.getBoundingClientRect().height / (parseFloat(getComputedStyle(sp).lineHeight) || 20)); })(), paraFs: cs.fontSize, paraHidden: p.hidden, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; });
    await d.page.screenshot({ path: path.join(SHOTS, `kid-${w}x${h}-${ts || 'm'}${mot ? '-rm' : ''}-before.png`) });
    // tap "I said it" where it is (scroll it into view first only if needed, as a child would)
    await f.evaluate(() => document.getElementById('show').scrollIntoView({ block: 'nearest' }));
    const y0 = await f.evaluate(() => scrollY);
    await f.evaluate(() => document.getElementById('show').click());
    await sleep(60);
    const yEarly = await f.evaluate(() => scrollY);
    await sleep(900);
    const after = await f.evaluate(() => { const r = [...document.querySelectorAll('#act-rate [data-rate]')].map(b => b.getBoundingClientRect()); return { rateTop: Math.round(Math.min(...r.map(x => x.top))), rateBottom: Math.round(Math.max(...r.map(x => x.bottom))), sizes: r.map(x => [Math.round(x.width), Math.round(x.height)]), vh: innerHeight, y: Math.round(scrollY), focus: document.activeElement && (document.activeElement.dataset.rate || document.activeElement.id || document.activeElement.tagName) }; });
    log(`kid-${w}x${h}-${ts || 'm'}${mot ? '-rm' : ''}`, { before, y0, yEarly, after, fully: after.rateTop >= 0 && after.rateBottom <= after.vh });
    await d.page.screenshot({ path: path.join(SHOTS, `kid-${w}x${h}-${ts || 'm'}${mot ? '-rm' : ''}-after.png`) });
    await d.close();
  }
  // 2. toast after a row tap, scrolled
  if (want('toast')) for (const [w, h, device] of [[390, 844], [375, 667], [820, 1180, 'ipad-portrait'], [1440, 900, 'desktop']]) {
    const d = await dev('eli', device ? null : w, h, device || 'iphone-pwa'); const f = await open(d);
    await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
    const rows = await f.$$('#later-list .qrow');
    await rows[Math.min(3, rows.length - 1)].click(); await sleep(1000);
    await f.click('#show'); await sleep(400); await f.click('#act-rate [data-rate="got"]'); await sleep(1100);
    const m = await f.evaluate(() => { const t = document.getElementById('hub-toast'), r = t.getBoundingClientRect(); const over = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; const ctl = [...document.querySelectorAll('#kick, #boxchip, #ref, #hint, #trainer button, #done .big, #done p, #done .btn')].filter(e => e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]')); return { toast: [Math.round(r.top), Math.round(r.bottom)], y: Math.round(scrollY), trTop: Math.round(document.getElementById('trainer').getBoundingClientRect().top), ref: [Math.round(document.getElementById('ref').getBoundingClientRect().top), Math.round(document.getElementById('ref').getBoundingClientRect().bottom)], covered: ctl.filter(e => over(r, e.getBoundingClientRect())).map(e => e.id || e.className) }; });
    log(`toast-row-${w}`, m);
    await d.page.screenshot({ path: path.join(SHOTS, `toast-row-${w}.png`) });
    // focus after the cool-down, then U undo
    log(`focusAfterCooldown-${w}`, await active(f));
    if (w === 390) {
      await f.evaluate(() => document.activeElement && document.activeElement.blur());
      await d.page.keyboard.press('u'); await sleep(800);
      log('uUndo', { focus: await active(f), card: await f.evaluate(() => ({ cur: verses.currentId(), rev: verses.revealedNow() })), toastHidden: await f.evaluate(() => document.getElementById('hub-toast').hidden) });
      await f.click('#act-rate [data-rate="almost"]'); await sleep(900);
      await d.page.keyboard.press('Control+z'); await sleep(800);
      log('ctrlZUndo', { focus: await active(f), card: await f.evaluate(() => ({ cur: verses.currentId(), rev: verses.revealedNow() })) });
      log('undoKeyshortcuts', await f.evaluate(() => { const b = document.querySelector('#hub-toast .toast-act'); return b && { ks: b.getAttribute('aria-keyshortcuts'), title: b.title }; }));
      // U typed into a field must not undo
      await f.click('#act-rate [data-rate="almost"]'); await sleep(900);
      const hasAdd = await f.evaluate(() => !document.getElementById('addtext').hidden);
      if (hasAdd) { await f.click('#addtext'); await sleep(200); await d.page.keyboard.type('u'); await sleep(300); log('uInField', { val: await f.evaluate(() => document.getElementById('text-input').value), undone: await f.evaluate(() => verses.revealedNow()) }); await d.page.keyboard.press('Escape'); }
    }
    await d.close();
  }
  // 3. focus after Show / cool-down / Undo click / Save / Cancel; editor; word order; tab order
  if (want('focus')) {
    const d = await dev('eli', 390, 844); const f = await open(d);
    await f.focus('#show'); await d.page.keyboard.press('Enter'); await sleep(400);
    log('focusAfterShowEnter', await active(f));
    await d.page.keyboard.press('Enter'); await sleep(900);   // presses the focused rating
    log('focusAfterRateEnterCooldown', await active(f));
    await f.click('#hub-toast .toast-act'); await sleep(900);
    log('focusAfterUndoClick', await active(f));
    await f.click('#act-rate [data-rate="got"]'); await sleep(900);
    // editor on a card with no text
    await f.evaluate(() => { const id = verses.trained().find(i => !verses.textOf(i)); if (id) verses.practise(id); }); await sleep(600);
    const hasAdd = await f.evaluate(() => !document.getElementById('addtext').hidden);
    log('addVisible', hasAdd);
    if (hasAdd) {
      await f.click('#addtext'); await sleep(200);
      log('editor', await f.evaluate(() => { const t = document.getElementById('text-input'); return { focus: document.activeElement.id, desc: t.getAttribute('aria-describedby'), note: document.getElementById('text-note').textContent, label: document.getElementById('text-label').textContent }; }));
      await f.click('#text-cancel'); await sleep(300);
      log('focusAfterCancel', await active(f));
      await f.click('#addtext'); await sleep(200); await f.fill('#text-input', PH); await d.page.keyboard.press('Enter'); await sleep(500);
      log('focusAfterSaveEnter', await active(f));
      log('confirmShownOnHouseSave', await f.evaluate(() => !!document.querySelector('.hub-ask')));
      // tab order in the modes
      for (const mode of ['letters', 'gaps', 'order']) {
        await f.evaluate(m => versesB.setMode(m), mode); await sleep(300);
        const o = await f.evaluate(() => { const els = [...document.querySelectorAll('#trainer button')].filter(e => !e.disabled && e.tabIndex >= 0 && e.offsetParent && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[inert],[aria-hidden="true"]')); const name = e => e.id || e.dataset.mode || (e.dataset.i ? 'w' + e.dataset.i : e.dataset.k ? 'k' + e.dataset.k : e.className); const dom = els.map(name); const vis = els.map(e => [name(e), Math.round(e.getBoundingClientRect().top), Math.round(e.getBoundingClientRect().left)]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]); const firstWord = dom.findIndex(x => /^[wk]\d/.test(x)), firstMode = dom.indexOf('recall'); return { modeBeforeWords: firstMode >= 0 && firstMode < firstWord, domHead: dom.slice(0, 8), visHead: vis.slice(0, 8) }; });
        log(`tab-${mode}`, o);
      }
      // word order reveal height
      await f.evaluate(() => versesB.setMode('order')); await sleep(300);
      const h0 = await f.evaluate(() => Math.round(document.getElementById('trainer').getBoundingClientRect().height));
      // place every piece in order
      for (let i = 0; i < 20; i++) { const k = await f.evaluate(() => { if (verses.revealedNow()) return null; const p = versesB.practice(); return p.pool.find(k => p.chunks[k] === p.chunks[p.next] && !document.querySelector(`#pm-pool .pm-chunk[data-k="${k}"]`).disabled); }); if (k == null) break; await f.click(`#pm-pool .pm-chunk[data-k="${k}"]`); await sleep(80); }
      await sleep(500);
      const h1 = await f.evaluate(() => Math.round(document.getElementById('trainer').getBoundingClientRect().height));
      log('orderRevealHeight', { before: h0, after: h1, focus: await active(f), poolHidden: await f.evaluate(() => document.getElementById('pm-pool')?.getAttribute('aria-hidden')) });
      await d.page.screenshot({ path: path.join(SHOTS, 'order-revealed-390.png') });
      await f.evaluate(() => versesB.setMode('recall'));
    }
    // qrow press + stats labels + h2
    log('qrowPressRule', await f.evaluate(() => { for (const s of document.styleSheets) for (const r of s.cssRules) if (r.selectorText && r.selectorText.includes('.qrow:active')) return r.style.transform; }));
    await d.close();
  }
  if (want('h2')) for (const who of ['mom', 'dad', 'christian', 'eli']) for (const w of [375, 390, 430]) {
    const d = await dev(who, w, 844); const f = await open(d);
    const m = await f.evaluate(() => { if (document.getElementById('stats').hidden) return null; const h = document.querySelector('#stats h2'); const t = [...h.childNodes].find(n => n.nodeType === 3); const rg = document.createRange(); rg.selectNodeContents(t); const titleLines = new Set([...rg.getClientRects()].map(r => Math.round(r.top))).size; const labels = [...document.querySelectorAll('#stats .stat:not([hidden]) span')].map(s => { const lh = parseFloat(getComputedStyle(s).lineHeight) || 16; return [s.textContent, Math.round(s.getBoundingClientRect().height / lh), getComputedStyle(s).fontSize]; }); return { titleLines, sub: document.getElementById('stats-sub').textContent, subTop: Math.round(document.getElementById('stats-sub').getBoundingClientRect().top - h.getBoundingClientRect().top), labels }; });
    log(`h2-${who}-${w}`, m);
    if (who === 'mom' && w === 375) await d.page.screenshot({ path: path.join(SHOTS, 'h2-mom-375.png') });
    await d.close();
  }
  // 4. a private F260 paste: "Share this text with the house"
  if (want('share')) {
    const d = await dev('eli', 390, 844); const f = await open(d);
    const id = await f.evaluate(() => { const t = (window.hub.get('f260.verses', { app: 'f260', scope: 'person' }) || {}); return Object.keys(t).find(k => verses.trained().includes(k) && !hub.get('text:' + k, { app: 'verses', scope: 'family' })) || null; });
    log('privatePasteId', id);
    if (id) {
      await f.evaluate(i => verses.practise(i), id); await sleep(600);
      const pre = await f.evaluate(() => ({ editBtn: { hidden: document.getElementById('edittext').hidden, vis: getComputedStyle(document.getElementById('edittext')).visibility, text: document.getElementById('edittext').textContent.trim() } }));
      await f.click('#show'); await sleep(400);
      const post = await f.evaluate(() => { const b = document.getElementById('edittext'), r = b.getBoundingClientRect(), sp = b.querySelector('span'); return { text: b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), lines: Math.round(sp.getBoundingClientRect().height / (parseFloat(getComputedStyle(sp).lineHeight) || 20)), cardH: Math.round(document.getElementById('trainer').getBoundingClientRect().height) }; });
      log('shareBtn', { pre, post });
      await d.page.screenshot({ path: path.join(SHOTS, 'share-btn-390.png') });
      await f.click('#edittext'); await sleep(300);
      log('shareEditor', await f.evaluate(() => ({ label: document.getElementById('text-label').textContent, note: document.getElementById('text-note').textContent, focus: document.activeElement.id })));
      await d.page.keyboard.press('Enter'); await sleep(500);
      const ask = await f.evaluate(() => { const s = document.querySelector('.hub-ask .sheet'); return s && { title: s.querySelector('h2')?.textContent, text: s.textContent.slice(0, 200), focus: document.activeElement.textContent }; });
      log('shareConfirm', ask);
      await d.page.screenshot({ path: path.join(SHOTS, 'share-confirm-390.png') });
      await d.page.keyboard.press('Escape'); await sleep(400);
      log('afterConfirmEscape', { focus: await active(f), editing: await f.evaluate(() => !document.getElementById('textedit').hidden), houseRow: await f.evaluate(i => !!hub.get('text:' + i, { app: 'verses', scope: 'family' }), id) });
      // a second Escape closes the editor, focus back
      await d.page.keyboard.press('Escape'); await sleep(300);
      log('afterEditorEscape', await active(f));
      // now share for real
      await f.click('#edittext'); await sleep(200); await f.click('#text-save'); await sleep(400);
      const yes = await f.$('.hub-ask .btn-primary'); if (yes) { await yes.click(); await sleep(500); }
      log('afterShare', { focus: await active(f), houseRow: await f.evaluate(i => !!hub.get('text:' + i, { app: 'verses', scope: 'family' }), id), editLabel: await f.evaluate(() => document.getElementById('edittext').textContent.trim()) });
    }
    await d.close();
  }
  // 5. recorder row at 390 (Chromium), and Reduce-Motion row tap scroll
  if (want('rec')) {
    const d = await dev('eli', 390, 844);
    await d.ctx.addInitScript(() => { if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { const ac = new AudioContext(); const dst = ac.createMediaStreamDestination(); const o = ac.createOscillator(); o.connect(dst); o.start(); return dst.stream; }; });
    const f = await open(d);
    const m = await f.evaluate(() => { const g = id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; }; return { rec: g('rec'), addtext: g('addtext'), actShow: g('act-show'), vh: innerHeight, canRecord: versesB.canRecord, cardH: Math.round(document.getElementById('trainer').getBoundingClientRect().height) }; });
    log(`rec390-${engine}`, m);
    await d.page.screenshot({ path: path.join(SHOTS, `rec390-${engine}.png`) });
    const b = await f.evaluate(() => Math.round(document.getElementById('trainer').getBoundingClientRect().height)); await f.click('#show'); await sleep(500);
    const a = await f.evaluate(() => Math.round(document.getElementById('trainer').getBoundingClientRect().height));
    log(`rec390-jump-${engine}`, { b, a });
    await d.close();
  }
  if (want('rm')) {
    const d = await dev('eli', 390, 844); const f = await open(d);
    await f.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduce'));
    await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
    const y0 = await f.evaluate(() => scrollY);
    await f.evaluate(() => document.querySelector('#later-list .qrow').click());
    const y1 = await f.evaluate(() => scrollY); await sleep(50); const y2 = await f.evaluate(() => scrollY); await sleep(700); const y3 = await f.evaluate(() => scrollY);
    log('rmRowScroll', { y0, immediate: y1, at50: y2, final: y3 });
    // OS reduce + Me full motion
    await f.evaluate(() => document.documentElement.setAttribute('data-motion', 'full'));
    await d.page.emulateMedia({ reducedMotion: 'reduce' });
    await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
    await f.evaluate(() => document.querySelectorAll('#later-list .qrow')[1].click());
    const z1 = await f.evaluate(() => scrollY); await sleep(50); const z2 = await f.evaluate(() => scrollY); await sleep(700); const z3 = await f.evaluate(() => scrollY);
    log('osReduceMeFullRowScroll', { immediate: z1, at50: z2, final: z3 });
    await d.close();
  }
} catch (e) { console.error('ERR', e); }
finally { fs.writeFileSync(path.join(OUT, `r2-${engine}.json`), JSON.stringify(res, null, 1)); await L.close(); }
