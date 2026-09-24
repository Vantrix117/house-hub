// SYNC — skeptic #3, side lead found while verifying "413-drops-whole-channel" (NOT that finding).
//   node "audits/tools/phase2/SYNC/verify-413-drops-whole-channel-3-ivmix.mjs"      (~40 s, Chromium = the installed Chrome)
// persistJournal() (apps/f260.html:1015-1024) takes the LIVE vault object from hub.get (apps/hub.js:220-222 returns the stored
// object itself), sets blob.iv = b64(iv) and only then blob.ct = b64(ct). When b64(ct) throws (String.fromCharCode.apply past
// the engine's argument limit, :993) the catch swallows it, but the stored object already carries the NEW iv next to the OLD ct.
// Question: does that half-written vault reach localStorage / the server, and can the journal still be unlocked?
// Steps: Eli's PC sets a passcode and saves a small HEAR entry online (synced). Offline: a slightly longer entry (saves, queued),
// then two long entries (200,000 chars: over Chrome's limit). Online again. Then the Kitchen iPad and the PC (after reopening
// F260) each try to unlock with the right passcode.
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, shot, writeEvidence } from './_util.mjs';

const PASS = '24680';
const r = {};
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  const pc = await L.newDevice({ name: 'Eli PC', profiles: ['eli'] });
  const d = await L.device({ device: 'desktop', profile: 'eli', fixedTime: false, as: pc });
  let f = await d.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(600);
  const id = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
  r.entry = id;
  const openEntry = async fr => { await fr.evaluate(id => { const b = document.querySelector('[data-jr="' + id + '"]'); b.scrollIntoView(); b.click(); }, id); await fr.waitForSelector('#pass.on', { timeout: 5000 }); };
  await openEntry(f);
  await f.fill('#pass1', PASS); await f.fill('#pass2', PASS); await f.click('#passOk');
  await waitFor(() => f.evaluate(id => document.querySelectorAll('#jr-' + id + ' textarea[data-jf]').length === 4, id), { timeout: 15000 });
  const mem = () => f.evaluate(() => { const v = hub.get('f260.journal.vault'); return { iv: v.iv, ctLen: v.ct.length, ctHead: v.ct.slice(0, 16) }; });
  const ls = () => f.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('hub.cache.f260.person.eli') || '{}'), q = JSON.parse(localStorage.getItem('hub.queue.f260.person.eli') || '{}');
    const cv = c.items && c.items['f260.journal.vault'] && c.items['f260.journal.vault'].v, qv = q['f260.journal.vault'] && q['f260.journal.vault'].value;
    return { cache: cv && { iv: cv.iv, ctHead: cv.ct.slice(0, 16) }, queue: qv && { iv: qv.iv, ctHead: qv.ct.slice(0, 16) } };
  });
  const type = async (ch, n) => {
    await f.evaluate(({ id, ch, n }) => { const ts = [...document.querySelectorAll('#jr-' + id + ' textarea[data-jf]')]; ts.forEach((t, i) => { t.value = i === 0 ? ch.repeat(n) : ''; }); ts[0].dispatchEvent(new Event('input', { bubbles: true })); }, { id, ch, n });
    await sleep(1500);
  };
  const srv = async () => { const s = await serverRow(L, 'eli', 'f260', 'f260.journal.vault'); return s && s.value ? { iv: s.value.iv, ctHead: s.value.ct.slice(0, 16), ctLen: s.value.ct.length } : null; };

  await type('a', 1000); await sleep(1500);
  r.step1_online_small = { mem: await mem(), server: await srv() };
  await d.setOffline(true);
  await type('b', 1500);
  r.step2_offline_small = { mem: await mem(), ls: await ls() };
  await type('c', 200000);
  r.step3_offline_big1 = { mem: await mem(), ls: await ls(), label: await f.evaluate(id => document.querySelector('#jr-' + id + ' .jsaved').textContent, id) };
  await type('d', 200001);
  r.step4_offline_big2 = { mem: await mem(), ls: await ls() };
  const replies = [];
  d.page.on('response', async res => { if (/\/api\/data\/f260\/batch/.test(res.url())) replies.push(res.status()); });
  await d.setOffline(false);
  await waitFor(() => replies.length > 0, { timeout: 15000 }); await sleep(2500);
  r.step5_online = { replies, server: await srv(), mem: await mem() };
  r.serverMatchesGoodPair = !!(r.step5_online.server && r.step5_online.server.iv === r.step2_offline_small.mem.iv && r.step5_online.server.ctHead === r.step2_offline_small.mem.ctHead);
  log(`[1 online small]  mem iv ${r.step1_online_small.mem.iv} ct ${r.step1_online_small.mem.ctHead}…; server iv ${r.step1_online_small.server && r.step1_online_small.server.iv}`);
  log(`[2 offline small] mem iv ${r.step2_offline_small.mem.iv} ct ${r.step2_offline_small.mem.ctHead}… (len ${r.step2_offline_small.mem.ctLen}); localStorage ${JSON.stringify(r.step2_offline_small.ls)}`);
  log(`[3 offline 200k]  mem iv ${r.step3_offline_big1.mem.iv} ct ${r.step3_offline_big1.mem.ctHead}… (len ${r.step3_offline_big1.mem.ctLen}); localStorage ${JSON.stringify(r.step3_offline_big1.ls)}; panel ${JSON.stringify(r.step3_offline_big1.label)}`);
  log(`[4 offline 200k]  mem iv ${r.step4_offline_big2.mem.iv} ct ${r.step4_offline_big2.mem.ctHead}…; localStorage ${JSON.stringify(r.step4_offline_big2.ls)}`);
  log(`[5 online]        batch replies ${JSON.stringify(replies)}; server ${JSON.stringify(r.step5_online.server)}; server = the step-2 (iv, ct) pair: ${r.serverMatchesGoodPair}`);

  // Another device (the Kitchen iPad, signed in as Eli) unlocks with the right passcode
  const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const fi = await ipad.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => fi.evaluate(() => hub.sync.lastPull > 0 && !!hub.get('f260.journal.vault')), { timeout: 15000 }); await sleep(600);
  await openEntry(fi);
  await fi.fill('#pass1', PASS); await fi.click('#passOk'); await sleep(5000);
  r.ipad = await fi.evaluate(id => ({ err: document.getElementById('passErr').textContent, dialogOpen: document.getElementById('pass').classList.contains('on'), fields: [...document.querySelectorAll('#jr-' + id + ' textarea[data-jf]')].map(t => t.value.length) }), id);
  r.ipadShot = await shot(ipad.page, 'v413-3-ivmix-ipad-unlock.png');
  log(`[iPad] unlock with the right passcode → passErr ${JSON.stringify(r.ipad.err)}, dialog still open ${r.ipad.dialogOpen}, fields ${JSON.stringify(r.ipad.fields)}`);

  // The PC reopens F260 and unlocks
  await d.goto('#home'); await sleep(800);
  f = await d.openApp('f260', { wait: '#todayDone' }); await sleep(1500);
  await openEntry(f);
  await f.fill('#pass1', PASS); await f.click('#passOk'); await sleep(5000);
  r.pcReopen = await f.evaluate(id => ({ err: document.getElementById('passErr').textContent, dialogOpen: document.getElementById('pass').classList.contains('on'), fields: [...document.querySelectorAll('#jr-' + id + ' textarea[data-jf]')].map(t => t.value.length) }), id);
  r.pcShot = await shot(d.page, 'v413-3-ivmix-pc-unlock.png');
  log(`[PC reopened] unlock with the right passcode → passErr ${JSON.stringify(r.pcReopen.err)}, dialog still open ${r.pcReopen.dialogOpen}, fields ${JSON.stringify(r.pcReopen.fields)}`);
} finally { await L.close(); }
log('evidence', writeEvidence('verify-413-drops-whole-channel-3-ivmix.json', r));
