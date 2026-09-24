// SYNC — skeptic #2 for "journal-vault-iv-mismatch" (independent re-run, WebKit = the iPhone/iPad engine).
//   node "audits/tools/phase2/SYNC/verify2-journal-vault-iv-mismatch-2.mjs" [webkit|chromium]   (~1 min each)
// The seeded journal is sized from the argument limit MEASURED in the engine under test (probe below), so the crossing
// happens after a realistic amount of writing for that engine: WebKit runs as the iPhone, Chromium (installed Chrome) as desktop.
// Claim: persistJournal() (apps/f260.html:1015-1024) mutates the LIVE vault object hub.get returns (apps/hub.js:220-222):
// blob.iv = b64(iv) is assigned, then b64(ct) throws (String.fromCharCode.apply over the engine's argument limit, :993),
// the .catch swallows it, and the stored object now pairs a NEW iv with the OLD ct.
// Differences from skeptic #1's scripts: WebKit instead of Chromium; the vault crosses the limit the way a real journal
// would (a year of ordinary HEAR entries already in the vault, then one longer reflection), not a single 200,000-char field;
// the server copy is decrypted independently in Node with the passcode (with the stored iv and with the last good iv).
// Scenarios:  A  offline session in which the crossing happens;  B1 online, one save then idle;  B2 online, a debounce save
// followed at once by the blur ('change') save of the same field.
import { webcrypto as wc } from 'node:crypto';
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, serverRow, shot, writeEvidence } from './_util.mjs';

const PASS = '24680';
const ENGINE = process.argv[2] === 'chromium' ? 'chromium' : 'webkit';
const DEV = ENGINE === 'chromium' ? 'desktop' : 'iphone-pwa';
const r = { engine: ENGINE, device: DEV };
const unb64 = s => Uint8Array.from(Buffer.from(s, 'base64'));
async function decryptVault(v, ivOverride) {                    // the page's own v2 scheme (apps/f260.html:1003-1012), in Node
  try {
    const km = await wc.subtle.importKey('raw', new TextEncoder().encode(PASS), 'PBKDF2', false, ['deriveKey']);
    const kek = await wc.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(v.pass.salt), iterations: v.pass.iter || 200000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['unwrapKey']);
    const dek = await wc.subtle.unwrapKey('raw', unb64(v.pass.wk), kek, { name: 'AES-GCM', iv: unb64(v.pass.iv) }, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const pt = await wc.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivOverride || v.iv) }, dek, unb64(v.ct));
    const j = JSON.parse(new TextDecoder().decode(pt));
    return { ok: true, entries: Object.keys(j).length, bytes: pt.byteLength };
  } catch (e) { return { ok: false, error: String(e && e.name || e) }; }
}
// A realistic history, built with the same scheme and stored as Eli through the real API: ordinary HEAR entries for past
// weeks (~350 bytes each), sized to sit `target` bytes of plaintext (the engine limit minus ~1.6 KB).
async function buildVault(excludeId, target) {
  const words = 'grace mercy patience faith hope kindness joy peace trust promise light path shepherd bread water word rest strength'.split(' ');
  const say = (n, k) => Array.from({ length: n }, (_, i) => words[(i * 7 + k) % words.length]).join(' ');
  const journal = {}; let k = 0;
  const size = () => Buffer.byteLength(JSON.stringify(journal));
  const n = Math.max(9, Math.floor((target / 262 - 90) / 26));          // words per HEAR field
  outer: for (let w = 1; w <= 52; w++) for (let dd = 0; dd < 5; dd++) {
    const key = w + '-' + dd; if (key === excludeId) continue;
    const e = { h: 'Verse ' + (k + 1) + ': ' + say(n, k), e: say(n, k + 1), a: say(n, k + 2), r: say(n, k + 3), t: Date.now() - (400 - k) * 86400000 };
    if (Buffer.byteLength(JSON.stringify({ ...journal, [key]: e })) > target) break outer;
    journal[key] = e; k++;
  }
  const room = target - size() - 60;
  if (room > 0) journal._w = { '1': { n: say(Math.floor(room / 7), 3).slice(0, room), t: Date.now() - 300 * 86400000 } };
  const b64 = a => Buffer.from(new Uint8Array(a)).toString('base64');
  const rnd = n => wc.getRandomValues(new Uint8Array(n));
  const salt = rnd(16), piv = rnd(12), jiv = rnd(12);
  const km = await wc.subtle.importKey('raw', new TextEncoder().encode(PASS), 'PBKDF2', false, ['deriveKey']);
  const kek = await wc.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']);
  const dek = await wc.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const wk = await wc.subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv: piv });
  const ct = await wc.subtle.encrypt({ name: 'AES-GCM', iv: jiv }, dek, new TextEncoder().encode(JSON.stringify(journal)));
  return { vault: { v: 2, iv: b64(jiv), ct: b64(ct), pass: { salt: b64(salt), iter: 200000, iv: b64(piv), wk: b64(wk) } }, entries: Object.keys(journal).length, wordsPerField: n, bytes: size() };
}

