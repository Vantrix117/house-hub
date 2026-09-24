// CHAT skeptic #1 — "get_data returns the encrypted F260 journal vault when asked for it by key".
// Builds a REAL vault with the F260 app itself (WebKit, iPhone PWA, Eli): sets a 4-character passcode through the
// passcode modal, types HEAR entries into the day panels, lets hub.js sync the vault row, then asks chat (scripted
// upstream) for get_data {f260, person, key:'f260.journal.vault'} and inspects the tool_result the Worker sends upstream.
// Then: (a) decrypts the journal from the tool_result text alone (proves it carries everything an offline attacker
// needs), (b) times one PBKDF2 guess to size a brute force, (c) keeps adding entries until the 4000-char BIG_VALUE
// guard (worker/src/chat.js:19,159) withholds the value, (d) re-checks the listing filter and the set_data refusal.
//   node "audits/tools/phase2/CHAT/verify-vault-readable-by-key-1.mjs"
import { webcrypto as wc } from 'node:crypto';
import { local, sleep } from '../../lib/local.mjs';
import { toolCall, save, short } from './lib.mjs';

const PASS = '1234';
const out = { runAt: new Date().toISOString(), steps: [] };
const step = (name, o) => { out.steps.push({ name, ...o }); console.log(`\n## ${name}\n` + Object.entries(o).map(([k, v]) => `  ${k}: ${short(v, 300)}`).join('\n')); };
const unb64 = s => Uint8Array.from(Buffer.from(s, 'base64'));

