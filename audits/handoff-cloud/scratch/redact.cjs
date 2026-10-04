// Blank the throwaway local-test tokens and one-time codes in saved smoke-test outputs (they only ever opened a scratch
// D1, but tokens and codes do not belong in the repo). Usage: node redact.cjs <file>...
const fs = require('fs');
let total = 0;
for (const f of process.argv.slice(2)) {
  let t = fs.readFileSync(f, 'utf8'), n = 0;
  const sub = (re, rep) => { t = t.replace(re, (...m) => { n++; return typeof rep === 'function' ? rep(...m) : rep; }); };
  sub(/"(device_token|profile_token|token|session_token|undo)":"[^"]+"/g, (m, k) => `"${k}":"[redacted]"`);
  sub(/"(code|setup_code|reset_code|pairing_code)":"[^"]+"/g, (m, k) => `"${k}":"[redacted]"`);
  sub(/("(?:code|setup_code)":)(\d{4,8})\b/g, (m, k) => `${k}"[redacted]"`);
  fs.writeFileSync(f, t); total += n; console.log(f.split('/').slice(-4).join('/'), n);
}
console.log('redacted', total);
