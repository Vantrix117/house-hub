// Skeptic #1 (journal-silently-stops-saving): does F260's journal really stop saving, silently, once it outgrows b64()?
//   node "audits/tools/phase2/SYNC/verify2-journal-silently-stops-saving-1.mjs"            (~5-7 min)
// Independent of verify-413-drops-whole-channel-1-real.mjs (which typed ONE giant entry into an empty journal).
// Here the journal grows the way a person grows it: one ordinary HEAR entry (~865 B of JSON) per reading day, week 1 day 1
// onwards, through the real textareas (input + focusout), until a save stops landing. "Landed" = the vault row's ct changed.
// NB the vault's iv is NOT a success signal: persistJournal() mutates the cached vault object in place (blob.iv = …) BEFORE
// b64(ct) throws (apps/f260.html:1020-1021; hub.get returns the live cached object, apps/hub.js:220-223).
// F260's code lives inside a hub.ready().then(() => {…}) closure (apps/f260.html:779), so everything is read from outside.
// Ground truth for "is this vault still readable": decrypt it in Node with the passcode (PBKDF2 → unwrap DEK → AES-GCM),
// for the in-memory cache (hub.get), the device's localStorage cache, and the server row.
// Scenarios, each on a fresh rig instance (Chromium desktop, whose b64 limit ordinary daily entries reach in ~29 weeks):
//   S1 sparse   — one short entry typed on the keyboard, blur, wait; then auto-lock → unlock; then close/reopen → unlock
//   S2 slow net — the same person keeps writing with thinking pauses on a 600 ms-latency connection (debounced saves)
//   S3 offline  — the same writing with the device offline, then back online
// Plus a direct probe of the exact b64() expression (apps/f260.html:993) in Chromium and WebKit.
import { webcrypto as wc } from 'node:crypto';
import { local, sleep } from '../../lib/local.mjs';
import { log, waitFor, shot, writeEvidence, serverRow } from './_util.mjs';

const PASS = '24680';
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const WORDS = 'the lord is my shepherd I shall not want he makes me lie down in green pastures leads me beside still waters restores my soul today I noticed how patient he was with them even when they grumbled in the wilderness and I want to be like that with the kids this week pray for Mom and Dad and for rest and for the courage to keep reading every morning before work thank you for bread and for the family'.split(' ');
const text = n => { let s = ''; while (s.length < n) s += WORDS[Math.floor(rnd() * WORDS.length)] + (rnd() < 0.08 ? '. ' : ' '); return s.slice(0, n).trim() + '.'; };
const entry = () => ({ h: text(Math.round(60 + rnd() * 60)), e: text(Math.round(200 + rnd() * 120)), a: text(Math.round(200 + rnd() * 120)), r: text(Math.round(150 + rnd() * 110)) });
const IDS = []; for (let w = 1; w <= 52; w++) for (let d = 0; d < 5; d++) IDS.push(w + '-' + d);
const J = {}; const jBytes = () => Buffer.byteLength(JSON.stringify(J));   // mirror of the journal JSON the app encrypts

