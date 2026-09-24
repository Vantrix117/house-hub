// F260 — the encrypted HEAR journal end to end on the local rig: first open of the Journal tab, set a passcode from a
// HEAR panel, an Apply line → This week's reflections, reading mode (is the reflections card kept? two "Done"s?),
// lock → HEAR, wrong passcode, the unlock copy on an iPhone, disabled settings buttons, the theme hint and week-note
// footer styles, search's clear buttons, auto-lock after idle, backup → restore on a second device, Erase → the other
// device. The passcode is a throwaway value on the local demo database.
//   node "audits/tools/phase3/f260/journal.mjs"
import { local, sleep, DEMO, save, shot, rows, texts, ready } from './_lib.mjs';

const PASS = '2468';
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const cs = (f, sel, props) => f.evaluate(([s, p]) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); const b = e.getBoundingClientRect(); return Object.assign({ w: Math.round(b.width), h: Math.round(b.height) }, Object.fromEntries(p.map(k => [k, c[k]]))); }, [sel, props]);
async function passDialog(f, a, b) {
  await f.waitForSelector('#pass.on', { timeout: 5000 }); await sleep(120);
  await f.fill('#pass1', a); if (b != null) await f.fill('#pass2', b);
  await f.locator('#passOk').tap();
}
try {
  const ph = await L.newDevice({ name: 'Eli phone', profiles: ['eli'] });
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, as: ph });
  // clipboard capture (headless has no clipboard): keep what the app copies
  await d.ctx.addInitScript(() => { try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copied = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {} });
  const f = await d.openApp('f260'); await ready(f);
  // 1. Journal tab with no passcode yet
  await f.locator('#tabJournal').tap(); await sleep(500);
  out.journalTabFirst = await f.evaluate(() => ({ dialog: document.getElementById('pass').classList.contains('on'), title: document.getElementById('passTitle').textContent, text: document.getElementById('passText').textContent }));
  await f.locator('#passCancel').tap(); await sleep(200);
  out.journalTabAfterCancel = await f.evaluate(() => document.getElementById('jList').innerText.replace(/\s+/g, ' ').trim());
  await f.locator('#tabPlan').tap(); await sleep(300);
  // 2. set a passcode from today's HEAR panel, write Apply + Respond
  const id = await f.evaluate(() => document.getElementById('todayDone').dataset.target);   // 38-2
  const day0 = '38-0';
  await f.evaluate(i => document.querySelector(`[data-jr="${i}"]`).scrollIntoView({ block: 'center' }), day0);
  await f.locator(`[data-jr="${day0}"]`).tap();
  await passDialog(f, PASS, PASS);
  await f.waitForSelector('#pass.on', { state: 'detached', timeout: 8000 }).catch(() => {}); await sleep(300);
  await f.locator(`#jf-${day0}-a`).tap(); await f.locator(`#jf-${day0}-a`).fill('Share a meal with a neighbour this week.');
  await f.locator(`#jf-${day0}-r`).tap(); await f.locator(`#jf-${day0}-r`).fill('Lord, make me generous.');
  await f.locator(`#jf-${day0}-h`).tap(); await sleep(800);
  out.reflectUnlocked = await f.evaluate(() => ({ items: document.querySelectorAll('#rfBody .rf-item').length, reflectBtn: document.getElementById('reflectBtn').hidden ? null : document.getElementById('reflectBtn').textContent }));
  // week-note footer vs HEAR footer styles
  await f.evaluate(() => document.querySelector('[data-wntoggle="38"]').scrollIntoView({ block: 'center' }));
  await f.locator('[data-wntoggle="38"]').tap(); await sleep(300);
  await f.locator('#wn-38').fill('A good week.'); await f.locator(`#jf-${day0}-h`).tap(); await sleep(500);
  out.footers = { hearFooter: await cs(f, `#jr-${day0} .jft`, ['fontSize', 'display', 'color']), hearCopy: await cs(f, `#jr-${day0} .jft button`, ['fontSize', 'minHeight', 'color', 'backgroundColor', 'borderTopWidth']),
    noteFooter: await cs(f, '[data-wnpanel="38"] .jft', ['fontSize', 'display', 'color']), noteCopy: await cs(f, '[data-wnpanel="38"] .jft button', ['fontSize', 'minHeight', 'color', 'backgroundColor', 'borderTopWidth']) };
  await f.evaluate(() => document.querySelector('[data-wnpanel="38"]').scrollIntoView({ block: 'center' }));
  await shot(d.page, 'journal-week-note-footer-iphone.png');
  // 3. reading mode with an unlocked journal and a reflection this week
  await f.evaluate(() => document.getElementById('readBtn').click()); await sleep(800);
  out.readingMode = await f.evaluate(() => {
    const vis = e => { if (!e) return 'absent'; for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const c = getComputedStyle(x); if (c.display === 'none') return 'hidden by ' + (x.id ? '#' + x.id : '.' + [...x.classList].join('.')); } return 'shown'; };
    const r = e => { const b = e.getBoundingClientRect(); return { y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), shown: b.width > 0 }; };
    return { reflect: vis(document.getElementById('reflect')), sideDisplay: getComputedStyle(document.querySelector('.side')).display,
      todayDone: Object.assign({ text: document.getElementById('todayDone').textContent.trim() }, r(document.getElementById('todayDone'))),
      readExit: Object.assign({ text: document.getElementById('readExit').textContent.trim() }, r(document.getElementById('readExit'))) };
  });
  await f.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
  await shot(d.page, 'journal-reading-mode-two-done-iphone.png');
  await f.evaluate(() => document.getElementById('readExit').click()); await sleep(500);
  // 4. settings: unlocked vs locked button styles, the theme hint
  await f.evaluate(() => document.getElementById('settingsBtn').scrollIntoView({ block: 'center' }));
  await f.locator('#settingsBtn').tap(); await sleep(300);
  const segStyle = sel => cs(f, sel, ['opacity', 'color', 'borderTopColor', 'cursor', 'pointerEvents']);
  out.settings = { unlocked: { lockBtn: await segStyle('#lockBtn'), eraseBtn: await segStyle('#eraseBtn') }, themeHint: await cs(f, '.sheet .help', ['fontSize', 'color', 'marginTop']), hint: await cs(f, '.sheet .hint', ['fontSize', 'color']) };
  await f.locator('#lockBtn').tap(); await sleep(400);
  out.settings.locked = { lockBtn: Object.assign(await segStyle('#lockBtn'), { disabled: await f.evaluate(() => document.getElementById('lockBtn').disabled) }), changePass: Object.assign(await segStyle('#changePassBtn'), { disabled: await f.evaluate(() => document.getElementById('changePassBtn').disabled) }), bioOn: Object.assign(await segStyle('#bioOn'), { disabled: await f.evaluate(() => document.getElementById('bioOn').disabled) }), vaultHint: (await texts(f, ['#vaultHint']))['#vaultHint'] };
  await f.evaluate(() => document.getElementById('lockBtn').scrollIntoView({ block: 'center' }));
  await shot(d.page, 'journal-settings-locked-iphone.png');
  await f.locator('#settingsBtn').tap(); await sleep(200);
  // 5. locked: tap HEAR → dialog at once? wrong passcode
  await f.evaluate(i => document.querySelector(`[data-jr="${i}"]`).scrollIntoView({ block: 'center' }), day0);
  await f.locator(`[data-jr="${day0}"]`).tap(); await sleep(300);
  out.lockedHear = await f.evaluate(i => ({ dialog: document.getElementById('pass').classList.contains('on'), title: document.getElementById('passTitle').textContent, text: document.getElementById('passText').textContent, panelOn: document.getElementById('jr-' + i).classList.contains('on') }), day0);
  await f.fill('#pass1', '1357'); await f.locator('#passOk').tap(); await sleep(2500);
  out.wrongPass = (await texts(f, ['#passErr']))['#passErr'];
  await shot(d.page, 'journal-wrong-passcode-iphone.png');
  await f.fill('#pass1', PASS); await f.locator('#passOk').tap(); await sleep(2500);
  out.unlockedAgain = await f.evaluate(i => ({ dialog: document.getElementById('pass').classList.contains('on'), panelOn: document.getElementById('jr-' + i).classList.contains('on'), a: (document.getElementById('jf-' + i + '-a') || {}).value }), day0);
  // 6. Journal tab: search shows the app's × and WebKit's own cancel
  await f.locator('#tabJournal').tap(); await sleep(400);
  await f.locator('#jSearch').tap(); await f.locator('#jSearch').fill('neighbour'); await sleep(400);
  out.search = await f.evaluate(() => { const i = document.getElementById('jSearch'); const pc = getComputedStyle(i, '::-webkit-search-cancel-button'); return { appClear: !document.getElementById('jClear').hidden, webkitCancelDisplay: pc && pc.display, webkitCancelAppearance: pc && (pc.webkitAppearance || pc.appearance), type: i.type, stat: document.getElementById('jStat').textContent }; });
  await shot(d.page, 'journal-search-two-clears-iphone.png');
  // 7. backup text (captured from the app's copy), then auto-lock after idle
  await f.locator('#tabPlan').tap(); await sleep(300);
  await f.evaluate(() => { document.getElementById('settingsBtn').click(); }); await sleep(200);
  await f.evaluate(() => document.getElementById('backupBtn').click()); await sleep(500);
  const backup = await f.evaluate(() => window.__copied || null);
  out.backup = backup ? { prefix: backup.slice(0, 12), chars: backup.length, decoded: (() => { try { const b = JSON.parse(Buffer.from(backup.slice(12), 'base64').toString('utf8')); return { keys: Object.keys(b), progressKeys: Object.keys(b.progress), vaultKeys: b.vault && Object.keys(b.vault), hasBio: !!(b.vault && b.vault.bio) }; } catch (e) { return String(e); } })() } : null;
  await f.evaluate(() => { document.querySelector('#autoSeg [data-min="5"]').click(); document.getElementById('settingsBtn').click(); }); await sleep(300);
  const st0 = await f.evaluate(() => document.getElementById('vaultHint').textContent);
  await d.ctx.clock.fastForward('05:20'); await sleep(500); await d.ctx.clock.runFor(16000); await sleep(800);
  out.autolock = { before: st0, after5m20s: await f.evaluate(() => document.getElementById('vaultHint').textContent) };
  // 8. restore that backup on a second device (David's plan is unaffected; this is Eli on the iPad)
  const pad = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO + 60000 });
  await pad.ctx.addInitScript(() => { try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copied = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {} });
  const g = await pad.openApp('f260'); await ready(g);
  if (backup) {
    await g.evaluate(() => document.getElementById('settingsBtn').click()); await sleep(200);
    await g.evaluate(() => document.getElementById('restoreBtn').click()); await sleep(300);
    out.restoreCopy = await g.evaluate(() => document.querySelector('#restore p').textContent);
    await g.fill('#restoreText', backup); await g.locator('#restoreOk').tap(); await sleep(400);
    out.restoreConfirm = await g.evaluate(() => document.getElementById('confirmText').textContent);
    await g.locator('#doConfirm').tap(); await sleep(1500);
    out.restoreResult = await texts(g, ['#todayTitle', '#vaultHint']);
  }
  // 9. Erase journal on the iPad → the phone
  await g.evaluate(() => { const s = document.getElementById('sheet'); if (!s.classList.contains('on')) document.getElementById('settingsBtn').click(); }); await sleep(200);
  await g.evaluate(() => document.getElementById('eraseBtn').click()); await sleep(300);
  out.eraseDialog = await g.evaluate(() => document.getElementById('confirm').innerText.replace(/\s+/g, ' ').trim());
  await g.locator('#doConfirm').tap(); await sleep(2000);
  const vaultRow = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.journal.vault');
  out.eraseServer = { vaultValue: vaultRow.body.item ? vaultRow.body.item.value : '(no row)' };
  // the phone (journal locked, app open): wait for its next pulls to bring the tombstone
  const f3 = d.frame('f260'); const t0 = Date.now(); let hint = '';
  while (Date.now() - t0 < 70000) { hint = await f3.evaluate(() => document.getElementById('vaultHint').textContent); if (/No passcode yet/.test(hint)) break; await d.ctx.clock.runFor(5000); await sleep(1000); }
  out.phoneAfterErase = { hint, afterRealSeconds: Math.round((Date.now() - t0) / 1000) };
  await d.close(); await pad.close();
} finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(22), JSON.stringify(v).slice(0, 700));
console.log('evidence →', save('journal.json', out));
