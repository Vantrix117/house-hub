// Phase 5: builds audits/05-findings.md from
//   audits/evidence/p5/catalog.json   every finding of Phases 2-4 (catalog.mjs)
//   audits/evidence/p5/registers.json the confirmed-defect registers (authoritative severities)
//   audits/evidence/p5/remedies.json  Phase 3 improvements and Phase 4 gap rows that name findings (remedies.mjs)
//   fixes-*.mjs                       the Phase 5 fix, effort and batch for every finding
//   plan-batches.mjs                  the batches, their files, backups and checks
//   audits/evidence/p5/ux-verify/verdicts.json  step 3: the two-skeptic verdicts on the high and medium UX/VIS/CONS/GAP
//                                     items (ux-verify/verdicts.mjs); a verdict's severity wins, a refuted item leaves the list
//   plan-batches.mjs WORK and CUT     step 4: the work the household's answers add (the Kitchen device), which no finding
//                                     filed, and the items they cut (listed under "What this report does not list")
// It fails (exit 1) if a catalogued finding has no fix, a fix names an unknown ID, a cut ID is not catalogued, or work
// names an unknown batch.
//   node audits/tools/phase5/build-findings.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BATCHES, APPS, APP_TESTS, APP_ORDER, WORK, CUT } from './plan-batches.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const A = p => path.join(ROOT, 'audits', p);
const cat = JSON.parse(fs.readFileSync(A('evidence/p5/catalog.json'), 'utf8'));
const reg = JSON.parse(fs.readFileSync(A('evidence/p5/registers.json'), 'utf8'));
const rem = JSON.parse(fs.readFileSync(A('evidence/p5/remedies.json'), 'utf8'));
const VP = A('evidence/p5/ux-verify/verdicts.json');
const VER = fs.existsSync(VP) ? Object.fromEntries(JSON.parse(fs.readFileSync(VP, 'utf8')).results.map(r => [r.id, r])) : {};
const refuted = cat.filter(i => VER[i.id] && VER[i.id].final.holds === 'refuted');
const FIX = {};
for (const f of fs.readdirSync(HERE).filter(f => /^fixes-.*\.mjs$/.test(f))) Object.assign(FIX, (await import(pathToFileURL(path.join(HERE, f)).href)).default);

const cutItems = cat.filter(i => CUT[i.id]);
// where each cut is recorded: the line of 05-decisions.md that names it, found by its text so an edit above never stales it
const DEC = fs.readFileSync(A('05-decisions.md'), 'utf8').split('\n');
const cutAt = id => { const k = DEC.findIndex(l => l.includes(CUT[id]) && l.includes(id)); return k < 0 ? null : `audits/05-decisions.md:${k + 1}`; };
const items = cat.filter(i => i.kind !== 'OK' && !refuted.includes(i) && !CUT[i.id]);
const ids = new Set(items.map(i => i.id));
const missing = items.filter(i => !FIX[i.id]).map(i => i.id);
const unknown = Object.keys(FIX).filter(k => !ids.has(k) && !refuted.some(i => i.id === k));
const cutBad = Object.keys(CUT).filter(k => !cutItems.some(i => i.id === k) || !cutAt(k)).concat(Object.keys(CUT).filter(k => FIX[k]).map(k => k + ' (still has a fix)'));
const workBad = WORK.filter(w => !BATCHES[w.batch] || ids.has(w.id)).map(w => w.id + '@' + w.batch);
if (missing.length || unknown.length || cutBad.length || workBad.length) { console.error('missing fixes:', missing.join(' ') || '-'); console.error('unknown ids:', unknown.join(' ') || '-'); console.error('bad cuts:', cutBad.join(' ') || '-'); console.error('bad work:', workBad.join(' ') || '-'); process.exit(1); }