// ── decrypt a vault blob exactly as apps/f260.html:1003-1012 + 1039-1041 do ──
const ub = s => Uint8Array.from(Buffer.from(s, 'base64'));
async function readable(blob) {
  if (!blob || !blob.pass || !blob.ct) return { ok: false, why: 'no blob' };
  try {
    const km = await wc.subtle.importKey('raw', new TextEncoder().encode(PASS), 'PBKDF2', false, ['deriveKey']);
    const kek = await wc.subtle.deriveKey({ name: 'PBKDF2', salt: ub(blob.pass.salt), iterations: blob.pass.iter || 200000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['unwrapKey']);
    const dek = await wc.subtle.unwrapKey('raw', ub(blob.pass.wk), kek, { name: 'AES-GCM', iv: ub(blob.pass.iv) }, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const pt = await wc.subtle.decrypt({ name: 'AES-GCM', iv: ub(blob.iv) }, dek, ub(blob.ct));
    const j = JSON.parse(new TextDecoder().decode(pt));
    return { ok: true, entries: Object.keys(j).filter(k => k !== '_w').length };
  } catch (e) { return { ok: false, why: e.name + ': ' + e.message }; }
}
const sig = b => b && b.ct ? { iv: b.iv, ctLen: b.ct.length, ctTail: b.ct.slice(-16) } : null;
async function vaultCopies(L, f) {
  const mem = await f.evaluate(() => hub.get('f260.journal.vault'));
  const ls = await f.evaluate(() => { try { const c = JSON.parse(localStorage.getItem('hub.cache.f260.person.eli')); const it = c.items['f260.journal.vault']; return it && it.v; } catch { return null; } });
  const srvRow = await serverRow(L, 'eli', 'f260', 'f260.journal.vault'); const srv = srvRow && srvRow.value;
  return { memory: { ...sig(mem), ...(await readable(mem)) }, localStorage: { ...sig(ls), ...(await readable(ls)) }, server: { ...sig(srv), ...(await readable(srv)) } };
}

async function openF260(d) {
  const f = await d.openApp('f260', { wait: '#todayDone' });
  await waitFor(() => f.evaluate(() => hub.sync.lastPull > 0), { timeout: 15000 }); await sleep(600);
  return f;
}
// tap HEAR → passcode dialog → type it → Unlock. Returns { unlocked, passErr }.
async function unlockVia(f, id, set) {
  await f.evaluate(id => { const b = document.querySelector('[data-jr="' + id + '"]'); b.scrollIntoView(); b.click(); }, id);
  await f.waitForSelector('#pass.on', { timeout: 5000 });
  await f.fill('#pass1', PASS); if (set) await f.fill('#pass2', PASS); await f.click('#passOk');
  const done = await waitFor(() => f.evaluate(id => {
    if (!document.getElementById('pass').classList.contains('on') && document.querySelectorAll('#jr-' + id + ' textarea[data-jf]').length === 4) return 'unlocked';
    const e = document.getElementById('passErr').textContent; return /Wrong|went wrong/.test(e) ? e : null;
  }, id), { timeout: 20000 });
  return { unlocked: done === 'unlocked', passErr: done === 'unlocked' ? null : await f.evaluate(() => document.getElementById('passErr').textContent) };
}
const ctSigInFrame = f => f.evaluate(() => { const v = hub.get('f260.journal.vault'); return v && v.ct ? v.ct.length + ':' + v.ct.slice(-24) : null; });
// one bulk entry through the textareas (input → 300 ms debounce; focusout saves at once); landed = the vault's ct changed
async function typeEntry(f, id, e) {
  const before = await ctSigInFrame(f);
  await f.evaluate(({ id, e }) => {
    const btn = document.querySelector('[data-jr="' + id + '"]'), panel = document.getElementById('jr-' + id);
    if (!panel.classList.contains('on')) btn.click();
    for (const t of panel.querySelectorAll('textarea[data-jf]')) {
      if (!(t.dataset.jf in e)) continue;
      t.focus(); t.value = e[t.dataset.jf];
      t.dispatchEvent(new Event('input', { bubbles: true }));
      t.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    }
  }, { id, e });
  const landed = !!(await waitFor(async () => (await ctSigInFrame(f)) !== before, { timeout: 1500, every: 50 }));
  await sleep(400);                                            // let the flush (250 ms) + its refreshScope run before the next entry
  const saved = await f.evaluate(id => { const s = document.querySelector('#jr-' + id + ' .jsaved'); return s && s.textContent; }, id);
  return { id, landed, saved };
}
const openWeekAt = (f, id) => f.evaluate(id => { const w = +id.split('-')[0]; const sec = document.getElementById('week-' + w); if (sec && !sec.classList.contains('open')) sec.querySelector('.wk-head').click(); const p = document.getElementById('jr-' + id); if (!p.classList.contains('on')) document.querySelector('[data-jr="' + id + '"]').click(); p.scrollIntoView({ block: 'center' }); }, id);
// a person writing: words typed on the keyboard with thinking pauses (debounced saves), moving field to field
async function writeLikeAPerson(f, id, fields, { words = 10, pause = 450 } = {}) {
  await openWeekAt(f, id); await sleep(300);
  for (const k of fields) {
    const loc = f.locator('#jf-' + id + '-' + k);
    await loc.click();
    for (let i = 0; i < words; i++) { await loc.pressSequentially(WORDS[Math.floor(rnd() * WORDS.length)] + ' ', { delay: 35 }); await sleep(pause); }
  }
  await f.locator('#jr-' + id + ' .jhd').click();                // tap outside the textarea → focusout → save
}
async function uiState(d, f, id) {
  return {
    savedLabel: await f.evaluate(id => { const s = document.querySelector('#jr-' + id + ' .jsaved'); return s && s.textContent; }, id),
    hearDot: await f.evaluate(id => document.querySelector('[data-jr="' + id + '"]').classList.contains('has'), id),
    toast: await d.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && t.offsetParent !== null ? t.textContent : null; }).catch(() => null),
    appSync: (await d.hub(f)).sync.state, shellSync: (await d.hub()).sync.state,
    consoleErrors: d.logs.filter(l => /error|exception|range/i.test(l)).slice(-5),
  };
}

