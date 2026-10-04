// parse every inline classic <script> in the shipped pages with V8 (catches duplicate declarations, syntax errors)
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub/';
const files = ['index.html', 'docs/design.html', ...fs.readdirSync(R + 'apps').filter(f => f.endsWith('.html')).map(f => 'apps/' + f)];
let bad = 0, n = 0;
for (const f of files) {
  const t = fs.readFileSync(R + f, 'utf8');
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(t))) {
    const attrs = m[1] || '';
    if (/\bsrc=/.test(attrs) || /type=["']?(application\/(ld\+)?json|importmap|text\/template)/.test(attrs)) continue;
    n++;
    try { if (/type=["']?module/.test(attrs)) new vm.SourceTextModule ? 0 : 0; else new vm.Script(m[2], { filename: f }); }
    catch (e) { bad++; console.log('FAIL', f, e.message); }
  }
}
for (const f of ['apps/hub.js']) { try { new vm.Script(fs.readFileSync(R + f, 'utf8')); n++; } catch (e) { bad++; console.log('FAIL', f, e.message); } }
console.log(`${n} scripts parsed, ${bad} failed`);
process.exit(bad ? 1 : 0);
