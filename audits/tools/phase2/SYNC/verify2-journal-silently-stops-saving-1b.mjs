// Skeptic #1 (journal-silently-stops-saving), part b: the S2/S3 writing pattern on the rig's normal (fast, local) network,
// and whether a later pull ever repairs the device's vault.
//   node "audits/tools/phase2/SYNC/verify2-journal-silently-stops-saving-1b.mjs"            (~2 min)
// Same helpers as verify2-journal-silently-stops-saving-1.mjs (copied): fill ordinary daily entries until three in a row do not
// land, then write the next day's entry like a person (words typed on the keyboard, 450 ms thinking pauses, H then E, tap out).
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

const out = { scenarios: [] };
out.scenarios.push(await scenario('S4-fast-net', 'chromium', async ({ L, d, f, r, id }) => {
  await writeLikeAPerson(f, id, ['h', 'e'], { words: 8, pause: 450 }); await sleep(4000);
  r.ui = await uiState(d, f, id); r.vault = await vaultCopies(L, f);
  log(`[S4-fast-net] entry ${id}: UI ${JSON.stringify(r.ui)}; vault copies ${JSON.stringify(r.vault)}`);
  const f2 = await reopenAndUnlock(L, d, r, 'S4-fast-net', id, 'afterReopen');
  // wait for the 30 s background pull, then try again: does the server's good copy ever come back to this device?
  await f2.evaluate(() => document.getElementById('passCancel').click()).catch(() => {});
  const lp = await f2.evaluate(() => hub.sync.lastPull);
  r.laterPull = !!(await waitFor(() => f2.evaluate(lp => hub.sync.lastPull > lp, lp), { timeout: 45000, every: 1000 }));
  r.vaultAfterLaterPull = await vaultCopies(L, f2);
  const u2 = await unlockVia(f2, id, false); r.unlockAfterLaterPull = u2;
  log(`[S4-fast-net] after a later pull (${r.laterPull}): vault copies ${JSON.stringify(r.vaultAfterLaterPull)}; unlock → ${JSON.stringify(u2)}`);
  r.shotAfterPull = await shot(d.page, 'v2-jss-S4-fast-net-after-pull.png');
}));
log('evidence ' + writeEvidence('verify2-journal-silently-stops-saving-1b.json', out));