// ── derive per-finding fields ──
const TYPE = { defect: 'bug', UX: 'usability', VIS: 'visual', GAP: 'feature gap', CONS: 'visual (consistency)' };
const W = { critical: 8, high: 4, medium: 2, low: 1, info: 0 };
const clean = s => s.replace(/\r/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const firstSentences = (s, n = 320) => { s = clean(s); if (s.length <= n) return s; const cut = s.slice(0, n); const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; ')); return (i > 120 ? cut.slice(0, i + 1) : cut.replace(/\s\S*$/, '') + ' …'); };
// A labelled field ("**What happens now.**", "- **Why it matters:**"): its inline text, or the bullets / paragraph under it.
function field(b, re, n) {
  const L = b.split('\n');
  for (let k = 0; k < L.length; k++) {
    const m = L[k].match(/^(\s*)(?:[-*]\s+)?\*\*([^*]+?)[.:]?\*\*[.:]?\s*(.*)$/);
    if (!m || !re.test(m[2])) continue;
    let text = m[3], ind = m[1].length;
    if (clean(text).length < 25) {
      for (let j = k + 1; j < L.length; j++) {
        const l = L[j]; if (!l.trim()) { if (text.trim()) break; continue; }
        const li = l.match(/^\s*/)[0].length;
        if (li <= ind && /^\s*(?:[-*]\s+)?\*\*/.test(l)) break;
        if (li <= ind && /^\s*#/.test(l)) break;
        text += ' ' + l.replace(/^\s*[-*]\s+/, '');
        if (clean(text).length > n * 1.5) break;
      }
    }
    const t = clean(text); if (t.length > 20) return firstSentences(t, n);
  }
  return null;
}
const LC = {};
const lineCount = f => { if (!(f in LC)) { try { LC[f] = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').length; } catch { LC[f] = 0; } } return LC[f]; };
const impBy = {}; for (const x of rem.improvements) for (const id of x.ids) (impBy[id] = impBy[id] || []).push(x);
const gapBy = {}; for (const g of rem.gapRows) for (const id of g.ids) (gapBy[id] = gapBy[id] || []).push(g);
const F = items.map(i => {
  const [batch, effort, fix, why0, verifyAs] = FIX[i.id];   // verifyAs: when the fix changes what "fixed" means (P2-PROF-09)
  const b = i.block.replace(/\r/g, '');
  const kindWord = /security/i.test(i.title + ' ' + b.slice(0, 600)) && i.kind === 'defect' ? 'bug (security)' : /\bperf\b/i.test(i.title + ' ' + b.slice(0, 300)) && i.kind === 'defect' ? 'bug (perf)' : TYPE[i.kind];
  const v = VER[i.id];
  const sev = v ? v.final.severity : (reg[i.id] && reg[i.id].sev) || i.severity || 'low';
  // step 3 record: "was medium; s1 medium, s2 low; tie-break low"
  const vr = x => x ? (x.holds === 'refuted' ? 'refuted' : x.severity + (x.holds === 'partly' ? ' (partly)' : '')) : 'no verdict';
  const corr = v && [v.tie, v.s1, v.s2].find(x => x && x.correction && x.holds !== 'refuted');
  const ver = v ? `was ${v.rated}; skeptics ${vr(v.s1)} and ${vr(v.s2)}${v.tie ? `; tie-break ${vr(v.tie)}` : ''}.${corr ? ' Correction: ' + firstSentences(corr.correction, 300) : ''}` : null;
  // design items rarely label the field: their first detail line is what happens now
  const firstBody = () => {
    const ls = b.split('\n').slice(1).map(s => s.replace(/^\s*[-*]\s+/, ''));
    const k = ls.findIndex(s => clean(s).length > 30 && !/^\*\*(Why|Severity|Evidence|Rating|Owner)/i.test(s.trim()));
    if (k < 0) return null;
    let t = ls[k]; for (let j = k + 1; /:\s*$/.test(clean(t)) && j < ls.length && j < k + 4; j++) t += ' ' + ls[j];   // "measures:" → its bullets
    return firstSentences(t, 320);
  };
  const now = field(b, /What happens/i, 340) || (i.kind !== 'defect' && firstBody()) || clean(i.title);
  const why = field(b, /Why it matters/i, 280) || why0 || null;
  // code cites: repo files only (the sibling template gets its repo prefix), and only lines that exist
  const code = [...new Set(b.match(/(?<![\w/.-])(?:apps|worker|scripts|index\.html|sw\.js|manifest\.json|apps\.json)[\w./-]*:\d+(?:-\d+)?/g) || [])]
    .map(c => c.startsWith('scripts/template.html') ? '../dollywood-build-project/' + c : c)
    .filter(c => { const [f, l] = c.split(':'); const n = lineCount(f); return n && +l.split('-')[0] <= n && !/\.md$/.test(f); }).slice(0, 4);
  const shots = [...new Set((b.match(/audits\/(?:screens|evidence)\/[\w./-]+\.png/g) || []))].slice(0, 2);
  // reproduction scripts: every phase 2-4 script the entry names that exists, skeptics' and critics' first
  const scripts = [...new Set(b.match(/audits\/tools\/phase[2-4]\/[\w./-]+\.mjs/g) || [])].filter(s => fs.existsSync(path.join(ROOT, s)))
    .sort((x, y) => (/verify|critic/.test(y) ? 1 : 0) - (/verify|critic/.test(x) ? 1 : 0)).slice(0, 3);
  const imps = (impBy[i.id] || []).slice(0, 2).map(x => x.id), gaps = (gapBy[i.id] || []).slice(0, 2).map(g => g.row);
  // platform findings (Phase 2) and system findings (Phase 4): name the apps the title mentions
  const NAMES = [['F260', /F260/], ['Prayer', /\bPrayer\b|prayer/], ['Larder', /Larder|leftover/i], ['Tally', /Tally/], ['Timer', /\btimer\b/i], ['Kid Verse', /Kid Verse/], ['Verses', /(?<!Kid )\bVerses\b/], ['build guide', /build guide/i], ['park map', /park map|park day/i], ['TV', /\bTV\b|kiosk/]];
  const hits = NAMES.filter(([, re]) => re.test(i.title)).map(([n]) => n);
  const area = i.area === 'shell' ? 'shell / platform' + (hits.length ? ` (${hits.join(', ')})` : '') : i.area === 'system' ? 'design system' + (hits.length ? ` (${hits.join(', ')})` : ', all areas') : i.area;
  const rigArea = i.area === 'shell' ? 'shell, tv' : i.area === 'system' ? 'every area' : i.area;
  // the title without the rating the report appended or prefixed (the entry carries severity and type)
  const title = clean(i.title).replace(/^\((?:investigator only|medium|low|high|critical)[^)]*\)\s*[—-]\s*/i, '').replace(/^(critical|high|medium|low|info)\b[^.]*?[.:]\s*/i, m => /→|stays|raised|new|Severity/i.test(m) ? m : '')
    .split(/\s+\((?:investigator rating: |amended |investigator only[^)]*; )?(?:critical|high|medium|low|info)\b/i)[0]
    .split(/\s+—\s+(?:bug|security|perf)\b/i)[0].replace(/\s*\((?:bug|security|perf)[^)]*\)\s*$/i, '').replace(/\s*\((?:gap|ux)[^)]*\)\.?$/i, '').replace(/\.$/, '').trim();
  const title2 = /-a\d+$/.test(i.id) || /^(moved to|Pointer)/i.test(title) ? (s => s[0].toUpperCase() + s.slice(1))(title.split(/\.\s/)[0]) : title;
  return { ...i, title: title2, area, rigArea, batch, effort, fix, why, verifyAs, sev, ver, type: kindWord, now, code, shots, scripts, imps, gaps, pointer: /^Pointer to /.test(fix) };
});

// ── app batch order: daily use x gap ──
const appRows = Object.entries(APPS).map(([id, a]) => {
  const mine = F.filter(f => f.batch === 'A:' + id && !f.pointer);
  const gap = mine.reduce((s, f) => s + W[f.sev], 0);
  return { id, ...a, n: mine.length, gap, score: +(a.use * gap).toFixed(1) };
}).sort((x, y) => APP_ORDER.indexOf(x.id) - APP_ORDER.indexOf(y.id));
const byScore = [...appRows].sort((x, y) => y.score - x.score).map(r => r.id);
const orderDiffers = byScore.join() !== APP_ORDER.join();
const appNo = {}; appRows.forEach((r, k) => { appNo[r.id] = String(3 + k); });
const bno = b => b.startsWith('A:') ? appNo[b.slice(2)] : b;
for (const f of F) f.bn = bno(f.batch);
const ORDER = ['0a', '0b', '0c', '0d', '0e', '0f', '0g', '0h', '0i', '1', '2a', '2b', '2c', ...appRows.map(r => appNo[r.id])];
const btitle = n => BATCHES[n] ? BATCHES[n].title : (() => { const r = appRows.find(r => appNo[r.id] === n); return r.name; })();
const bmeta = n => BATCHES[n] || (() => { const r = appRows.find(r => appNo[r.id] === n); return { title: r.name, files: r.files, effort: r.n > 25 ? 'L' : 'M', needs: ['1', '2a'], why: `${r.name} is used ${r.useWhy}; ${r.n} open findings remain after the critical batches.`, verify: ['each entry\'s reproduction script', `capture rig: node audits/tools/capture.mjs --area ${r.id} --out audits/screens-after/… (one folder per batch), then pxdiff against audits/screens`, `the measurement rig for this area: node audits/tools/phase4/measure.mjs --area ${r.id} --run themes (then aggregate.mjs) and compare with audits/evidence/p4/measure/`, APP_TESTS[r.id], 'rescore this app\'s rubric row (the Phase 4 scorecard method) and record the change'] }; })();

// ── counts ──
const count = (arr, key) => arr.reduce((m, f) => (m[f[key]] = (m[f[key]] || 0) + 1, m), {});
const prim = F.filter(f => !f.pointer);
const sevOrder = ['critical', 'high', 'medium', 'low', 'info'];
const bySev = count(prim, 'sev'), byType = count(prim, 'type');
const sevCell = arr => sevOrder.map(s => arr.filter(f => f.sev === s).length).join(' / ');
const crit = prim.filter(f => f.sev === 'critical');
const critOutside = crit.filter(f => !f.bn.startsWith('0'));

// ── render ──
const L = [];
const P = s => L.push(s);
P('# House Hub audit, Phase 5: findings, plan and design preview');
P('');
P('| | |');
P('|---|---|');
P('| **App code audited** | `fe6041d`, unchanged since the Phase 0 baseline. Phase 5 changed no app code; it wrote only under `audits/`. |');
P('| **Date** | 2026-09-25; rebuilt 2026-09-26 with the household\'s answers (`audits/05-decisions.md`), the step 3 severities and the step 4 plan changes (the Kitchen device, the cut) |');
P('| **Inputs** | Every file in `audits/`: the constitution (`audits/HUB-AUDIT-PROMPT.md`), `00-inventory.md`, `01-capture.md`, `01-leads.md`, `02-shell.md`, `03-apps.md` and `03-apps/*.md`, `04-design-system.md`, and the tools and evidence behind them. |');
P('| **Outputs** | This file; `audits/design-preview.html` (the design preview) and its captures in `audits/screens-preview/` (contact sheets in `audits/screens-preview/_sheets/`). |');
P('| **Reproduce** | `node audits/tools/phase5/catalog.mjs` (every finding of Phases 2-4 → `audits/evidence/p5/catalog.json`), `node audits/tools/phase5/remedies.mjs` (the remedies Phases 3-4 proposed), `node audits/tools/phase5/build-findings.mjs` (this file, from `fixes-*.mjs` and `plan-batches.mjs`; it fails if any finding has no fix). |');
P('');
P('## How to read this report');
P('');
P('- **One entry per finding.** Every finding Phases 2-4 filed is here once, with its original ID: the adversarially verified defects (`P2-*`, `P3-*`, `P4-*`) and the usability, visual, consistency and gap items (`UX-*`, `VIS-*`, `CONS-*`, `GAP-*`). Positive items (`OK-*`), refuted claims and unresolved questions are not findings; they are counted under "What this report does not list".');
P('- **Entry fields**, as the constitution asks: ID · Title · Area · Type · Severity · Evidence · What happens now · Why it matters · Proposed fix · Effort · How it will be verified. "Batch" says which Phase 6 commit carries the fix.');
P('- **Type.** Defects are *bug* (with *security* or *perf* when the finding was filed as such). `UX-*` items are *usability*, `VIS-*` *visual*, `CONS-*` *visual (consistency)*, `GAP-*` *feature gap*. The constitution\'s fifth type, *improvement*, is the Phase 3 improvement tables: each fix below names the improvement that proposed it (`IMP-<APP>-P|F|I<rank>`), and the 15 improvements that fix no finding are listed as their own entries at the end of their app batch.');
P('- **Severity.** Defects carry the severity their report confirmed (the registers in `audits/02-shell.md:117-217`, `audits/03-apps.md` and `audits/04-design-system.md` are authoritative), under the rule in `audits/02-shell.md:25-37`: critical = household data lost or silently overwritten through the shipped UI, an account or private content exposed, or an app unusable on the iPad, iPhone or TV. ' + (Object.keys(VER).length ? `Usability, visual, consistency and gap items that their investigator rated high or medium (${Object.keys(VER).length}) were each checked by two independent skeptics, with a tie-breaker where they disagreed (step 3, \`audits/evidence/p5/ux-verify/verdicts.md\`). The severity is the verdict's, and the entry's "Verified" line gives the earlier rating and each vote; ${refuted.length} refuted items left the list. Items rated low or info keep their investigator's rating, as the household decided (\`audits/05-decisions.md\`, "Other items").` : 'Usability, visual and gap items carry the rating their investigator gave; those were not adversarially verified.'));
P(`- **Household work** (${WORK.map(w => w.id).join(', ')}): work the household\'s answers add that no finding filed. Each opens its batch, with the same fields less Severity, and is not in the finding counts.`);
P('- **Pointers.** A finding filed twice keeps both IDs; the pointer\'s fix says "Pointer to <primary>" and it is not counted again.');
P('- **Evidence** gives the report entry (`audits/…md:line`, which holds the full evidence, reproduction and verification record), then up to four code lines and two screenshots taken from that entry.');
P('- **"How it will be verified"** names the entry\'s own reproduction scripts, which Phase 6 reruns after the fix: the defect\'s printed observation must flip. The batch adds its capture-rig recapture, measurement rerun and repo tests (section "The plan").');
P('');
P('## Summary');
P('');
P(`- **${F.length} findings** (${prim.length} counted once, ${F.length - prim.length} pointers): ${sevOrder.map(s => `${bySev[s] || 0} ${s}`).join(', ')}. By type: ${Object.entries(byType).map(([k, v]) => `${v} ${k}`).join(', ')}.`);
P(`- **Every critical defect is pulled forward.** The ${crit.length} critical findings sit in the nine 0x batches, ahead of the design work${critOutside.length ? `, except ${critOutside.map(f => f.id).join(', ')}` : ''}. Most share a few root causes in the SDK: writes before the app\'s own first load (0b), queued writes dropped or stranded (0c), and whole-map rows under last-write-wins (0e, 0f, 0g).`);
P('- **Then the design system (batch 1)**: the Phase 4 token proposal (`audits/tools/phase4/tokens/proposed-tokens.css`, verified over six rounds: 0 failing pairs, 26/26 planted faults caught, 17 minor issues open), with the shared components every app needs (undo toast, confirm sheet, loading state, pressable, focus ring). It closes most visual and consistency items at once.');
P(`- **Then the shell (2a-2c) and one app per batch** (3-11), in the order the household confirmed (\`audits/05-decisions.md\`, "App batch order"): ${appRows.map(r => `${appNo[r.id]} ${r.name}`).join(', ')}.`);
P('- **The design preview** (`audits/design-preview.html`) renders the proposed token set live: the house pastels with their computed contrast in light and dark, the type scale, glass over busy content, tiles at phone and iPad density, the household\'s accents side by side, and a before/after of Prayer, the most-used app. Its captures are in `audits/screens-preview/`.');
P('- **The household has answered every decision** (D1-D18 from Phase 4, P5-D1-P5-D9 below; `audits/05-decisions.md`, 2026-09-25, and admin-assigned colours, 2026-09-26). Where an answer differs from a recommendation, the answer wins and this plan follows it: the D3 colour set as the starting colours with the admin free to assign any of the 18 families, guests sky by default (D4), nine separate app hues (D5), four glass levels with Frosted the default (D8), the TV\'s 10-foot scale on in 2c (D16), and the Kitchen device in place of an idle return (P5-D5).');
P(`- **The Kitchen device** (P5-D5 as answered) is new work: ${WORK.map(w => `${w.id} in batch ${w.batch}`).join(', ')}. It closes P2-PROF-09. Three points the answer left open are settled in the plan and go to the owner with the preview (\`audits/05-decisions.md\`, "Plan notes from step 4"): widening the profile kinds needs a rebuild of the \`profiles\` table, the plan\'s one non-additive schema step (\`worker/schema.sql:9\`); Timer and Tally store per person today, so the kitchen keeps its own Timer and Tally rows until batch 6; and the face sheet for finishing a food or adding a photo shows the adults only, while Prayed shows everyone.`);
P(`- **Cut by the household:** ${Object.keys(CUT).join(', ')} (\`audits/05-decisions.md\`, "Features kept or cut"). It is not planned.`);
P('- **The preview is approved** (2026-09-26), with one change: Forest\'s text is gold, token revision 6e (`audits/05-decisions.md`, "Preview approved"). Phase 6 begins with batch 0a. The owner\'s device checks (item 6 of "Before Phase 6 can start") are still to do; they need no batch.');
P('');
P('## The plan');
P('');
P('One batch per commit (constitution). Critical defects are pulled forward into the 0x batches; then batch 1 = design tokens, design.css and shared components; batch 2 = the hub shell (split into the shell UI, the Worker, and the TV board); then one app per batch.');
P('');
P('| Order | Batch | What | Findings (crit / high / med / low / info) | Effort | Needs |');
P('|---|---|---|---|---|---|');
const workIn = n => WORK.filter(w => w.batch === n);
ORDER.forEach((n, k) => { const m = bmeta(n); const mine = prim.filter(f => f.bn === n); const w = workIn(n); P(`| ${k + 1} | **${n}** | ${btitle(n)} | ${mine.length} (${sevCell(mine)})${w.length ? ' + ' + w.map(x => x.id).join(', ') : ''} | ${m.effort} | ${(m.needs || []).join(', ') || '—'} |`); });
P('');
P('**Why the app batches are in this order.** No app has usage data (every Phase 3 report says so), so daily use is estimated from each report\'s jobs table (§1): people × sessions a day. Gap is the weight of the app\'s open findings after the critical batches (critical 8, high 4, medium 2, low 1). The household confirmed this order (`audits/05-decisions.md`, "App batch order"), and the plan keeps it' + (orderDiffers ? `; with the step 3 severities the scores alone would give ${byScore.map(id => APPS[id].name).join(' → ')}.` : '; the scores with the step 3 severities give the same order.'));
P('');
P('| Batch | App | Use (sessions/day) | Basis | Open findings | Gap weight | Use × gap |');
P('|---|---|---|---|---|---|---|');
for (const r of appRows) P(`| ${appNo[r.id]} | ${r.name} | ${r.use} | ${r.useWhy} | ${r.n} | ${r.gap} | ${r.score} |`);
P('');
P('### Batch details');
P('');
for (const n of ORDER) {
  const m = bmeta(n);
  P(`#### Batch ${n} — ${btitle(n)}`);
  P('');
  P(`- **Why now.** ${m.why}`);
  if (workIn(n).length) P(`- **Household work.** ${workIn(n).map(w => w.id).join(', ')} (first under this batch in "Findings, by batch").`);
  P(`- **Files.** ${m.files}`);
  if (m.needs && m.needs.length) P(`- **Needs first.** ${m.needs.join(', ')}.`);
  if (m.backup) P(`- **Backup.** ${m.backup}`);
  P(`- **Verification.** ${m.verify.join('; ')}. Name anything not verified; a visual finding is marked FIXED only with an after-screenshot (constitution, Phase 6).`);
  P('');
}
P('### Rules that hold in every batch');
P('');
P('- **Backups and migrations.** Before any batch that changes stored data shape or schema (0b, 0c, 0d, 0e, 0f, 0g, 1), export the production D1 (`npx wrangler d1 export house-hub --remote --output <file>`, pre-approved by the household), check the file and keep it local and git-ignored. Migrations are additive (`worker/migrations/`, `schema.sql` kept in sync), with one exception: KITCHEN-1 rebuilds `profiles` to widen its kind CHECK, verified row for row against the export. Row reshaping (per-item rows in 0e-0g) is done by the client on first open after the fix, and the old rows stay readable until every device has moved.');
P('- **Protected files.** `apps/prayer.html` and `apps/f260.html` keep their layouts and element ids; their fixes are data code, copy and token restyling (CLAUDE.md). The Dollywood pair is changed only in `../dollywood-build-project/scripts/template.html`, rebuilt, checked with `verify.py`, then exported. No build step, bundler or framework.');
P('- **After each batch** (constitution, Phase 6): rerun the capture rig for every affected screen into an after-run folder (`audits/screens-after/…`, git-ignored like the baseline) and compare with the Phase 1 baseline (`audits/tools/lib/pxdiff.mjs`); rescore the rubric for what changed; rerun the repo tests; update this file\'s entries with FIXED / PARTIAL / DEFERRED / NEEDS DEVICE CHECK and the commit hash.');
P('- **Declined features** stay out: no kid routines/stars app and no shared grocery list; the Kid Verse and Tally fixes add no reward or routine system, and the Larder fixes do not make it a shopping list.');
P('');
P('## Decisions for the household');
P('');
P('**All answered.** The owner answered D1-D18 (`audits/04-design-system.md`, "Decisions for the household") and the nine below on 2026-09-25, and amended D3 and D4 on 2026-09-26 (the admin assigns every profile\'s colour). The answers, and what each changes in the plan, are in `audits/05-decisions.md`; they override this report\'s recommendations. The rebuilt design preview shows the colour, type and glass answers.');
P('');
P('| # | Decision | Recommendation | Alternative | Answer |');
P('|---|---|---|---|---|');
const D5 = [
  ['P5-D1', 'Base of the token proposal. The judges\' totals were migration 142, fidelity 140, access 133; because of an orchestration error the synthesis was built on fidelity with migration\'s compatibility layer grafted on (`audits/04-design-system.md`, "How the set was assembled").', 'Keep the synthesis as built: it already carries every migration strength the judges named, and it is the version verified over six rounds.', 'Rebuild on the migration proposal (then re-verify from round 1).'],
  ['P5-D2', 'Kids in the Larder (P3-LEFTOVERS-13, UX-LEFTOVERS-2).', 'A read-only picture view for kids (food cards with art and freshness colour, no ✓, no add bar).', 'Hide the Larder from kids (add a visibleTo without ezra and kiara).'],
  ['P5-D3', 'Chat writes (GAP-CHAT-02, P2-CHAT-01).', 'Act at once with an Undo on the chip for 30 s (as iOS does).', 'Confirm every write before it happens.'],
  ['P5-D4', 'How a reset PIN is reclaimed (P2-PROF-04).', 'The admin\'s Reset shows a one-time code, valid 24 h, that the person enters before choosing a new PIN.', 'The admin sets a temporary PIN that must be changed on first use.'],
  ['P5-D5', 'Idle return on the shared Kitchen iPad (P2-PROF-09).', 'Back to the picker after 10 minutes without a touch; the TV is exempt.', '30 minutes, or off.'],
  ['P5-D6', 'Tally\'s Reset (UX-TALLY-1).', 'Undo toast, no confirm; a smaller ↺ away from +.', 'A confirm sheet.'],
  ['P5-D7', 'Notifications for kids (P2-PROF-16).', 'Off: kids cannot subscribe.', 'Allowed, for the Kid Verse reminder only.'],
  ['P5-D8', 'Guests\' rights (P3-DOLLYWOOD-LIVE-02, UX-KIDVERSE-3, PWA-UX-2).', 'Guests use the apps but cannot switch kids\' beacons, step the family week or receive household pushes.', 'Treat guests as adults everywhere.'],
  ['P5-D9', 'A "Timer done" alert on a locked phone (PWA-GAP-1).', 'A server-scheduled push at endAt (a Worker alarm); the one new moving part in the plan.', 'Keep local-only alerts and say so in the Timer.'],
];
const ANS = { 'P5-D1': 'Keep the synthesis', 'P5-D2': 'Read-only picture view; the server refuses kid writes', 'P5-D3': 'Act at once, Undo for 30 s', 'P5-D4': 'One-time code, 24 h', 'P5-D5': '**Replaced:** a shared Kitchen mode for that iPad with no personal sign-ins (KITCHEN-1, KITCHEN-2)', 'P5-D6': 'Undo toast', 'P5-D7': 'Off', 'P5-D8': 'Apps, not household', 'P5-D9': 'Server push at endAt' };
for (const d of D5) P(`| ${d[0]} | ${d[1]} | ${d[2]} | ${d[3]} | ${ANS[d[0]]} |`);
P('');
P('## Findings, by batch');
P('');
const esc = s => s.replace(/\|/g, '\\|');
for (const n of ORDER) {
  const mine = F.filter(f => f.bn === n).sort((a, b) => (a.pointer - b.pointer) || (sevOrder.indexOf(a.sev) - sevOrder.indexOf(b.sev)) || a.id.localeCompare(b.id, 'en', { numeric: true }));
  P(`### Batch ${n} — ${btitle(n)} (${mine.length}${workIn(n).length ? ' + ' + workIn(n).length + ' household work' : ''})`);
  P('');
  for (const w of workIn(n)) {
    P(`#### ${w.id} — ${esc(w.title)}`);
    P('');
    P(`- **Area** shell / platform (Kitchen device) · **Type** household work (P5-D5 as answered) · **Effort** ${w.effort} · **Batch** ${n}`);
    P(`- **Evidence.** \`${w.src}\`; ${w.code.map(c => '`' + c + '`').join(', ')}`);
    P(`- **What happens now.** ${w.now}`);
    P(`- **Why it matters.** ${w.why}`);
    P('- **Proposed fix.**');
    for (const x of w.fix) P(`  - ${x}`);
    P(`- **How it will be verified.** ${w.verify.join('; ')}; plus batch ${n}\'s checks.`);
    P('');
  }
  for (const f of mine) {
    P(`#### ${f.id} — ${esc(f.title)}`);
    P('');
    P(`- **Area** ${f.area} · **Type** ${f.type} · **Severity** ${f.sev}${f.pointer ? ' (pointer)' : ''} · **Effort** ${f.effort} · **Batch** ${f.bn}`);
    if (f.ver) P(`- **Verified (step 3).** ${f.ver}`);
    P(`- **Evidence.** \`${f.file}:${f.line}\`${f.code.length ? '; ' + f.code.map(c => '`' + c + '`').join(', ') : ''}${f.shots.length ? '; ' + f.shots.map(c => '`' + c + '`').join(', ') : ''}`);
    if (!f.pointer) P(`- **What happens now.** ${f.now}`);
    if (!f.pointer) P(`- **Why it matters.** ${f.why || bmeta(n).why}`);
    P(`- **Proposed fix.** ${f.fix}${f.imps.length ? ` (Phase 3: ${f.imps.join(', ')})` : ''}${f.gaps.length ? ` (Phase 4 gap row ${f.gaps.join(', ')})` : ''}`);
    if (!f.pointer && f.verifyAs) P(`- **How it will be verified.** ${f.verifyAs}; plus batch ${n}'s checks.`);
    else if (!f.pointer) P(`- **How it will be verified.** ${f.scripts.length ? 'Rerun ' + f.scripts.map(s => '`node "' + s + '"`').join(', ') + ' — the defect must no longer reproduce; ' : ''}${f.type.startsWith('bug') ? '' : 'recapture its screens (' + (f.shots.length ? 'as cited above' : `capture area ${f.rigArea}`) + ') and compare; '}plus batch ${n}'s checks.`);
    P('');
  }
  // standalone improvements for app batches
  const appId = Object.keys(appNo).find(k => appNo[k] === n);
  if (appId) {
    const lone = rem.improvements.filter(x => x.app === appId && !x.ids.length);
    if (lone.length) {
      P(`#### Improvements with no finding (${appId})`);
      P('');
      P('These are Phase 3 improvements that fix no filed finding (type *improvement*; delight 1-5, effort S/M/L as that report rated them). They are optional; Phase 6 carries them only if the household wants them.');
      P('');
      P('| ID | Improvement | Kind | Delight | Effort | Source |');
      P('|---|---|---|---|---|---|');
      for (const x of lone) P(`| ${x.id} | ${esc(clean(x.text))} | ${x.kind} | ${x.delight} | ${x.effort} | \`${x.src}\` |`);
      P('');
    }
  }
}
P('## The design preview');
P('');
P('`audits/design-preview.html` renders the Phase 4 proposal (`audits/tools/phase4/tokens/proposed-tokens.css`) as the constitution asks. Open it from the repo root with any static server (the project\'s `.claude/launch.json` "hub" config serves it at `/audits/design-preview.html`); `?section=<id>` shows one section.');
P('');
P('| Section | What it shows |');
P('|---|---|');
P('| `palette` | The eight house pastels plus Graphite and the three semantic families, light and dark: ink on fill, the label on the strong fill, ink on the card, the graphic mark and the tile glyph, each with its computed ratio; and the constitution\'s eight starting pairs from their literal hex. |');
P('| `neutrals` | Page, card, well, text, secondary, tertiary and field border for Hearth, Parchment, Frost, Midnight, Forest and the proposed Graphite. |');
P('| `type` | The Dynamic Type roles, their sizes for the phone, the iPad tier, kid mode, the TV today and the TV 10-foot scale, the rounded numerals and the glance roles. |');
P('| `glass` | The four glass levels of D8 (Clear, Current, Frosted the default, Solid), each a stage that loads this page in `?stage=glass` mode so the real `:root[data-glass]` rules paint it, light and dark: a bar, a pill, a floating button, a sheet and a tab bar over busy art, with the outline halo on Clear and Current. |');
P('| `tiles` | App tiles at iPhone density (60 px, 4 columns) and iPad density (76 px, 6 columns), light and dark, each app in its own hue (D5), and the tiles on all six palettes. |');
P('| `accents` | The starting colours of D3 (the household, the TV) and a guest in sky (D4) as avatar ring, selected chip, primary button and progress, light and dark, plus a colour-vision-deficiency simulation. The admin can give any profile any of the 18 families (2026-09-26). |');
P('| `prayer` | Prayer → Today before (the Phase 1 capture) and after (the same layout, order and controls on the proposed tokens, as CLAUDE.md requires for Prayer), light and dark. Prayer is the most-used app by the estimate above. |');
P('');
{
  const pc = JSON.parse(fs.readFileSync(A('evidence/p5/preview-check.json'), 'utf8')).runs;
  const pairs = [...new Set(pc.map(r => r.pass + r.fail.length))].join('/'), bad = pc.filter(r => r.fail.length || r.hscroll || r.errors.length || r.mapIssues.length || r.stageIssues.length).length;
  P(`- **Verified.** Every ratio on the page is computed from the rendered colours (WCAG 2), not typed in. \`node audits/tools/phase5/preview-check.mjs\` loads the page in the audit\'s WebKit and in Chromium at 390, 820 and 1440 px in light and dark and also checks the people, guest and app colour maps and the glass stages: ${bad ? `${bad} of ${pc.length} runs report a problem` : `${pairs} of ${pairs} pairs pass their threshold in all ${pc.length} runs, with no map or stage issue, no horizontal scroll and no page error`} (\`audits/evidence/p5/preview-check.json\`).`);
}
P('- **Captured with the rig.** `node audits/tools/capture.mjs --area preview --out audits/screens-preview` took 70 captures (7 sections × 5 devices × light and dark, whole page), 0 failed; `audits/screens-preview/manifest.json` lists them with their SHA-256. Contact sheets (JPEG, committed): `audits/screens-preview/_sheets/preview--palette.jpg`, `preview--neutrals.jpg`, `preview--type.jpg`, `preview--glass.jpg`, `preview--tiles.jpg`, `preview--accents.jpg`, `preview--prayer.jpg`. The full-size PNGs stay on disk and out of git, like the Phase 1 set.');
P('- **Rig changes.** Two opt-in screen flags were added to the capture rig for this: `fullPage` (capture the whole document) and `optIn` (an area that runs only when named with `--area`). A default `node audits/tools/capture.mjs` still plans the same 4,447 Phase 1 captures, and `audits/tools/phase4/measure.mjs` skips opt-in areas, so the baseline and the Phase 4 measurements are unchanged.');
P('- **Not shown by the screenshots.** This WebKit paints no backdrop blur and uses Windows fallback fonts, so glass reads flatter and type slightly wider than on an iPad or iPhone (`audits/01-capture.md:103`). The ratios do not depend on either. Seeing the preview on the Kitchen iPad, an iPhone and the TV is the first device check of batch 1.');
P('');
P('## Index');
P('');
P('Every ID and its batch, sorted by ID.');
P('');
P('| ID | Severity | Batch | ID | Severity | Batch | ID | Severity | Batch |');
P('|---|---|---|---|---|---|---|---|---|');
const sorted = [...F].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
for (let k = 0; k < sorted.length; k += 3) { const c = sorted.slice(k, k + 3).map(f => `${f.id} | ${f.sev}${f.pointer ? ' (ptr)' : ''} | ${f.bn}`); while (c.length < 3) c.push(' | | '); P('| ' + c.join(' | ') + ' |'); }
P('');
P(`Household work: ${WORK.map(w => `${w.id} → ${w.batch}`).join(', ')}.`);
P('');
P('## What this report does not list');
P('');
const oks = cat.filter(i => i.kind === 'OK').length;
P(`- **${oks} positive items** (\`OK-*\`): what works, kept in their reports as the baseline Phase 6 must not break.`);
if (cutItems.length) P(`- **${cutItems.length} item${cutItems.length > 1 ? 's' : ''} the household cut**: ${cutItems.map(i => `${i.id}, ${clean(i.title).split(/\s+\(/)[0]} (\`${i.file}:${i.line}\`; cut at \`${cutAt(i.id)}\`)`).join('; ')}. Not planned; not to be proposed again.`);
P('- **Refuted claims** (each report\'s "Checked and not a bug") and **unresolved questions** (each report\'s "Unresolved"): they are not findings. The unresolved ones are device checks or data questions; they are gathered under "Device checks" below.');
if (refuted.length) P(`- **${refuted.length} items refuted in step 3** by both skeptics or the tie-breaker: ${refuted.map(i => `${i.id} (\`${i.file}:${i.line}\`)`).join(', ')}. Each verdict, with what the skeptics observed, is in \`audits/evidence/p5/ux-verify/verdicts.md\`.`);
P('- **The Phase 2 shell deviation tables** (`audits/02-shell.md:5747`, "Deviations from the house style") carry no IDs; Phase 4 measured the same deviations system-wide and filed them as the `P4-*`, `VIS-*`, `CONS-*` and `GAP-*` entries of batch 1, which close them.');
P('- **The Phase 1 leads** (`audits/01-leads.md`) were all confirmed, refuted or narrowed in Phases 2 and 3 (each report\'s "Leads" table); a confirmed lead is a finding above under its Phase 2 or 3 ID.');
P('');
P('## Device checks');
P('');
P('The local rig cannot show real Liquid Glass blur, SF Pro and SF Pro Rounded, touch and long-press, Home Screen chrome and safe areas, push through Apple\'s service, wake lock on iPadOS, real speech, or iOS audio policy (`audits/01-capture.md:103`, §3; the manual checks at `audits/01-capture.md:122`, §4). Each report\'s "Not verified" or "Unresolved" section names its own: `audits/02-shell.md` per section, `audits/03-apps/<id>.md` "Not verified", `audits/04-design-system.md` "Not verified". Phase 6 marks any fix that depends on one of them NEEDS DEVICE CHECK until it has been seen on the Kitchen iPad, an iPhone and the TV.');
P('');
P('## Scripts and evidence');
P('');
P('- `audits/tools/phase5/catalog.mjs` → `audits/evidence/p5/catalog.json` (712 items: every finding and positive of Phases 2-4, with its source line).');
P('- `audits/tools/phase5/remedies.mjs` → `audits/evidence/p5/remedies.json` (172 Phase 3 improvements, 127 Phase 4 gap rows, with the IDs each names).');
P('- `audits/evidence/p5/registers.json` (the three registers\' severities, parsed).');
P('- `audits/tools/phase5/fixes-shell.mjs`, `fixes-reading.mjs`, `fixes-home-apps.mjs`, `fixes-dollywood.mjs`, `fixes-system.mjs` (the fix, effort and batch of every finding) and `plan-batches.mjs` (the batches, the household work `WORK` and the cut list `CUT`).');
P('- `audits/tools/phase5/build-findings.mjs` (this file).');
if (Object.keys(VER).length) P('- Step 3: `audits/tools/phase5/ux-verify/targets.mjs` (the high and medium UX/VIS/CONS/GAP items → `audits/evidence/p5/ux-verify/targets.json` and `items/<ID>.md`), `ux-verify/verdicts.mjs` (the workflow result → `verdicts.json` and `verdicts.md`), the skeptics\' scripts in `audits/tools/phase5/ux-verify/<ID>/` and their outputs in `audits/evidence/p5/ux-verify/<ID>/`.');
P('- The design preview: `audits/design-preview.html` (its before images in `audits/design-preview-assets/`, made by `audits/tools/phase5/preview-assets.mjs`), its capture area `audits/tools/areas/preview.mjs`, the captures in `audits/screens-preview/`, `audits/tools/phase5/preview-sheets.mjs` (contact sheets without touching `audits/01-capture.md`) and `audits/tools/phase5/preview-check.mjs` (the two-engine check).');
fs.writeFileSync(A('05-findings.md'), L.join('\n') + '\n');
console.log(`written audits/05-findings.md: ${F.length} findings (${prim.length} primaries), ${ORDER.length} batches`);
console.log('severity', JSON.stringify(bySev), 'critical outside 0x:', critOutside.map(f => f.id + '@' + f.bn).join(' ') || 'none');
console.log('app order', appRows.map(r => `${appNo[r.id]}:${r.id} use ${r.use} gap ${r.gap} = ${r.score}`).join(' | '));
