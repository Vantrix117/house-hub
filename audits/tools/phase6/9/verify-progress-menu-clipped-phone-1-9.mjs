// Batch 9 copy of audits/tools/phase3/dollywood/verify-progress-menu-clipped-phone-1.mjs.
// WHAT CHANGED AND WHY: the original taps Reset and looks for a native dialog, then carries on. The guide's Reset has long asked through the hub's own
// confirm sheet (#ask-bd / #ask-t, not window.confirm), and that sheet stays open until answered, so the next #b-menu click is intercepted by its backdrop.
// This copy (a) counts the confirm sheet as the Reset "dialog" (fired:true, dialog:"Reset progress?") and (b) answers it with Cancel (#ask-no) after each
// tap so the sheet never stays in front. The finding itself (the phone's menu clipped by the sheet, taps lost) is judged as before from the measures and
// taps: since batch 9 the menu is a bottom action sheet over the build sheet, so every row is whole and tappable.
// Skeptic #1 for finding "progress-menu-clipped-phone" (Dollywood build guide, apps/dollywood.html).
// Opens the build card's "..." menu on the iPhone PWA in each sheet state (peek / half / full), measures how much of the
// menu and of each item is inside the sheet (overflow:hidden), and makes REAL taps at each item's centre to see whether
// Export (download), Import (file chooser) or Reset (confirm dialog) fire. iPad portrait is the control (desktop layout).
//   node "audits/tools/phase3/dollywood/verify-progress-menu-clipped-phone-1.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
fs.mkdirSync(EV, { recursive: true });
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };
const shot = async (d, name) => { const f = path.join(EV, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return path.relative(process.cwd(), f).split(path.sep).join('/'); };

const measure = f => f.evaluate(() => {
  const b = document.getElementById('build'), br = b.getBoundingClientRect(), m = document.getElementById('bmenu');
  const mr = m.getBoundingClientRect();
  const vis = r => Math.max(0, Math.min(r.bottom, br.bottom) - Math.max(r.top, br.top));
  const items = ['b-export', 'b-import', 'b-reset'].map(id => { const r = document.getElementById(id).getBoundingClientRect();
    const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { id, top: Math.round(r.top), bottom: Math.round(r.bottom), visiblePx: Math.round(vis(r)), centreHits: h ? (h.id || h.tagName + '.' + (h.getAttribute('class') || '')) : null, centreIsItem: h === document.getElementById(id) }; });
  return { state: b.dataset.state, menuHidden: m.hidden, sheetTop: Math.round(br.top), sheetBottom: Math.round(br.bottom), buildOverflow: getComputedStyle(b).overflow, buildPosition: getComputedStyle(b).position,
    menuTop: Math.round(mr.top), menuBottom: Math.round(mr.bottom), menuH: Math.round(mr.height), menuCss: { top: getComputedStyle(m).top, bottom: getComputedStyle(m).bottom }, menuVisiblePx: Math.round(vis(mr)), items, vw: innerWidth, vh: innerHeight };
});

async function tapItems(d, f, tag) {
  // real pointer taps at each item's centre (page coordinates = frame box + frame-local centre)
  const res = {};
  for (const id of ['b-export', 'b-import', 'b-reset']) {
    const open = await f.evaluate(() => !document.getElementById('bmenu').hidden);
    if (!open) { await f.click('#b-menu', { force: true }).catch(() => {}); await sleep(250); }
    const fr = await (await f.frameElement()).boundingBox();
    const c = await f.evaluate(i => { const r = document.getElementById(i).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
    const ev = { dialog: null, download: false, filechooser: false };
    const onD = async dl => { ev.dialog = dl.message().slice(0, 80); await dl.dismiss().catch(() => {}); };
    const onDl = () => { ev.download = true; }; const onFc = () => { ev.filechooser = true; };
    d.page.on('dialog', onD); d.page.on('download', onDl); d.page.on('filechooser', onFc);
    await d.page.mouse.click(fr.x + c.x, fr.y + c.y); await sleep(700);
    { const ask = await f.evaluate(() => { const t = document.getElementById('ask-t'); return t && !document.getElementById('ask-bd').hidden ? t.textContent : null; }); if (ask) { ev.dialog = ask.slice(0, 80); await f.evaluate(() => document.getElementById('ask-no').click()); await sleep(300); } }
    d.page.off('dialog', onD); d.page.off('download', onDl); d.page.off('filechooser', onFc);
    const after = await f.evaluate(() => ({ state: document.getElementById('build').dataset.state, menuHidden: document.getElementById('bmenu').hidden }));
    res[id] = { tapAt: { x: Math.round(fr.x + c.x), y: Math.round(fr.y + c.y) }, fired: ev.dialog != null || ev.download || ev.filechooser, ...ev, after };
    // restore the sheet state for the next item
    await f.evaluate(s => { window.sheetSet && window.sheetSet(s); }, tag); await sleep(400);
  }
  return res;
}

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const f = await d.openApp('dollywood', { wait: '#b-count' });
  await f.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
  await sleep(500);
  log('phone.flavor', await f.evaluate(() => ({ flavor: document.documentElement.dataset.flavor, phoneMq: matchMedia('(max-width:699px)').matches, coarse: matchMedia('(pointer:coarse)').matches })));
  for (const st of ['peek', 'half', 'full']) {
    await f.evaluate(s => window.sheetSet(s), st); await sleep(600);
    await f.click('#b-menu'); await sleep(300);
    log(`phone.${st}.measure`, await measure(f));
    log(`phone.${st}.png`, await shot(d, `verify-progress-menu-clipped-phone-1-${st}.png`));
    log(`phone.${st}.taps`, await tapItems(d, f, st));
    await f.evaluate(() => { const m = document.getElementById('bmenu'); if (!m.hidden) document.getElementById('b-menu').click(); }); await sleep(200);
  }
  // residual: the only visible part of the menu is an 8 px sliver of Reset just inside the sheet top; tap it (peek)
  await f.evaluate(() => window.sheetSet('peek')); await sleep(600);
  await f.click('#b-menu'); await sleep(300);
  {
    const fr = await (await f.frameElement()).boundingBox();
    const c = await f.evaluate(() => { const r = document.getElementById('b-reset').getBoundingClientRect(), b = document.getElementById('build').getBoundingClientRect();
      const y = (Math.max(r.top, b.top) + r.bottom) / 2; const h = document.elementFromPoint(r.left + r.width / 2, y); return { x: r.left + r.width / 2, y, hit: h && (h.id || h.tagName) }; });
    let dlg = null; const onD = async dl => { dlg = dl.message().slice(0, 80); await dl.dismiss().catch(() => {}); };
    d.page.on('dialog', onD); await d.page.mouse.click(fr.x + c.x, fr.y + c.y); await sleep(700); d.page.off('dialog', onD);
    { const ask = await f.evaluate(() => { const t = document.getElementById('ask-t'); return t && !document.getElementById('ask-bd').hidden ? t.textContent : null; }); if (ask) { dlg = ask.slice(0, 80); await f.evaluate(() => document.getElementById('ask-no').click()); await sleep(300); } }
    log('phone.peek.resetSliverTap', { sliverY: Math.round(c.y), hitBeforeTap: c.hit, dialog: dlg });
  }
  // control: iPad portrait (820 wide, above the 699 px phone layout)
  const ip = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const g = await ip.openApp('dollywood', { wait: '#b-count' });
  await g.waitForFunction(() => /of \d+ done/.test(document.getElementById('b-count').textContent), null, { timeout: 20000 });
  await g.evaluate(() => document.getElementById('b-menu').scrollIntoView({ block: 'center' })); await sleep(400);
  await g.click('#b-menu'); await sleep(300);
  log('ipad.measure', await measure(g));
  log('ipad.png', await shot(ip, 'verify-progress-menu-clipped-phone-1-ipad.png'));
} finally {
  fs.writeFileSync(path.join(EV, 'verify-progress-menu-clipped-phone-1.json'), JSON.stringify(out, null, 1));
  await L.close();
}
