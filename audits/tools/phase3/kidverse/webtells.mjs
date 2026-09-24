// KV: the house-style web-tells list, one by one, in Kid Verse inside the shell (kid Ezra, iPhone 430×932, typical).
//   node "audits/tools/phase3/kidverse/webtells.mjs"
// 1 tap highlight / 2 long-press callout + selection on chrome and on the story art / 3 default form controls / 4 focus ring
// after a tap / 5 links / 6 background under the page (white flash proxy: html/body backgrounds) / 7 overscroll behaviour /
// 8 tap delay (touch-action) / 9 scrollbars / 10 layout shift while data loads (a cold device, GETs held 1.5 s: #done and
// #story positions sampled every 50 ms) / 11 spinners vs skeletons (placeholders at first paint) / 12 alert/confirm/prompt
// (dialogs seen during a full kid flow). Plus: where the "already" toast sits over the content.
import { local, sleep, log, saveJson, shot, pulled } from './_kv.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  const dialogs = []; d.page.on('dialog', x => { dialogs.push(x.type() + ': ' + x.message()); x.dismiss(); });
  const f = await d.openApp('kidverse', { wait: '#done:not([hidden])' }); await pulled(f); await sleep(1200);
  out.css = await f.evaluate(() => {
    const cs = (s, p) => { const e = document.querySelector(s); return e ? getComputedStyle(e).getPropertyValue(p) : null; };
    const img = document.querySelector('#art');
    return {
      tapHighlightBtn: cs('#done', '-webkit-tap-highlight-color'), tapHighlightBody: cs('body', '-webkit-tap-highlight-color'),
      userSelectBtn: cs('#done', '-webkit-user-select') || cs('#done', 'user-select'), userSelectPill: cs('#who', '-webkit-user-select') || cs('#who', 'user-select'), userSelectStars: cs('#mine', '-webkit-user-select') || cs('#mine', 'user-select'), userSelectBadges: cs('#rw-badges', '-webkit-user-select') || cs('#rw-badges', 'user-select'),
      touchCalloutImg: cs('#art', '-webkit-touch-callout'), touchCalloutBtn: cs('#done', '-webkit-touch-callout'), imgDraggable: img.draggable,
      touchActionBtn: cs('#done', 'touch-action'), overscrollHtml: cs('html', 'overscroll-behavior-y'), overscrollBody: cs('body', 'overscroll-behavior-y'),
      htmlBg: cs('html', 'background-color'), bodyBg: cs('body', 'background-color'), scrollbarWidth: innerWidth - document.documentElement.clientWidth,
      inputs: document.querySelectorAll('input, select, textarea').length, links: [...document.querySelectorAll('a[href]')].map(a => a.href), titles: [...document.querySelectorAll('[title]')].length,
      firstPaintPlaceholders: ['#ref', '#words', '#story-title', '#story-text'].map(s => document.querySelector(s).textContent.slice(0, 20)),
    };
  });
  // focus ring after a tap (touch)
  await f.tap('#say'); await sleep(200);
  out.focusAfterTap = await f.evaluate(() => ({ active: document.activeElement && document.activeElement.id, focusVisible: document.activeElement && document.activeElement.matches(':focus-visible'), shadow: getComputedStyle(document.activeElement).boxShadow.slice(0, 60) }));
  await f.tap('#say'); await sleep(200);
  // keyboard focus
  await f.press('#say', 'Tab'); await sleep(200);
  out.focusAfterTab = await f.evaluate(() => ({ active: document.activeElement && document.activeElement.id, focusVisible: document.activeElement && document.activeElement.matches(':focus-visible'), shadow: getComputedStyle(document.activeElement).boxShadow.slice(0, 80) }));
  // the "already" toast over content
  await f.tap('#done'); await sleep(500); await f.tap('#done'); await sleep(300);
  out.toast = await f.evaluate(() => { const t = document.getElementById('hub-toast'); if (!t || t.hidden) return null; const r = t.getBoundingClientRect(); const under = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).filter(e => e !== t && !t.contains(e)).slice(0, 3).map(e => (e.id ? '#' + e.id : e.className || e.tagName).toString().slice(0, 40)); return { text: t.textContent, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), vh: innerHeight, under }; });
  out.toastShot = await shot(d.page, 'webtells-toast-over-content.png');
  out.dialogs = dialogs;
  await d.close();

  // 10/11 — a cold device, every GET held 1.5 s: placeholders and positions while the data loads
  const ph = await L.newDevice({ name: 'Ezra cold phone', profiles: ['ezra'] });
  const c = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: ph });
  await c.ctx.route(/\/api\/data\/[^/?]+\?/, async r => { if (r.request().method() === 'GET') await sleep(1500); r.continue().catch(() => {}); });
  const t0 = Date.now();
  await c.goto('#kidverse');
  const samples = [];
  let fr = null;
  while (Date.now() - t0 < 6000) {
    fr = fr || c.frame('kidverse');
    if (fr) { const s = await fr.evaluate(() => { const y = q => { const e = document.querySelector(q); return e && !e.hidden ? Math.round(e.getBoundingClientRect().top + scrollY) : null; }; return { ref: document.querySelector('#ref') && document.querySelector('#ref').textContent, done: y('#done'), story: y('#story'), words: document.querySelector('#words') && document.querySelector('#words').textContent.slice(0, 16), art: document.querySelector('#art') && document.querySelector('#art').getAttribute('src') }; }).catch(() => null); if (s) samples.push({ ms: Date.now() - t0, ...s }); }
    await sleep(50);
  }
  const shifts = []; for (let i = 1; i < samples.length; i++) { const a = samples[i - 1], b = samples[i]; if (a.done != null && b.done != null && a.done !== b.done) shifts.push({ ms: b.ms, doneFrom: a.done, doneTo: b.done, storyFrom: a.story, storyTo: b.story, refFrom: a.ref, refTo: b.ref, artTo: b.art }); if (a.art !== b.art) shifts.push({ ms: b.ms, art: a.art + ' → ' + b.art }); }
  out.load = { first: samples[0], last: samples[samples.length - 1], changes: shifts };
  await c.close();
} finally { await L.close(); }
log('css', JSON.stringify(out.css));
log('focus after tap', JSON.stringify(out.focusAfterTap), '| after Tab', JSON.stringify(out.focusAfterTab));
log('toast', JSON.stringify(out.toast));
log('dialogs', JSON.stringify(out.dialogs));
log('load first', JSON.stringify(out.load.first)); log('load last', JSON.stringify(out.load.last)); log('load changes', JSON.stringify(out.load.changes));
saveJson('webtells.json', out);
