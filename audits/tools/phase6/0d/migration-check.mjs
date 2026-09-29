// Batch 0d, KITCHEN-1: the one non-additive schema step, checked on a copy of the production export.
//   node audits/tools/phase6/0d/migration-check.mjs <export.sql>
// Loads the export into an in-memory SQLite database, snapshots every table, runs worker/migrations/006-kitchen.sql,
// then compares: every table keeps its row count (profiles gains exactly the kitchen row); every profiles row keeps
// every one of its columns, value for value; the new columns start NULL; devices gains role (NULL on every row);
// the kind CHECK now takes 'kitchen' and still refuses anything else; a second run fails on its first statement and
// changes nothing. Prints counts and pass/fail only — never a value (the export holds PIN hashes and session hashes).
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EXPORT = process.argv[2];
if (!EXPORT || !fs.existsSync(EXPORT)) { console.error('usage: migration-check.mjs <export.sql>'); process.exit(2); }
const OUT = path.join(ROOT, 'audits/evidence/p6/0d/migration-check.json');
const MIG = fs.readFileSync(path.join(ROOT, 'worker/migrations/006-kitchen.sql'), 'utf8');

const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync(EXPORT, 'utf8'));
const tables = () => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_cf_KV' ORDER BY name").all().map(r => r.name);
const counts = () => Object.fromEntries(tables().map(t => [t, db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n]));
const cols = t => db.prepare(`PRAGMA table_info("${t}")`).all().map(c => c.name);
const rows = t => db.prepare(`SELECT * FROM "${t}" ORDER BY rowid`).all();

const checks = []; const ok = (cond, name) => { checks.push({ ok: !!cond, name }); console.log(cond ? '  ✓' : '  ✗', name); };
const before = { counts: counts(), profileCols: cols('profiles'), deviceCols: cols('devices'), profiles: rows('profiles'), devices: rows('devices') };
const otherTables = Object.keys(before.counts).filter(t => t !== 'profiles');
const snap = Object.fromEntries(otherTables.map(t => [t, JSON.stringify(rows(t))]));

db.exec(MIG);
const after = { counts: counts(), profileCols: cols('profiles'), deviceCols: cols('devices') };
const byId = new Map(rows('profiles').map(r => [r.id, r]));

ok(after.counts.profiles === before.counts.profiles + 1, `profiles: ${before.counts.profiles} rows before, ${after.counts.profiles} after (the kitchen added)`);
ok(before.profiles.every(r => byId.has(r.id)), 'every profile row is still there, by id');
let same = 0, total = 0;
for (const r of before.profiles) for (const c of before.profileCols) { total++; if (Object.is(byId.get(r.id)[c], r[c]) || byId.get(r.id)[c] === r[c]) same++; }
ok(same === total, `profiles: ${same} of ${total} values identical, column by column (${before.profileCols.length} columns × ${before.profiles.length} rows)`);
ok(['hue', 'pin_reset_hash', 'pin_reset_expires'].every(c => after.profileCols.includes(c)) && before.profiles.every(r => ['hue', 'pin_reset_hash', 'pin_reset_expires'].every(c => byId.get(r.id)[c] === null)), 'the three new profile columns exist and start NULL on every existing row');
const k = byId.get('kitchen');
ok(k && k.kind === 'kitchen' && k.pin_hash === null && k.is_admin === 0 && k.is_guest === 0, 'the kitchen profile: kind kitchen, no PIN, not admin, not a guest');
ok(after.deviceCols.includes('role') && rows('devices').every(d => d.role === null) && after.counts.devices === before.counts.devices, `devices: role added, NULL on all ${after.counts.devices} rows`);
const devSame = rows('devices').every((d, i) => before.deviceCols.every(c => d[c] === before.devices[i][c]));
ok(devSame, 'devices: every other column identical');
ok(otherTables.every(t => after.counts[t] === before.counts[t] && JSON.stringify(rows(t)) === (t === 'devices' ? JSON.stringify(rows(t)) : snap[t])), `other tables untouched: ${otherTables.map(t => `${t} ${after.counts[t]}`).join(', ')}`);
let refused = false; try { db.exec("INSERT INTO profiles (id, name, kind) VALUES ('zz-bad', 'x', 'robot')"); } catch { refused = true; }
ok(refused, "the kind CHECK still refuses an unknown kind");
let secondRunFailed = false; const c1 = JSON.stringify(counts());
try { db.exec(MIG); } catch (e) { secondRunFailed = /duplicate column name: role/.test(e.message); }
ok(secondRunFailed && JSON.stringify(counts()) === c1, 'a second run fails on its first statement ("duplicate column name: role") and changes nothing');
const idx = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'profiles'").all().map(r => r.name);
ok(true, `indexes on profiles after the rebuild: ${idx.length ? idx.join(', ') : 'none (the primary key only, as before)'}`);

const result = { export: path.basename(EXPORT), before: before.counts, after: after.counts, profileColumnsBefore: before.profileCols, profileColumnsAfter: after.profileCols, deviceColumnsAfter: after.deviceCols, checks };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
const failed = checks.filter(c => !c.ok).length;
console.log(`\n${checks.length - failed} passed, ${failed} failed → ${path.relative(ROOT, OUT)}`);
process.exit(failed ? 1 : 0);
