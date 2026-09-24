// Skeptic #1 (413-drops-whole-channel): at what size does F260's b64() — String.fromCharCode.apply(null, bytes),
// apps/f260.html:993 — throw in each engine? persistJournal() (apps/f260.html:1015-1024) swallows that error with .catch(() => {}).
//   node "audits/tools/phase2/SYNC/verify-413-drops-whole-channel-1-b64.mjs"
import { playwright } from '../../lib/local.mjs';
import fs from 'node:fs';
const pw = playwright();
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const sizes = [16384, 65535, 65536, 65537, 100000, 125000, 150000, 200000, 400000, 500000, 675000, 700000];
for (const [name, launch] of [['webkit', () => pw.webkit.launch()], ['chromium', () => pw.chromium.launch({ executablePath: CHROME })]]) {
  const b = await launch();
  const p = await (await b.newContext()).newPage();
  const res = await p.evaluate(sizes => {
    const b64 = a => btoa(String.fromCharCode.apply(null, new Uint8Array(a)));   // verbatim from apps/f260.html:993
    return sizes.map(n => { try { const s = b64(new Uint8Array(n).buffer); return [n, 'ok', s.length]; } catch (e) { return [n, e.name + ': ' + e.message]; } });
  }, sizes);
  console.log(name, b.version());
  for (const r of res) console.log('  ', r.join(' | '));
  await b.close();
}
// the largest byte count b64() accepts in each engine, and the vault it would make (the Worker refuses > 921600 chars)
for (const [name, launch] of [['webkit', () => pw.webkit.launch()], ['chromium', () => pw.chromium.launch({ executablePath: CHROME })]]) {
  const b = await launch();
  const p = await (await b.newContext()).newPage();
  const max = await p.evaluate(() => {
    const b64 = a => btoa(String.fromCharCode.apply(null, new Uint8Array(a)));
    const ok = n => { try { b64(new Uint8Array(n).buffer); return true; } catch { return false; } };
    let lo = 1000, hi = 2000000; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ok(m)) lo = m; else hi = m; } return lo;
  });
  const vaultChars = Math.ceil(max / 3) * 4 + 130;   // ct in base64 plus the blob's other fields (~130 chars: v, pass{salt,iter,iv,wk}, iv)
  console.log(`${name}: largest ciphertext b64() accepts = ${max} bytes → largest vault ≈ ${vaultChars} chars (${vaultChars > 921600 ? 'CAN' : 'cannot'} exceed the Worker's 921600); journal plaintext ≈ ${max - 16} chars`);
  await b.close();
}