async function decryptFrom(blob, pass) {
  const km = await wc.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const kek = await wc.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(blob.pass.salt), iterations: blob.pass.iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['unwrapKey']);
  const dek = await wc.subtle.unwrapKey('raw', unb64(blob.pass.wk), kek, { name: 'AES-GCM', iv: unb64(blob.pass.iv) }, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await wc.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, dek, unb64(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

const L = await local({ variant: 'typical', clock: 'real' });
try {
  const phone = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  const f = await phone.openApp('f260', { wait: '#tabJournal' });
  await sleep(800);
  const before = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.journal.vault');
  step('before', { serverVaultRow: before.body.item ? 'present' : 'absent' });

  // 1. set the passcode through the real modal
  await f.click('#tabJournal');
  await f.waitForSelector('#pass.on', { timeout: 5000 });
  const title = await f.textContent('#passTitle');
  await f.fill('#pass1', PASS); await f.fill('#pass2', PASS);
  await f.click('#passOk');
  await f.waitForSelector('#pass:not(.on)', { state: 'attached', timeout: 20000 });
  await f.click('#tabPlan');
  await sleep(500);

  // HEAR entry text (dummy audit content, realistic length: ~120-170 chars a field)
  const entry = n => ({ h: `Audit highlight ${n}: Genesis 1:27 — made in his image.`, e: `Audit explain ${n}: every person carries worth because God made them; the passage repeats "created" three times for emphasis.`, a: `Audit apply ${n}: speak to the kids this week as people who bear his image, especially when I am tired at bedtime.`, r: `Audit respond ${n}: Father, help me see each person at the table today the way you see them. Amen.` });
  const panelIds = await f.evaluate(() => [...document.querySelectorAll('[data-jrpanel]')].map(p => p.dataset.jrpanel));
  async function writeEntry(i) {
    const id = panelIds[i], e = entry(i + 1);
    return f.evaluate(([id, e]) => {
      const panel = document.querySelector(`[data-jrpanel="${id}"]`); if (!panel) return 'no panel';
      const tas = panel.querySelectorAll('textarea[data-jf]'); if (!tas.length) return 'no textareas (locked?)';
      tas.forEach(t => { t.value = e[t.dataset.jf] || ''; t.dispatchEvent(new Event('input', { bubbles: true })); });
      tas[tas.length - 1].dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      return 'ok ' + tas.length;
    }, [id, e]);
  }
  async function serverVault() {
    const until = Date.now() + 15000; let last = null;
    while (Date.now() < until) {
      const st = await f.evaluate(() => hub.sync.state);
      const r = await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.journal.vault');
      last = r.body.item && r.body.item.value;
      if (st === 'synced' && last) return last;
      await sleep(400);
    }
    return last;
  }
  async function askChatByKey() {
    const r = await toolCall(L, 'eli', 'get_data', { app_id: 'f260', scope: 'person', key: 'f260.journal.vault' }, { message: 'show me my f260.journal.vault row' });
    return r;
  }

  // 2. two entries → small vault
  const w1 = [await writeEntry(0)]; await sleep(500); w1.push(await writeEntry(1)); await sleep(800);
  const v2 = await serverVault();
  const len2 = JSON.stringify(v2).length;
  const r2 = await askChatByKey();
  let fromTool = null; try { fromTool = JSON.parse(r2.toolResult.content); } catch {}
  step('vault with 2 entries (made by the F260 app)', { passTitle: title, writes: w1, serverVaultKeys: Object.keys(v2 || {}), serverVaultJsonChars: len2, chatOk: r2.ok, toolResultIsError: r2.toolResult && r2.toolResult.is_error, toolResultChars: r2.toolResult && r2.toolResult.content.length, toolResultHead: short(r2.toolResult && r2.toolResult.content, 220), toolResultHas: fromTool ? { v: fromTool.v, iv: !!fromTool.iv, ct: !!fromTool.ct, passSalt: !!(fromTool.pass && fromTool.pass.salt), passIter: fromTool.pass && fromTool.pass.iter, passIv: !!(fromTool.pass && fromTool.pass.iv), passWk: !!(fromTool.pass && fromTool.pass.wk) } : 'not JSON' });

  // 3. decrypt using ONLY the tool_result text the Worker sent upstream
  if (fromTool) {
    const t0 = Date.now(); const j = await decryptFrom(fromTool, PASS); const ms = Date.now() - t0;
    // bounded brute force from the tool_result alone: '1200'..'1299' in order
    const t1 = Date.now(); let found = null, tries = 0;
    for (let n = 1200; n < 1300 && !found; n++) { tries++; try { await decryptFrom(fromTool, String(n)); found = String(n); } catch {} }
    const per = (Date.now() - t1) / tries;
    step('offline decryption from the tool_result alone', { decryptOkWithPasscode: true, oneGuessMs: ms, recoveredEntryIds: Object.keys(j), recoveredFirstHighlight: j[Object.keys(j)[0]] && j[Object.keys(j)[0]].h, bruteForceRange: '1200-1299', found, tries, msPerGuess: Math.round(per), extrapolatedAll4DigitPinsMinutes: +(per * 10000 / 60000).toFixed(1) });
  }

  // 4. keep writing entries until chat stops returning the value (BIG_VALUE guard)
  let n = 2, lastLen = len2, lastRes = r2.toolResult.content, threshold = null;
  const sizes = [{ entries: 2, vaultChars: len2, returned: /"ct"/.test(r2.toolResult.content) }];
  while (n < Math.min(panelIds.length, 14)) {
    await writeEntry(n); n++; await sleep(700);
    const v = await serverVault(); lastLen = JSON.stringify(v).length;
    const r = await askChatByKey(); lastRes = r.toolResult.content;
    const returned = /"ct"/.test(lastRes);
    sizes.push({ entries: n, vaultChars: lastLen, returned, toolResult: returned ? `(full blob, ${lastRes.length} chars)` : lastRes });
    if (!returned) { threshold = n; break; }
  }
  step('size threshold (BIG_VALUE = 4000, chat.js:19)', { sizes, firstEntryCountWithheld: threshold });

  // 5. listing and set_data, re-checked
  const list = await toolCall(L, 'eli', 'get_data', { app_id: 'f260', scope: 'person' });
  const setV = await toolCall(L, 'eli', 'set_data', { app_id: 'f260', scope: 'person', key: 'f260.journal.vault', value: null });
  step('listing and set_data', { listingMentionsVault: /journal\.vault/.test(list.toolResult.content), listingKeys: (() => { try { return JSON.parse(list.toolResult.content).map(r => r.key); } catch { return list.toolResult.content; } })(), setDataResult: setV.toolResult.content, vaultStillOnServer: !!(await L.apiAs('eli', '/api/data/f260?scope=person&key=f260.journal.vault')).body.item?.value });

  // 6. another adult cannot reach Eli's vault through chat (person scope = the caller)
  const mae = await toolCall(L, 'christian', 'get_data', { app_id: 'f260', scope: 'person', key: 'f260.journal.vault' });
  step('another adult asks for the same key', { maeToolResult: mae.toolResult && mae.toolResult.content });
  console.log('\n' + phone.logs.filter(l => /error/i.test(l)).slice(0, 5).join('\n'));
  console.log('\nevidence:', save('verify-vault-readable-by-key-1.json', out));
} finally { await L.close(); }
