// Skeptic #2 (journal-silently-stops-saving): independent reproduction.
//   node "audits/tools/phase2/SYNC/verify2-journal-silently-stops-saving-2.mjs"
// Claim: F260's b64() (apps/f260.html:993, String.fromCharCode.apply(null, bytes)) throws past the engine's argument limit,
// persistJournal() swallows it (.catch(() => {}), apps/f260.html:1024) and saveJournal() still paints "Saved <date>"
// (apps/f260.html:1829-1832). Differences from skeptic #1's script: instead of one giant entry typed in one go, the journal is
// a realistic many-day journal (HEAR entries across many plan days) crafted in Node with the app's own v2 vault layout and
// written to the server as eli (as if written on another device); the app then pulls it, the user unlocks it with the
// passcode and types ONE ordinary day's entry through the real textareas. Because this script holds the data key it can
// decrypt what the device and the server really hold afterwards.
// Trials: chromium desktop with a journal just BELOW the measured limit (control), chromium desktop ABOVE it (three typing
//         rhythms), webkit iPad with the same above-Chromium-limit journal (control for the engine), webkit iPad ABOVE WebKit's
//         limit (two rhythms). It also checks the device's own copy of the vault: persistJournal() mutates the object hub.get()
//         returned (blob.iv is set before b64(ct) throws, apps/f260.html:1020-1021; hub.get returns the cached object by
//         reference, apps/hub.js:220-222), so the next hub.set on the channel (bumpJournalStats → f260.jstats) can write an
//         iv/ct mismatch to localStorage — then the right passcode reads "Wrong passcode." and a pull does not repair it.
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { local, sleep } from '../../lib/local.mjs';
import { EVID, ROOT, log, waitFor, shot } from './_util.mjs';

const subtle = webcrypto.subtle;
const te = new TextEncoder(), td = new TextDecoder();
const B = a => Buffer.from(a instanceof ArrayBuffer ? new Uint8Array(a) : a).toString('base64');
const U = s => new Uint8Array(Buffer.from(s, 'base64'));
const PASS = '13579';
const AES = { name: 'AES-GCM', length: 256 };

async function makeVault(journal) {                     // same layout as apps/f260.html:988-1033 (v2)
  const salt = webcrypto.getRandomValues(new Uint8Array(16)), ivW = webcrypto.getRandomValues(new Uint8Array(12)), iv = webcrypto.getRandomValues(new Uint8Array(12));
  const km = await subtle.importKey('raw', te.encode(PASS), 'PBKDF2', false, ['deriveKey']);
  const kek = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, km, AES, false, ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']);
  const dek = await subtle.generateKey(AES, true, ['encrypt', 'decrypt']);
  const wk = await subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv: ivW });
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, dek, te.encode(JSON.stringify(journal)));
  return { dek, blob: { v: 2, iv: B(iv), ct: B(ct), pass: { salt: B(salt), iter: 200000, iv: B(ivW), wk: B(wk) } } };
}
async function openVault(dek, blob) {                   // null if the blob no longer decrypts (iv and ct from different writes)
  if (!blob || !blob.ct) return null;
  try { return JSON.parse(td.decode(await subtle.decrypt({ name: 'AES-GCM', iv: U(blob.iv) }, dek, U(blob.ct)))); } catch (e) { return null; }
}

const BANK = ['The Lord is my shepherd and I shall not want.', 'He restores my soul and leads me in right paths for his name sake.',
  'Abraham believed God and it was counted to him as righteousness.', 'I noticed how patient God was with Israel in the wilderness.',
  'Today I want to trust him with the kids and with work instead of worrying.', 'Pray for Mom and Dad, and for Mae as she starts the new job.',
  'The people who first heard this were exiles far from home.', 'I will call Grandma this week and actually listen.',
  'Faith is not the absence of fear but obeying anyway.', 'Thank you for the rain, the garden, and a quiet morning.'];
const prose = (n, seed) => { let s = ''; let i = seed; while (s.length < n) s += BANK[i++ % BANK.length] + ' '; return s.slice(0, n); };

/** A many-day HEAR journal whose JSON is exactly `bytes` long (ASCII, so chars = bytes), skipping `skipId`. */
function buildJournal(bytes, perField, skipId) {
  const j = {}; const ids = [];
  for (let w = 1; w <= 52; w++) for (let d = 0; d < 5; d++) { const id = w + '-' + d; if (id !== skipId) ids.push(id); }
  let k = 0;
  for (const id of ids) {
    const e = { h: prose(perField, k), e: prose(perField, k + 3), a: prose(perField, k + 5), r: prose(perField, k + 7), t: Date.now() - (ids.length - k) * 86400000 };
    j[id] = e; k++;
    if (JSON.stringify(j).length >= bytes) break;
  }
  const last = j[ids[k - 1]];
  let size = JSON.stringify(j).length;
  if (size > bytes) { last.r = last.r.slice(0, Math.max(1, last.r.length - (size - bytes))); size = JSON.stringify(j).length; }
  while (size < bytes) { last.r += '.'; size++; }
  return { journal: j, entries: k, size: JSON.stringify(j).length };
}

