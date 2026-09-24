// CHAT skeptic #2 — "get_data returns the encrypted F260 journal vault when asked for it by key".
// Builds REAL v2 vault blobs exactly as apps/f260.html:1011-1033 does (PBKDF2-SHA256 200k → KEK wraps a random AES-256-GCM
// DEK; journal JSON encrypted with the DEK), stores each one as Eli's person-scope f260.journal.vault on the local rig, then
// has the scripted upstream call get_data (listing, and by key) and records exactly what tool_result was sent upstream.
// Also checks that the leaked fields alone let an offline attacker verify passcode guesses.
//   node "audits/tools/phase2/CHAT/verify-vault-readable-by-key-2.mjs"
import crypto from 'node:crypto';
import { local } from '../../lib/local.mjs';
import { toolCall, put, data, save } from './lib.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const subtle = crypto.webcrypto.subtle;
const b64 = a => Buffer.from(new Uint8Array(a)).toString('base64');
const unb64 = s => new Uint8Array(Buffer.from(s, 'base64'));
const rand = n => crypto.webcrypto.getRandomValues(new Uint8Array(n));
const ITER = 200000, AES = { name: 'AES-GCM', length: 256 }, KEK_USES = ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt'];
const passKek = async (pass, salt, iter) => subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
  await subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']), AES, false, KEK_USES);

async function makeVault(pass, journal) {                       // f260.html setPasscode() + persistJournal()
  const salt = rand(16), kek = await passKek(pass, salt, ITER);
  const dek = await subtle.generateKey(AES, true, ['encrypt', 'decrypt']);
  const wiv = rand(12), wk = await subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv: wiv });
  const iv = rand(12), ct = await subtle.encrypt({ name: 'AES-GCM', iv }, dek, new TextEncoder().encode(JSON.stringify(journal)));
  return { v: 2, pass: { salt: b64(salt), iter: ITER, iv: b64(wiv), wk: b64(wk) }, iv: b64(iv), ct: b64(ct) };
}
async function guessOk(blob, guess) {                           // what an attacker holding the tool_result can do offline
  try { const kek = await passKek(guess, unb64(blob.pass.salt), blob.pass.iter);
    await subtle.unwrapKey('raw', unb64(blob.pass.wk), kek, { name: 'AES-GCM', iv: unb64(blob.pass.iv) }, AES, true, ['decrypt']); return true; }
  catch { return false; }
}
// A modest HEAR entry (Highlight / Explain / Apply / Respond + time), shape as apps/f260.html:1826-1828.
const entry = i => ({ h: 'Genesis 1:27 - made in His image.', e: 'Every person carries the image of God; worth is given, not earned. ' + 'x'.repeat(60),
  a: 'Be patient with the kids this morning and speak kindly at dinner. ' + 'y'.repeat(60), r: 'Lord, help me see people the way You do. ' + 'z'.repeat(60), t: 1790000000000 + i });
const journalOf = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${1 + Math.floor(i / 5)}-${i % 5}`, entry(i)]));

const out = { cases: [] };
const L = await local({ variant: 'typical', clock: 'real' });   // real clock: under the slowed demo clock putOne clamps each updated_at to the same server now and later PUTs are not applied
try {
  for (const n of [0, 1, 3, 5, 6, 8, 12, 30]) {
    const blob = await makeVault('1234', journalOf(n));
    const size = JSON.stringify(blob).length;
    await sleep(5);
    const w = await put(L, 'eli', 'f260', 'person', 'f260.journal.vault', blob);
    const byKey = await toolCall(L, 'eli', 'get_data', { app_id: 'f260', scope: 'person', key: 'f260.journal.vault' });
    const list = await toolCall(L, 'eli', 'get_data', { app_id: 'f260', scope: 'person' });
    const c = String(byKey.toolResult && byKey.toolResult.content);
    const stored = await data(L, 'eli', 'f260', 'person', 'f260.journal.vault');
    const row = { journalEntries: n, vaultJsonChars: size, putStatus: w.status, putApplied: w.body && w.body.applied, storedIsThisVault: !!stored && stored.ct === blob.ct, upstreamGotCiphertext: c.includes(blob.ct), upstreamGotSaltAndWrappedKey: c.includes(blob.pass.salt) && c.includes(blob.pass.wk),
      toolResultHead: c.slice(0, 90), listingMentionsVault: /journal\.vault/.test(String(list.toolResult && list.toolResult.content)) };
    if (n === 1) { const leaked = JSON.parse(c); row.offlineGuess = { '0000': await guessOk(leaked, '0000'), '1111': await guessOk(leaked, '1111'), '1234': await guessOk(leaked, '1234') }; }
    out.cases.push(row); console.log(JSON.stringify(row));
  }
  // Is the vault key discoverable by the model without the user naming it? (system prompt + tool descriptions + listing)
  const log = await (async () => { await toolCall(L, 'eli', 'get_data', { app_id: 'f260', scope: 'person' }); return L.anthropicLog(); })();
  const first = log[0] && log[0].body;
  out.keyNameInSystemPrompt = /journal\.vault|\.vault/.test(JSON.stringify(first && first.system));
  out.keyNameInToolDefs = /journal\.vault|\.vault/.test(JSON.stringify(first && first.tools));
  console.log('vault key named in system prompt:', out.keyNameInSystemPrompt, '| in tool definitions:', out.keyNameInToolDefs);
  // Does a tool_result ever reach chat_log / history? (only the user text + final assistant text are stored)
  const hist = (await L.apiAs('eli', '/api/chat/history')).body;
  out.historyContainsCiphertext = /"ct"|AES|pass\.salt/.test(JSON.stringify(hist));
  console.log('chat history (D1 chat_log) contains vault fields:', out.historyContainsCiphertext);
} finally { await L.close(); }
console.log('evidence →', save('verify-vault-readable-by-key-2.json', out));