async function probeB64(f) {
  return f.evaluate(() => { const b64 = a => btoa(String.fromCharCode.apply(null, new Uint8Array(a)));
    let lo = 1000, hi = 4000000; const ok = n => { try { b64(new Uint8Array(n)); return true; } catch (e) { return false; } };
    if (ok(hi)) return { maxOk: hi + '+' }; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ok(m)) lo = m; else hi = m; }
    let err; try { b64(new Uint8Array(hi)); } catch (e) { err = e.name + ': ' + e.message; } return { maxOkBytes: lo, firstFail: hi, error: err }; });
}

// fill ordinary daily entries until one does not land; returns { f, rows, next }
async function fillToLimit(L, d, label) {
  seed = 7; for (const k of Object.keys(J)) delete J[k];
  const f = await openF260(d);
  const set = await unlockVia(f, '1-0', true); if (!set.unlocked) throw new Error('passcode setup failed ' + set.passErr);
  const rows = [];
  for (let i = 0; i < IDS.length; i++) {
    const e = entry(); J[IDS[i]] = { ...e, t: Date.now() };
    const row = await typeEntry(f, IDS[i], e); row.journalBytes = jBytes(); rows.push(row);
    if (rows.length >= 3 && rows.slice(-3).every(x => !x.landed)) break;   // three ordinary entries in a row did not land: well past the limit (V8's apply limit moves by ~100 B with stack depth)
    if ((i + 1) % 40 === 0) log(`[${label}] ${i + 1} ordinary entries landed; journal JSON ~${row.journalBytes} B`);
  }
  const first = rows.find(x => !x.landed), last = rows[rows.length - 1];
  log(`[${label}] first entry that did NOT land: #${rows.indexOf(first) + 1} (${first.id}, week ${first.id.split('-')[0]}), journal JSON ~${first.journalBytes} B; stopped after #${rows.length} (${last.id}), journal ~${last.journalBytes} B; landed ${rows.filter(x => x.landed).length} of ${rows.length}; last panel says ${JSON.stringify(last.saved)}`);
  return { f, rows, next: rows.length };
}

async function scenario(name, engine, run) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  const r = { scenario: name, engine };
  try {
    const d = await L.device({ device: 'desktop', profile: 'eli', fixedTime: false });
    const { f, rows, next } = await fillToLimit(L, d, name);
    r.limit = { entriesTyped: rows.length, entriesLanded: rows.filter(x => x.landed).length, firstFailedEntry: rows.find(x => !x.landed), lastEntry: rows[rows.length - 1], landedAfterFirstFailure: rows.slice(rows.findIndex(x => !x.landed)).filter(x => x.landed).map(x => x.id) };
    await sleep(1500);
    r.afterLimit = await vaultCopies(L, f);
    log(`[${name}] right after the first failed entry: ${JSON.stringify(r.afterLimit)}`);
    await run({ L, d, f, r, id: IDS[next] });
  } finally { await L.close(); }
  return r;
}
async function reopenAndUnlock(L, d, r, name, id, tag) {
  await d.goto('#home'); await sleep(800);
  const f = await openF260(d);
  r[tag + 'VaultCopiesOnReopen'] = await vaultCopies(L, f);
  const u = await unlockVia(f, id, false); r[tag] = u;
  if (u.unlocked) { await openWeekAt(f, id); await sleep(400); u.fields = await f.evaluate(id => [...document.querySelectorAll('#jr-' + id + ' textarea[data-jf]')].map(t => t.value.length), id); u.entriesMarked = await f.evaluate(() => document.querySelectorAll('.jbtn.has').length); }
  u.shot = await shot(d.page, `v2-jss-${name}-reopen.png`);
  log(`[${name}] close + reopen F260, unlock with the right passcode → ${JSON.stringify(u)}`);
  return f;
}