const L = await local({ variant: 'typical', clock: 'real', engine: ENGINE });
try {
  async function setup(tag) {
    const phoneDev = await L.newDevice({ name: 'Eli iPhone ' + tag, profiles: ['eli'] });
    const d = await L.device({ device: DEV, profile: 'eli', fixedTime: false, as: phoneDev });
    const f = await d.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(600);
    const id = await f.evaluate(() => document.getElementById('todayDone').dataset.target);
    return { d, f, id };
  }
  const openEntry = async (fr, id) => { await fr.evaluate(id => { const b = document.querySelector('[data-jr="' + id + '"]'); b.scrollIntoView(); b.click(); }, id); await fr.waitForSelector('#pass.on', { timeout: 5000 }); };
  const mem = f => f.evaluate(() => { const v = hub.get('f260.journal.vault'); return v && { iv: v.iv, ctLen: v.ct.length, ctHead: v.ct.slice(0, 16) }; });
  const lsv = f => f.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('hub.cache.f260.person.eli') || '{}'), q = JSON.parse(localStorage.getItem('hub.queue.f260.person.eli') || '{}');
    const cv = c.items && c.items['f260.journal.vault'] && c.items['f260.journal.vault'].v, qv = q['f260.journal.vault'] && q['f260.journal.vault'].value;
    return { cache: cv && { iv: cv.iv, ctHead: cv.ct.slice(0, 16), ctLen: cv.ct.length }, queue: qv && { iv: qv.iv, ctHead: qv.ct.slice(0, 16) } };
  });
  const lsVault = f => f.evaluate(() => { const c = JSON.parse(localStorage.getItem('hub.cache.f260.person.eli') || '{}'); return c.items && c.items['f260.journal.vault'] && c.items['f260.journal.vault'].v; });
  // Type into the open entry's first field like a person: set the value, fire 'input' (300 ms debounce → saveJournal, :1858)
  const typeInto = (f, id, text, evt = 'input') => f.evaluate(({ id, text, evt }) => { const t = document.querySelector('#jr-' + id + ' textarea[data-jf]'); t.value = text; t.dispatchEvent(new Event(evt, { bubbles: true })); }, { id, text, evt });
  const label = (f, id) => f.evaluate(id => document.querySelector('#jr-' + id + ' .jsaved').textContent, id);
  const srv = async () => { const s = await serverRow(L, 'eli', 'f260', 'f260.journal.vault'); return s && s.value ? s.value : null; };
  const brief = v => v && { iv: v.iv, ctHead: v.ct.slice(0, 16), ctLen: v.ct.length };
  async function tryUnlock(dev, tag, id) {
    const fr = await dev.openApp('f260', { wait: '#todayDone' });
    await waitFor(() => fr.evaluate(() => hub.sync.lastPull > 0 && !!hub.get('f260.journal.vault')), { timeout: 15000 }); await sleep(600);
    await openEntry(fr, id);
    await fr.fill('#pass1', PASS); await fr.click('#passOk');
    await waitFor(() => fr.evaluate(() => { const e = document.getElementById('passErr').textContent; return (e && e !== 'Unlocking…') || !document.getElementById('pass').classList.contains('on'); }), { timeout: 20000 });
    await sleep(300);
    const out = await fr.evaluate(id => ({ passErr: document.getElementById('passErr').textContent, dialogOpen: document.getElementById('pass').classList.contains('on'), fields: [...document.querySelectorAll('#jr-' + id + ' textarea[data-jf]')].map(t => t.value.length) }), id);
    out.shot = await shot(dev.page, 'v2-ivmix-' + ENGINE + '-' + tag + '.png');
    return out;
  }

  // ── probe: WebKit's argument limit for String.fromCharCode.apply (the b64 helper, apps/f260.html:993)
  {
    const { d, f } = await setup('probe');
    r.applyLimit = await f.evaluate(() => { let lo = 1, hi = 1 << 22; const ok = n => { try { String.fromCharCode.apply(null, new Uint8Array(n)); return true; } catch { return false; } }; if (ok(hi)) return '>=' + hi; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ok(m)) lo = m; else hi = m; } return lo; });
    log(ENGINE + ': String.fromCharCode.apply works up to', r.applyLimit, 'arguments');
    await d.close();
  }
  const LIMIT = typeof r.applyLimit === 'number' ? r.applyLimit : 65536;

  async function startJournal(tag) {
    const s = await setup(tag);
    const built = await buildVault(s.id, LIMIT - 16 - 1600);
    const put = await L.apiAs('eli', '/api/data/f260/batch?scope=person', { method: 'POST', body: { items: [{ key: 'f260.journal.vault', value: built.vault, updated_at: Date.now() - 60000 }] } });
    s.seed = { entries: built.entries, wordsPerField: built.wordsPerField, bytes: built.bytes, put: put.status, vaultJsonBytes: JSON.stringify(built.vault).length };
    await s.d.goto('#home'); await sleep(600);
    s.f = await s.d.openApp('f260', { wait: '#todayDone' });
    const got = await waitFor(() => s.f.evaluate(() => hub.sync.lastPull > 0 && !!hub.get('f260.journal.vault')), { timeout: 15000 }); await sleep(600);
    await openEntry(s.f, s.id);
    await s.f.fill('#pass1', PASS); await s.f.click('#passOk');
    const open = await waitFor(() => s.f.evaluate(id => document.querySelectorAll('#jr-' + id + ' textarea[data-jf]').length === 4, s.id), { timeout: 30000 });
    if (!open) throw new Error('setup unlock failed: vault pulled ' + !!got + ', passErr ' + JSON.stringify(await s.f.evaluate(() => document.getElementById('passErr').textContent)) + ', logs ' + JSON.stringify(s.d.logs.slice(-5)));
    await typeInto(s.f, s.id, 'Today: the Lord is my shepherd.'); await sleep(1500);
    await waitFor(async () => (await s.f.evaluate(() => hub.sync.state)) === 'synced', { timeout: 10000 });
    const sv = await srv();
    s.base = { mem: await mem(s.f), server: brief(sv), serverDecrypts: await decryptVault(sv) };
    return s;
  }
  const reflection = n => 'I want to remember this week that '.concat('patience grows when I stop and listen. '.repeat(n));

  // ══ A: an offline session in which the vault crosses the limit ══
  {
    const A = await startJournal('A');
    r.A = { seed: A.seed, base: A.base };
    log(`[A base] seeded ${A.seed.entries} entries (${A.seed.wordsPerField} words/field), ${A.seed.bytes} B plaintext, vault ${A.seed.vaultJsonBytes} B JSON (limit ${LIMIT}, put ${A.seed.put}); after first save server ${JSON.stringify(A.base.server)} decrypts ${JSON.stringify(A.base.serverDecrypts)}`);
    await A.d.setOffline(true); await sleep(300);
    await typeInto(A.f, A.id, 'Today: the Lord is my shepherd. ' + reflection(10)); await sleep(1200);   // still under → saved + queued
    r.A.s1_under = { mem: await mem(A.f), ls: await lsv(A.f) };
    const goodIv = r.A.s1_under.mem.iv;
    await typeInto(A.f, A.id, 'Today: the Lord is my shepherd. ' + reflection(120)); await sleep(1200);   // crosses the limit
    r.A.s2_cross = { mem: await mem(A.f), ls: await lsv(A.f), label: await label(A.f, A.id) };
    await typeInto(A.f, A.id, 'Today: the Lord is my shepherd. ' + reflection(121)); await sleep(1200);   // one more sentence
    r.A.s3_next = { mem: await mem(A.f), ls: await lsv(A.f), label: await label(A.f, A.id) };
    r.A.s3_shot = await shot(A.d.page, 'v2-ivmix-' + ENGINE + '-A-offline-saved-label.png');
    const replies = []; A.d.page.on('response', res => { if (/\/api\/data\/f260\/batch/.test(res.url())) replies.push(res.status()); });
    await A.d.setOffline(false);
    await waitFor(() => replies.length > 0, { timeout: 15000 }); await sleep(2500);
    const sv = await srv();
    r.A.s4_online = { replies, server: brief(sv), serverDecryptsWithStoredIv: await decryptVault(sv), serverDecryptsWithLastGoodIv: await decryptVault(sv, goodIv) };
    log(`[A1 offline, under] mem ${JSON.stringify(r.A.s1_under.mem)}; ls ${JSON.stringify(r.A.s1_under.ls)}`);
    log(`[A2 offline, cross] mem ${JSON.stringify(r.A.s2_cross.mem)}; ls ${JSON.stringify(r.A.s2_cross.ls)}; label ${JSON.stringify(r.A.s2_cross.label)}`);
    log(`[A3 offline, next ] mem ${JSON.stringify(r.A.s3_next.mem)}; ls ${JSON.stringify(r.A.s3_next.ls)}; label ${JSON.stringify(r.A.s3_next.label)}`);
    log(`[A4 online] replies ${JSON.stringify(replies)}; server ${JSON.stringify(r.A.s4_online.server)}; decrypt(stored iv) ${JSON.stringify(r.A.s4_online.serverDecryptsWithStoredIv)}; decrypt(last good iv ${goodIv}) ${JSON.stringify(r.A.s4_online.serverDecryptsWithLastGoodIv)}`);
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    r.A.ipadUnlock = await tryUnlock(ipad, 'A-ipad-unlock', A.id);
    log(`[A iPad] right passcode → ${JSON.stringify(r.A.ipadUnlock)}`);
    await A.d.goto('#home'); await sleep(800);
    r.A.phoneReopenUnlock = await tryUnlock(A.d, 'A-phone-reopen-unlock', A.id);
    log(`[A phone reopened] right passcode → ${JSON.stringify(r.A.phoneReopenUnlock)}`);
    await ipad.close(); await A.d.close();
  }

  // ══ B: online. B1 = the crossing save, then idle. B2 = the debounce save, then the blur save (focusout, :1864-1867)
  //    60 ms later. B3 = B2 on a slow uplink (every API response held 600 ms). ══
  async function runB(tag, { blur, latency }) {
    await L.reset('typical');
    const B = await startJournal(tag);
    const o = r[tag] = { seed: B.seed, base: B.base, blur, latency };
    if (latency) await B.d.ctx.route(u => u.href.startsWith(L.api), async rt => { const resp = await rt.fetch(); await sleep(latency); await rt.fulfill({ response: resp }); });
    await typeInto(B.f, B.id, 'Today: the Lord is my shepherd. ' + reflection(120));
    if (blur) { await sleep(360); await typeInto(B.f, B.id, 'Today: the Lord is my shepherd. ' + reflection(120), 'focusout'); }
    await sleep(5000);
    o.cross = { mem: await mem(B.f), ls: await lsv(B.f), label: await label(B.f, B.id) };
    const sv = await srv();
    o.server = brief(sv); o.serverDecrypts = await decryptVault(sv);
    o.localCacheDecrypts = await decryptVault(await lsVault(B.f));
    log(`[${tag} online${blur ? ', save + blur' : ', one save'}${latency ? ', API +' + latency + ' ms' : ''}] base ${JSON.stringify(B.base.mem)}; mem ${JSON.stringify(o.cross.mem)}; ls ${JSON.stringify(o.cross.ls)}; local cache decrypts ${JSON.stringify(o.localCacheDecrypts)}; server ${JSON.stringify(o.server)} decrypts ${JSON.stringify(o.serverDecrypts)}; label ${JSON.stringify(o.cross.label)}`);
    await B.d.goto('#home'); await sleep(800);
    o.phoneReopenUnlock = await tryUnlock(B.d, tag + '-writer-reopen-unlock', B.id);
    log(`[${tag} writing device reopened] right passcode → ${JSON.stringify(o.phoneReopenUnlock)}`);
    const ipad = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    o.ipadUnlock = await tryUnlock(ipad, tag + '-ipad-unlock', B.id);
    log(`[${tag} iPad] right passcode → ${JSON.stringify(o.ipadUnlock)}`);
    await ipad.close(); await B.d.close();
  }
  await runB('B1', { blur: false, latency: 0 });
  await runB('B2', { blur: true, latency: 0 });
  await runB('B3', { blur: true, latency: 600 });
} catch (e) { r.error = String(e && e.stack || e); log('ERROR', r.error); }
finally { await L.close(); }
log('evidence', writeEvidence('verify2-journal-vault-iv-mismatch-2-' + ENGINE + '.json', r));
