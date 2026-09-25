// Phase 5 catalogue: every finding filed in Phases 2-4 in one JSON file, so the findings list and the plan can be
// checked for completeness. It reads the reports and writes JSON; it runs no app.
//   node audits/tools/phase5/catalog.mjs   → audits/evidence/p5/catalog.json (+ a count table on stdout)
// An item is a defect heading (#### P2-/P3-/P4-…) or a design item (UX/VIS/GAP/CONS/OK, as a heading or a bold lead,
// with or without a number). Each item keeps its source file and line, title, severity, kind, pointer target and
// the block's first lines. Positives (OK) are catalogued but are not findings to fix.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const A = p => path.join(ROOT, 'audits', p);
const FILES = ['02-shell.md', ...fs.readdirSync(A('03-apps')).filter(f => f.endsWith('.md')).map(f => '03-apps/' + f), '04-design-system.md'];
const SEV = /\b(critical|high|medium|low|info)\b/i;
const P2SEC = { 'Home and launcher': 'HOME', 'Profiles, kid mode, kiosk and admin': 'PROF', 'PIN, session and web security': 'SEC', Sync: 'SYNC', '24/7 stability': 'STAB', 'Hub chatbot': 'CHAT', 'Notifications, voice add, activity feed, PWA install': 'PWA', 'Shell visual fidelity': 'VIS' };
const ID = String.raw`(P[2-4]-[A-Z0-9]+(?:-[A-Z]+)?-\d+|(?:[A-Z]+-)?(?:UX|VIS|GAP|OK|CONS)(?:-[A-Z0-9]+)*-\d+)`;
const HEAD = new RegExp(String.raw`^#{3,4}\s+${ID}\b\s*[—:·-]?\s*(.*)$`);
const BOLD = new RegExp(String.raw`^\s*(?:[-*]\s+)?\*\*${ID}\b\s*[—:·.-]?\s*(.*)$`);
const ANON = /^\s*(?:[-*]\s+)?\*\*(UX|GAP|VIS)\s*\((critical|high|medium|low)\)\s*[:.]\s*(.*)$/;

const items = [];
for (const rel of FILES) {
  const lines = fs.readFileSync(A(rel), 'utf8').split(/\r?\n/);
  const area = rel.startsWith('03-apps/') ? rel.slice(8, -3) : rel.startsWith('02') ? 'shell' : 'system';
  let sec = '', cur = null, anonN = {};
  const close = () => { if (cur) { cur.block = cur.block.join('\n'); items.push(cur); cur = null; } };
  lines.forEach((ln, i) => {
    const h2 = ln.match(/^##\s+(.*)$/);
    if (h2) { close(); sec = h2[1].trim(); return; }
    let m = ln.match(HEAD) || ln.match(BOLD), id, title;
    if (m) { id = m[1]; title = m[2]; }
    else if ((m = ln.match(ANON))) {
      const code = rel.startsWith('02') ? (P2SEC[sec] || 'SHELL') : area.toUpperCase();
      const k = m[1] + '-' + code; anonN[k] = (anonN[k] || 0) + 1;
      id = `${m[1]}-${code}-a${anonN[k]}`; title = m[3] + ` (${m[2]})`;
    }
    if (id) {
      if (/^#{3,4}\s/.test(ln) || /^\s*(?:[-*]\s+)?\*\*/.test(ln)) {
        close();
        // In Phase 2 some design-item IDs are section-local (UX-01 in CHAT): qualify them.
        let qid = id;
        if (rel.startsWith('02') && /^(UX|GAP|OK|VIS)-\d+$/.test(id)) qid = id.replace(/^(\w+)-/, `$1-${P2SEC[sec] || 'SHELL'}-`);
        cur = { id: qid, srcId: id, heading: /^#{3,4}\s/.test(ln), file: 'audits/' + rel, line: i + 1, section: sec, area, title: title.replace(/\*\*/g, '').trim(), block: [ln] };
        return;
      }
    }
    if (cur) {
      if (/^#{2,4}\s/.test(ln)) { close(); return; }
      cur.block.push(ln);
    }
  });
  close();
}
// derive fields
for (const it of items) {
  const t = it.title + ' ' + it.block.split('\n').slice(0, 4).join(' ');
  it.kind = /^P[2-4]-/.test(it.id) ? 'defect' : it.id.match(/(UX|VIS|GAP|OK|CONS)/)[1];
  const sv = it.block.match(/\*\*Severity[:*\s]*\**\s*(critical|high|medium|low)/i) || it.title.match(/\((?:[^)]*?)(critical|high|medium|low)[^)]*\)/i) || t.match(SEV);
  it.severity = sv ? sv[1].toLowerCase() : null;
  const pt = t.match(/(?:pointer(?: to| →)?|Same defect as|→)\s*\**(P[2-4]-[A-Z0-9-]+-\d+)/i);
  it.pointerTo = /pointer|Same defect as/i.test(it.title + ' ' + it.block.split('\n').slice(0, 3).join(' ')) && pt ? pt[1] : null;
}
// de-duplicate: an ID can have its own heading block and also be re-mentioned as a bold lead in a summary, severity
// check or cross-reference list. Keep the heading block; otherwise the first bold lead.
const seen = new Map();
for (const it of items) { const o = seen.get(it.id); if (!o || (!o.heading && it.heading)) seen.set(it.id, { ...it, dups: o ? (o.dups || 0) + 1 : 0 }); else o.dups = (o.dups || 0) + 1; }
const out = [...seen.values()].sort((a, b) => a.file === b.file ? a.line - b.line : FILES.indexOf(a.file.slice(7)) - FILES.indexOf(b.file.slice(7)));
fs.mkdirSync(A('evidence/p5'), { recursive: true });
fs.writeFileSync(A('evidence/p5/catalog.json'), JSON.stringify(out, null, 1));
const tab = {};
for (const it of out) { const k = it.file.replace('audits/', '') + ' ' + it.kind; tab[k] = (tab[k] || 0) + 1; }
console.table(tab);
console.log(out.length, 'items;', out.filter(i => i.kind === 'defect' && !i.pointerTo).length, 'defect primaries,', out.filter(i => i.pointerTo).length, 'pointers');
