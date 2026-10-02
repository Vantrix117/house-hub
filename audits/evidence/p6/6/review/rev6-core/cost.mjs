// timerJob's per-minute reads: the query plan, and how many rows SQLite steps through as tombstones pile up
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const ROOT = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync(ROOT + '/worker/schema.sql', 'utf8'));
const Q1 = "SELECT id, profile_id, key, value, updated_at FROM app_data WHERE app_id = 'timer' AND scope = 'person' AND value IS NOT NULL AND (substr(key, 1, 6) = 'timer:' OR key = 'timer.active')";
const Q2 = "SELECT id, key, value, updated_at FROM app_data WHERE app_id = 'timer' AND scope = 'family' AND profile_id IS NULL AND value IS NOT NULL AND substr(key, 1, 4) = 'run:'";
const cols = db.prepare("PRAGMA table_info(app_data)").all().map(c => c.name);
console.log('app_data columns', cols.join(','));
const ins = db.prepare("INSERT INTO app_data (scope, profile_id, app_id, key, value, updated_at, synced_at) VALUES (?,?,?,?,?,?,?)");
let n = 0; const add = (k) => { for (let i = 0; i < k; i++, n++) { ins.run('person', ['eli','christian','mom'][n % 3], 'timer', 'timer:t' + n, null, n, n); ins.run('family', null, 'timer', 'run:x:t' + n, null, n, n); } };
// other apps' rows (a busy household)
for (let i = 0; i < 5000; i++) ins.run('person', 'eli', 'f260', 'done:' + i, '1', i, i);
console.log('PLAN Q1', db.prepare('EXPLAIN QUERY PLAN ' + Q1).all().map(r => r.detail).join(' | '));
console.log('PLAN Q2', db.prepare('EXPLAIN QUERY PLAN ' + Q2).all().map(r => r.detail).join(' | '));
for (const k of [0, 10, 3650 - 10, 7300]) {
  add(k);
  // rows stepped = the index range read (SQLite stmt status is not exposed by node:sqlite; count the range instead)
  const range1 = db.prepare("SELECT count(*) c FROM app_data WHERE app_id='timer' AND scope='person'").get().c;
  const range2 = db.prepare("SELECT count(*) c FROM app_data WHERE app_id='timer' AND scope='family' AND profile_id IS NULL").get().c;
  const live = db.prepare(Q1).all().length;
  console.log(`timers ever started ${n}: person-range rows ${range1} + mirror-range rows ${range2} read each minute (live ${live}) -> ${(range1 + range2) * 1440} rows/day`);
}
