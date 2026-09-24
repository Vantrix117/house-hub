// SYNC — skeptic #1 (fresh, independent) for candidate "journal-vault-iv-mismatch".
//   node "audits/tools/phase2/SYNC/verify2-journal-vault-iv-mismatch-1.mjs" --engine chromium|webkit --mode offline|online [--latency ms] [--pause ms]
// Claim under test: persistJournal() (apps/f260.html:1015-1024) mutates the LIVE stored vault object (hub.get returns it,
// apps/hub.js:220-223): blob.iv = b64(newIv) is assigned, then blob.ct = b64(ct) throws (String.fromCharCode.apply over the
// engine's argument limit, :993) and the .catch swallows it, leaving NEW iv + OLD ct.
// Unlike the earlier scripts this one grows the journal GRADUALLY across the engine's measured limit (the way typing would),
// probes that limit in the page first, and proves the cause in Node: with the right passcode the data key unwraps fine but
// the ciphertext only decrypts with the iv of the last successful save, never with the iv that ended up stored.
import crypto from 'node:crypto';
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, shot, writeEvidence } from './_util.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ENGINE = arg('engine', 'chromium'), MODE = arg('mode', 'offline');
const LAT = +arg('latency', 0), PAUSE = +arg('pause', 700), STEPS = +arg('steps', 10), STEP = +arg('step', 5000);
const TAG = `vj2-${ENGINE}-${MODE}` + (MODE === 'online' ? `-lat${LAT}-p${PAUSE}` : '');
const PASS = '13579';
const WRITER = ENGINE === 'webkit' ? 'iphone-pwa' : 'desktop';