const out = { b64: {}, scenarios: [] };
for (const engine of ['chromium', 'webkit']) {
  const L = await local({ variant: 'typical', clock: 'real', engine });
  try { const d = await L.device({ device: engine === 'webkit' ? 'iphone-pwa' : 'desktop', profile: 'eli', fixedTime: false }); out.b64[engine] = await probeB64(await openF260(d)); }
  finally { await L.close(); }
  log(`b64() (apps/f260.html:993) in ${engine}: ${JSON.stringify(out.b64[engine])}`);
}

// S1 — the candidate's scenario: one short entry after the limit, then auto-lock, then reopen
out.scenarios.push(await scenario('S1-sparse', 'chromium', async ({ L, d, f, r, id }) => {
  await openWeekAt(f, id); await sleep(300);
  await f.locator('#jf-' + id + '-r').click(); await f.locator('#jf-' + id + '-r').pressSequentially('Short prayer for Mom today.', { delay: 35 });
  await f.locator('#jr-' + id + ' .jhd').click(); await sleep(3000);
  r.ui = await uiState(d, f, id); r.vault = await vaultCopies(L, f);
  r.shotSaved = await shot(d.page, 'v2-jss-S1-sparse-saved-label.png');
  log(`[S1-sparse] short entry ${id}: UI ${JSON.stringify(r.ui)}; vault copies ${JSON.stringify(r.vault)}`);
  // auto-lock: the frame's clock moves 16 min on with no input, then the app's own visibilitychange → idleCheck() (apps/f260.html:2041-2049)
  await f.evaluate(() => { const real = Date.now.bind(Date); window.__realNow = real; Date.now = () => real() + 16 * 60000; document.dispatchEvent(new Event('visibilitychange')); });
  r.autoLocked = !!(await waitFor(() => f.evaluate(() => document.querySelectorAll('textarea[data-jf]').length === 0 && !!document.querySelector('.locked')), { timeout: 10000 }));
  await f.evaluate(() => { Date.now = window.__realNow; });
  const u = await unlockVia(f, id, false); r.afterAutolock = u;
  if (u.unlocked) { await openWeekAt(f, id); u.shortField = await f.evaluate(id => document.querySelector('#jf-' + id + '-r').value, id); }
  log(`[S1-sparse] auto-lock fired ${r.autoLocked}; unlock → ${JSON.stringify(u)}`);
  await reopenAndUnlock(L, d, r, 'S1-sparse', id, 'afterReopen');
}));

// S2 — keeps writing with thinking pauses on a slow (600 ms) connection
out.scenarios.push(await scenario('S2-slow-net', 'chromium', async ({ L, d, f, r, id }) => {
  const slow = u => u.pathname.startsWith('/api/'); await d.ctx.route(slow, async route => { await sleep(600); await route.continue().catch(() => {}); });
  await writeLikeAPerson(f, id, ['h', 'e'], { words: 8, pause: 450 }); await sleep(4000);
  r.ui = await uiState(d, f, id); r.vault = await vaultCopies(L, f);
  r.shotSaved = await shot(d.page, 'v2-jss-S2-slow-net-saved-label.png');
  log(`[S2-slow-net] entry ${id}: UI ${JSON.stringify(r.ui)}; vault copies ${JSON.stringify(r.vault)}`);
  await d.ctx.unroute(slow).catch(() => {});
  await reopenAndUnlock(L, d, r, 'S2-slow-net', id, 'afterReopen');
}));

// S3 — the same writing offline, then back online
out.scenarios.push(await scenario('S3-offline', 'chromium', async ({ L, d, f, r, id }) => {
  await d.setOffline(true);
  await writeLikeAPerson(f, id, ['h', 'e'], { words: 8, pause: 450 }); await sleep(1500);
  r.uiOffline = await uiState(d, f, id); r.vaultOffline = await vaultCopies(L, f);
  await d.setOffline(false); await sleep(5000);
  r.ui = await uiState(d, f, id); r.vault = await vaultCopies(L, f);
  r.shotSaved = await shot(d.page, 'v2-jss-S3-offline-saved-label.png');
  log(`[S3-offline] entry ${id}: UI offline ${JSON.stringify(r.uiOffline)}, back online ${JSON.stringify(r.ui)}; vault copies ${JSON.stringify(r.vault)}`);
  await reopenAndUnlock(L, d, r, 'S3-offline', id, 'afterReopen');
}));

log('evidence ' + writeEvidence('verify2-journal-silently-stops-saving-1.json', out));