async function trial({ engine, device, label, bytesFor, typing = 'fill' }) {
  const r = { engine, device, label, typing };
  const L = await local({ variant: 'typical', clock: 'real', engine });
  try {
    const d = await L.device({ device, profile: 'eli', fixedTime: false });
    let f = await d.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(500);
    // 1. the engine's limit for the exact expression at apps/f260.html:993, measured inside the F260 frame
    r.limit = await f.evaluate(() => {
      const b64 = a => btoa(String.fromCharCode.apply(null, new Uint8Array(a)));
      const ok = n => { try { b64(new Uint8Array(n).buffer); return true; } catch { return false; } };
      let lo = 1000, hi = 3000000; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ok(m)) lo = m; else hi = m; } return lo;
    });
    r.errorAtLimitPlus1 = await f.evaluate(n => { try { btoa(String.fromCharCode.apply(null, new Uint8Array(n))); return 'ok'; } catch (e) { return e.name + ': ' + e.message; } }, r.limit + 1);
    const id = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
    r.dayId = id;
    // 2. a realistic journal (many days) crafted with the app's vault layout, written to the server as if from another device
    const { bytes, perField } = bytesFor(r.limit);
    const J = buildJournal(bytes, perField, id);
    r.seed = { journalJsonBytes: J.size, entries: J.entries, perFieldChars: perField, ciphertextBytes: J.size + 16, overLimitBy: J.size + 16 - r.limit };
    const V = await makeVault(J.journal);
    r.seed.vaultChars = JSON.stringify(V.blob).length;
    const put = await L.apiAs('eli', '/api/data/f260/f260.journal.vault?scope=person', { method: 'PUT', body: { value: V.blob, updated_at: Date.now() } });
    r.seed.putStatus = put.status;
    // 3. reopen F260 so it pulls the vault, open today's journal, unlock with the passcode
    await d.goto('#home'); await sleep(500);
    f = await d.openApp('f260', { wait: '#todayDone' });
    r.pulled = !!(await waitFor(() => f.evaluate(() => !!(hub.get('f260.journal.vault') || {}).ct), { timeout: 15000 }));
    const unlock = async () => {
      await f.evaluate(id => { const b = document.querySelector('[data-jr="' + id + '"]'); b.scrollIntoView(); b.click(); }, id);
      await f.waitForSelector('#pass.on', { timeout: 8000 });
      await f.fill('#pass1', PASS); await f.click('#passOk');
      const ok = !!(await waitFor(() => f.evaluate(id => document.querySelectorAll('#jr-' + id + ' textarea[data-jf]').length === 4 && !document.getElementById('pass').classList.contains('on'), id), { timeout: 20000 }));
      r.lastUnlockError = ok ? null : await f.evaluate(() => document.getElementById('passErr').textContent);
      return ok;
    };
    const vaultCopies = async () => f.evaluate(() => {
      let ls = null; try { ls = JSON.parse(localStorage.getItem('hub.cache.f260.person.eli')).items['f260.journal.vault']; } catch {}
      const mem = hub.get('f260.journal.vault');
      return { mem: mem && { iv: mem.iv, ct: mem.ct }, ls: ls && ls.v && { iv: ls.v.iv, ct: ls.v.ct, t: ls.t } };
    });
    r.unlocked = await unlock();
    r.oldEntriesVisibleAfterUnlock = await f.evaluate(() => document.querySelectorAll('[data-jr].has').length);
    const srvBefore = (await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.journal.vault')).body.item;
    const devBefore = await f.evaluate(() => (hub.get('f260.journal.vault') || {}).ct);
    // 4. type ONE ordinary day's entry (4 × 240 chars ≈ 170 words) through the real textareas
    const NEW = { h: 'NEW-H ' + prose(234, 1), e: 'NEW-E ' + prose(234, 2), a: 'NEW-A ' + prose(234, 4), r: 'NEW-R ' + prose(234, 6) };
    // fill: Playwright fills the four fields back to back (a focusout save at each switch, ms apart)
    // human: each field typed, then a 2 s pause (the 300 ms debounce save and its flush both finish) before tapping the next
    // pause-then-tap: each field typed, then the next field tapped 450 ms later (debounce save at 300 ms, focusout save at 450 ms)
    for (const k of ['h', 'e', 'a', 'r']) {
      await f.fill(`#jf-${id}-${k}`, NEW[k]);
      if (typing === 'human') await sleep(2000); else if (typing === 'pause-then-tap') await sleep(450);
    }
    await f.evaluate(() => document.activeElement && document.activeElement.blur());
    await sleep(3500);
    r.afterType = {
      expectedCiphertextBytes: J.size + JSON.stringify({ [id]: { ...NEW, t: Date.now() } }).length - 1 + 16,
      savedLabel: await f.evaluate(id => { const s = document.querySelector('#jr-' + id + ' .jsaved'); return s && s.textContent; }, id),
      badgeHas: await f.evaluate(id => { const b = document.querySelector('[data-jr="' + id + '"]'); return !!b && b.classList.contains('has'); }, id),
      sync: (await d.hub(f)).sync.state,
      queue: (await d.hub(f)).queue,
      toast: await f.evaluate(() => { const t = document.getElementById('hub-toast'); return t && t.offsetParent !== null ? t.textContent : null; }),
      shellToast: await d.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && t.offsetParent !== null ? t.textContent : null; }),
      consoleErrors: d.logs.filter(l => /error|exception/i.test(l)).slice(-5),
      deviceVaultChanged: (await f.evaluate(() => (hub.get('f260.journal.vault') || {}).ct)) !== devBefore,
    };
    r.afterType.b64AtThatSize = await f.evaluate(n => { try { btoa(String.fromCharCode.apply(null, new Uint8Array(n))); return 'ok'; } catch (e) { return e.name + ': ' + e.message; } }, r.afterType.expectedCiphertextBytes);
    const srvAfter = (await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.journal.vault')).body.item;
    r.afterType.serverVaultChanged = srvAfter.updated_at !== srvBefore.updated_at || srvAfter.value.ct !== srvBefore.value.ct;
    const devJ = await openVault(V.dek, await f.evaluate(() => hub.get('f260.journal.vault')));
    const srvJ = await openVault(V.dek, srvAfter.value);
    r.afterType.decryptedDeviceVaultHasNewEntry = !!(devJ && devJ[id] && String(devJ[id].h).startsWith('NEW-H'));
    r.afterType.decryptedServerVaultHasNewEntry = !!(srvJ && srvJ[id] && String(srvJ[id].h).startsWith('NEW-H'));
    r.afterType.decryptedServerVaultEntries = srvJ ? Object.keys(srvJ).length : null;
    const vc = await vaultCopies();
    r.afterType.memVault = { ivIsSeeded: !!vc.mem && vc.mem.iv === V.blob.iv, ctIsSeeded: !!vc.mem && vc.mem.ct === V.blob.ct, decrypts: !!(await openVault(V.dek, vc.mem)) };
    r.afterType.localStorageVault = { ivIsSeeded: !!vc.ls && vc.ls.iv === V.blob.iv, ctIsSeeded: !!vc.ls && vc.ls.ct === V.blob.ct, tIsServer: !!vc.ls && vc.ls.t === srvAfter.updated_at, decrypts: !!(await openVault(V.dek, vc.ls)) };
    r.afterType.serverVaultDecrypts = !!srvJ;
    r.shotAfterType = await shot(d.page, `v2-jss-${engine}-${label}-after-type.png`);
    // 5. close F260, reopen, unlock, read the day back
    await d.goto('#home'); await sleep(800);
    f = await d.openApp('f260', { wait: '#todayDone' }); await sleep(1500);
    r.reUnlocked = await unlock();
    r.reUnlockError = r.lastUnlockError;
    { const vc2 = await vaultCopies(); r.afterReopenVault = { memDecrypts: !!(await openVault(V.dek, vc2.mem)), lsDecrypts: !!(await openVault(V.dek, vc2.ls)) }; }
    r.afterReopen = await f.evaluate(id => Object.fromEntries([...document.querySelectorAll('#jr-' + id + ' textarea[data-jf]')].map(t => [t.dataset.jf, t.value.slice(0, 12) + '… (' + t.value.length + ' chars)'])), id);
    r.afterReopen.savedLabel = await f.evaluate(id => { const s = document.querySelector('#jr-' + id + ' .jsaved'); return s && s.textContent; }, id);
    r.afterReopen.oldEntriesStillThere = await f.evaluate(() => document.querySelectorAll('[data-jr].has').length);
    r.shotAfterReopen = await shot(d.page, `v2-jss-${engine}-${label}-after-reopen.png`);
    log(`[${engine} ${device} ${label}] limit ${r.limit} B (${r.errorAtLimitPlus1} at +1); seed ${J.entries} days × 4 × ${perField} chars = ${J.size} B JSON (${r.seed.overLimitBy >= 0 ? '+' : ''}${r.seed.overLimitBy} vs limit), vault ${r.seed.vaultChars} chars, PUT ${put.status}; pulled ${r.pulled}; unlocked ${r.unlocked} (${r.oldEntriesVisibleAfterUnlock} days marked)`);
    log(`   typed 1 day (4 × 240 chars): label ${JSON.stringify(r.afterType.savedLabel)}, badge ${r.afterType.badgeHas}, sync ${r.afterType.sync}, toast ${JSON.stringify(r.afterType.toast || r.afterType.shellToast)}, console ${JSON.stringify(r.afterType.consoleErrors)}; b64 at ${r.afterType.expectedCiphertextBytes} B → ${r.afterType.b64AtThatSize}`);
    log(`   device vault changed ${r.afterType.deviceVaultChanged} (decrypts with new day: ${r.afterType.decryptedDeviceVaultHasNewEntry}); server vault changed ${r.afterType.serverVaultChanged} (decrypts with new day: ${r.afterType.decryptedServerVaultHasNewEntry})`);
    log(`   device copy of the vault after the failed saves: in memory ${JSON.stringify(r.afterType.memVault)}, in localStorage ${JSON.stringify(r.afterType.localStorageVault)}; server copy decrypts ${r.afterType.serverVaultDecrypts}`);
    log(`   after reopen: unlock ${r.reUnlocked} (${JSON.stringify(r.reUnlockError)}); vault decrypts mem/ls ${JSON.stringify(r.afterReopenVault)}; fields ${JSON.stringify(r.afterReopen)}`);
    if (!r.reUnlocked) {                                 // does a pull (the server still holds a good copy) repair it? then try again
      await f.evaluate(() => hub.pull()); await sleep(1500);
      const vc3 = await vaultCopies(); r.afterPull = { memDecrypts: !!(await openVault(V.dek, vc3.mem)) };
      await d.goto('#home'); await sleep(800); f = await d.openApp('f260', { wait: '#todayDone' }); await sleep(1500);
      r.afterPull.unlock = await unlock(); r.afterPull.unlockError = r.lastUnlockError;
      log(`   after a pull + reopen: vault decrypts ${r.afterPull.memDecrypts}; unlock ${r.afterPull.unlock} (${JSON.stringify(r.afterPull.unlockError)})`);
    }
  } catch (e) { r.error = String(e && e.stack || e); log(`[${engine} ${label}] ERROR ${r.error}`); }
  finally { await L.close(); }
  return r;
}