// ── Node-side check of a vault: unwrap the data key with the passcode, then try the ciphertext with a given iv ──
const { subtle } = crypto.webcrypto;
const unb64 = s => Uint8Array.from(Buffer.from(s, 'base64'));
async function tryVault(vault, iv) {
  const km = await subtle.importKey('raw', new TextEncoder().encode(PASS), 'PBKDF2', false, ['deriveKey']);
  const kek = await subtle.deriveKey({ name: 'PBKDF2', salt: unb64(vault.pass.salt), iterations: vault.pass.iter || 200000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']);
  let dek;
  try { dek = await subtle.unwrapKey('raw', unb64(vault.pass.wk), kek, { name: 'AES-GCM', iv: unb64(vault.pass.iv) }, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']); }
  catch (e) { return { unwrap: false, err: e.name }; }
  try { const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, dek, unb64(vault.ct)); return { unwrap: true, decrypt: true, bytes: pt.byteLength }; }
  catch (e) { return { unwrap: true, decrypt: false, err: e.name }; }
}

const r = { engine: ENGINE, mode: MODE, latency: LAT, pause: PAUSE, writer: WRITER };
const L = await local({ variant: 'typical', clock: 'real', engine: ENGINE });
try {
  const dev = await L.newDevice({ name: 'Writer ' + WRITER, profiles: ['eli'] });
  const d = await L.device({ device: WRITER, profile: 'eli', fixedTime: false, as: dev });
  let f = await d.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(600);

  // 1. The engine's argument limit for String.fromCharCode.apply (what b64() relies on)
  r.applyLimit = await f.evaluate(() => { let lo = 1000, hi = 4e6; while (hi - lo > 128) { const m = (lo + hi) >> 1; try { String.fromCharCode.apply(null, new Uint8Array(m)); lo = m; } catch (e) { hi = m; } } return lo; });
  log(`[${ENGINE}] String.fromCharCode.apply works up to ~${r.applyLimit} bytes`);

  const id = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
  r.entry = id;
  const openEntry = async fr => { await fr.evaluate(id => { const b = document.querySelector('[data-jr="' + id + '"]'); b.scrollIntoView(); b.click(); }, id); await fr.waitForSelector('#pass.on', { timeout: 5000 }); };
  await openEntry(f);
  await f.fill('#pass1', PASS); await f.fill('#pass2', PASS); await f.click('#passOk');
  await waitFor(() => f.evaluate(id => document.querySelectorAll('#jr-' + id + ' textarea[data-jf]').length === 4, id), { timeout: 15000 });

  const setField = (idx, ch, n) => f.evaluate(({ id, idx, ch, n }) => { const t = [...document.querySelectorAll('#jr-' + id + ' textarea[data-jf]')][idx]; t.value = ch.repeat(n); t.dispatchEvent(new Event('input', { bubbles: true })); }, { id, idx, ch, n });
  const snap = () => f.evaluate(() => {
    const pick = x => x && { iv: x.iv, ctLen: x.ct.length, ctHead: x.ct.slice(0, 12) };
    const c = JSON.parse(localStorage.getItem('hub.cache.f260.person.eli') || '{}'), q = JSON.parse(localStorage.getItem('hub.queue.f260.person.eli') || '{}');
    return {
      mem: pick(hub.get('f260.journal.vault')),
      cache: pick(c.items && c.items['f260.journal.vault'] && c.items['f260.journal.vault'].v),
      queue: pick(q['f260.journal.vault'] && q['f260.journal.vault'].value),
      sync: hub.sync.state,
    };
  });
  const full = v => v && { v: v.v, iv: v.iv, ct: v.ct, pass: v.pass };

  // 2. Online: a base entry sized so the journal crosses the limit about half-way through the typing steps
  const base = Math.max(1000, r.applyLimit - 16 - Math.floor(STEPS / 2) * STEP - 300);
  r.base = base;
  await setField(0, 'a', base); await sleep(3000);
  r.baseSnap = await snap();
  const bs = await serverRow(L, 'eli', 'f260', 'f260.journal.vault');
  r.baseServer = bs && bs.value && { iv: bs.value.iv, ctLen: bs.value.ct.length };
  log(`[base ${base} chars, online] mem ${JSON.stringify(r.baseSnap.mem)} server ${JSON.stringify(r.baseServer)}`);

  // 3. Offline, or online with a slow API; keep typing: field E grows by STEP chars per pause
  if (MODE === 'offline') await d.setOffline(true);
  else if (LAT) await d.ctx.route(u => u.href.startsWith(L.api), async rt => { const resp = await rt.fetch(); await sleep(LAT); await rt.fulfill({ response: resp }); });
  const replies = [];
  d.page.on('response', res => { if (/\/api\/data\/f260\/batch/.test(res.url())) replies.push(res.status()); });
  r.steps = [];
  let prevCt = r.baseSnap.mem.ctLen, lastGood = { iv: r.baseSnap.mem.iv, ctLen: r.baseSnap.mem.ctLen, step: 0 };
  for (let i = 1; i <= STEPS; i++) {
    await setField(1, 'e', i * STEP);
    await sleep(PAUSE);
    const s = await snap();
    const saved = s.mem.ctLen !== prevCt;
    if (saved) { lastGood = { iv: s.mem.iv, ctLen: s.mem.ctLen, step: i }; prevCt = s.mem.ctLen; }
    const plain = base + i * STEP;
    r.steps.push({ i, journalChars: plain, saved, ...s });
    log(`[step ${i}] journal ~${plain} chars → ${saved ? 'SAVED' : 'not saved'}; mem iv ${s.mem.iv} ct ${s.mem.ctLen}; cache iv ${s.cache && s.cache.iv}; queue iv ${s.queue && s.queue.iv}; sync ${s.sync}`);
  }
  r.lastGood = lastGood;

  // 4. Back online / let the slow API settle, then force a flush and a pull
  if (MODE === 'offline') await d.setOffline(false);
  await sleep(5000);
  await f.evaluate(() => hub.flush()).catch(() => {}); await sleep(1500);
  await f.evaluate(() => hub.pull()).catch(() => {}); await sleep(1000);
  r.replies = replies;
  r.finalSnap = await snap();
  const sv = await serverRow(L, 'eli', 'f260', 'f260.journal.vault');
  r.server = sv && sv.value && { iv: sv.value.iv, ctLen: sv.value.ct.length, ctHead: sv.value.ct.slice(0, 12), updated_at: sv.updated_at };
  const lsVault = await f.evaluate(() => { const c = JSON.parse(localStorage.getItem('hub.cache.f260.person.eli') || '{}'); const v = c.items['f260.journal.vault'].v; return { v: v.v, iv: v.iv, ct: v.ct, pass: v.pass }; });
  log(`[settled] batch replies ${JSON.stringify(replies)}; writer cache ${JSON.stringify(r.finalSnap.cache)}; server ${JSON.stringify(r.server)}; last good save = step ${lastGood.step} iv ${lastGood.iv}`);

  // 5. Node: is it the iv? (right passcode; stored iv vs the iv of the last successful save)
  r.crypto = {
    server_storedIv: await tryVault(full(sv.value), sv.value.iv),
    server_lastGoodIv: await tryVault(full(sv.value), lastGood.iv),
    writerCache_storedIv: await tryVault(lsVault, lsVault.iv),
    writerCache_lastGoodIv: await tryVault(lsVault, lastGood.iv),
  };
  log('[node crypto, right passcode]', JSON.stringify(r.crypto));

  // 6. A second device (the Kitchen iPad, as Eli) unlocks with the right passcode
  const d2 = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const f2 = await d2.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f2.evaluate(() => hub.sync.lastPull > 0 && !!hub.get('f260.journal.vault')), { timeout: 15000 }); await sleep(600);
  const tryUnlock = async (fr, page, name) => {
    await openEntry(fr);
    await fr.fill('#pass1', PASS); await fr.click('#passOk');
    await waitFor(() => fr.evaluate(() => /Wrong|wrong|went wrong/.test(document.getElementById('passErr').textContent) || !document.getElementById('pass').classList.contains('on')), { timeout: 20000 });
    await sleep(500);
    const res = await fr.evaluate(id => ({ err: document.getElementById('passErr').textContent, dialogOpen: document.getElementById('pass').classList.contains('on'), fields: [...document.querySelectorAll('#jr-' + id + ' textarea[data-jf]')].map(t => t.value.length) }), id);
    res.shot = await shot(page, `${TAG}-${name}.png`);
    return res;
  };
  r.secondDevice = await tryUnlock(f2, d2.page, 'ipad-unlock');
  log(`[iPad, right passcode] ${JSON.stringify(r.secondDevice)}`);

  // 7. The writer reopens F260 (e.g. after autolock / relaunch) and unlocks with the right passcode
  await d.goto('#home'); await sleep(800);
  f = await d.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(1000);
  r.writerReopen = await tryUnlock(f, d.page, 'writer-unlock');
  log(`[writer reopened, right passcode] ${JSON.stringify(r.writerReopen)}`);
  r.pageErrors = d.logs.filter(l => /pageerror|RangeError/.test(l));
} finally { await L.close(); }
log('evidence', writeEvidence(`${TAG}.json`, r));
