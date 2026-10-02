import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const ROOT = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const src = fs.readFileSync(ROOT + '/worker/src/reminders.js', 'utf8');
const qs = [...src.matchAll(/prepare\("(SELECT [^"]*INDEXED BY app_data_timer_live[^"]*)"\)/g)].map(m => m[1]);
console.log('queries with INDEXED BY:', qs.length);
for (const withIdx of [true, false]) {
  const db = new DatabaseSync(':memory:');
  let schema = fs.readFileSync(ROOT + '/worker/schema.sql', 'utf8');
  if (!withIdx) schema = schema.replace(/CREATE INDEX IF NOT EXISTS app_data_timer_live[^;]*;/, '');
  db.exec(schema);
  if (withIdx) { db.exec(fs.readFileSync(ROOT + '/worker/migrations/008-timer-live.sql', 'utf8')); db.exec(fs.readFileSync(ROOT + '/worker/migrations/008-timer-live.sql', 'utf8')); console.log('008 applied twice over schema.sql: ok'); }
  const ins = db.prepare("INSERT INTO app_data (scope, profile_id, app_id, key, value, updated_at, synced_at) VALUES (?,?,?,?,?,?,?)");
  for (let n = 0; n < 7300; n++) { ins.run('person', 'eli', 'timer', 'timer:t' + n, null, n, n); ins.run('family', null, 'timer', 'run:eli:t' + n, null, n, n); }
  ins.run('person', 'eli', 'timer', 'timer:live', '{"endAt":1}', 1, 1); ins.run('family', null, 'timer', 'run:eli:live', '{"endAt":1}', 1, 1);
  ins.run('person', 'eli', 'timer', 'recents', '[]', 1, 1);
  for (const q of qs) {
    try {
      const plan = db.prepare('EXPLAIN QUERY PLAN ' + q).all().map(r => r.detail).join(' | ');
      const vm = db.prepare(q); const rows = vm.all();
      console.log(withIdx ? '[index]' : '[no index]', 'rows', rows.length, 'plan:', plan);
    } catch (e) { console.log(withIdx ? '[index]' : '[no index]', 'ERROR (fallback path taken):', e.message); }
  }
  const sc = db.prepare("SELECT count(*) c FROM app_data INDEXED BY app_data_timer_live WHERE app_id='timer' AND value IS NOT NULL").get;
}