const out = [];
// Chromium: below (limit − 2,500 B before the new day; the new day adds ~1,080 B) and above (limit + 5,000 B)
out.push(await trial({ engine: 'chromium', device: 'desktop', label: 'below', bytesFor: lim => ({ bytes: lim - 16 - 2500, perField: 200 }) }));
out.push(await trial({ engine: 'chromium', device: 'desktop', label: 'above', bytesFor: lim => ({ bytes: lim - 16 + 5000, perField: 200 }) }));
out.push(await trial({ engine: 'chromium', device: 'desktop', label: 'above-human', typing: 'human', bytesFor: lim => ({ bytes: lim - 16 + 5000, perField: 200 }) }));
out.push(await trial({ engine: 'chromium', device: 'desktop', label: 'above-pausetap', typing: 'pause-then-tap', bytesFor: lim => ({ bytes: lim - 16 + 5000, perField: 200 }) }));
// WebKit iPad: the SAME ~129 KB journal that fails on Chromium, then one above WebKit's own limit (~2.5 KB per plan day)
out.push(await trial({ engine: 'webkit', device: 'ipad-portrait', label: 'chromium-size', bytesFor: () => ({ bytes: out[1].seed ? out[1].seed.journalJsonBytes : 129000, perField: 200 }) }));
out.push(await trial({ engine: 'webkit', device: 'ipad-portrait', label: 'above', bytesFor: lim => ({ bytes: lim - 16 + 5000, perField: 610 }) }));
out.push(await trial({ engine: 'webkit', device: 'ipad-portrait', label: 'above-human', typing: 'human', bytesFor: lim => ({ bytes: lim - 16 + 5000, perField: 610 }) }));
fs.writeFileSync(path.join(EVID, 'verify2-journal-silently-stops-saving-2.json'), JSON.stringify(out, null, 2));
log('evidence ' + path.relative(ROOT, path.join(EVID, 'verify2-journal-silently-stops-saving-2.json')).split(path.sep).join('/'));
