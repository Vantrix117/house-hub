// A Cloudflare D1 binding over node:sqlite (D1 is SQLite), covering the surface worker/src uses:
// prepare(sql).bind(...).first(col?) / .all() / .run(), DB.batch([...]) and DB.exec(sql).
// Results mimic D1: all() → { results, success, meta }, run() → { meta: { changes, last_row_id } },
// BLOB columns come back as ArrayBuffer (worker/src/media.js expects that).
import { DatabaseSync } from 'node:sqlite';

const toParam = v => v === undefined ? null
  : typeof v === 'boolean' ? (v ? 1 : 0)
  : v instanceof ArrayBuffer ? new Uint8Array(v)
  : ArrayBuffer.isView(v) ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
  : v;
const fromRow = row => {
  if (!row) return row;
  const o = {};
  for (const [k, v] of Object.entries(row)) o[k] = v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v;
  return o;
};
const READS = /^\s*(select|with|pragma)\b/i;

export function createD1(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = OFF;');
  class Stmt {
    constructor(sql, params = []) { this.sql = sql; this.params = params; }
    bind(...p) { return new Stmt(this.sql, p.map(toParam)); }
    _get() { return fromRow(db.prepare(this.sql).get(...this.params)); }
    _all() { return db.prepare(this.sql).all(...this.params).map(fromRow); }
    _run() { const r = db.prepare(this.sql).run(...this.params); return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
    _any() { return READS.test(this.sql) ? { success: true, results: this._all(), meta: {} } : this._run(); }
    async first(col) { const r = this._get(); if (!r) return null; return col ? (r[col] ?? null) : r; }
    async all() { return { success: true, results: this._all(), meta: {} }; }
    async run() { return this._run(); }
    async raw() { return this._all().map(r => Object.values(r)); }
  }
  return {
    prepare: sql => new Stmt(sql),
    async batch(stmts) {
      db.exec('BEGIN');
      try { const out = stmts.map(s => s._any()); db.exec('COMMIT'); return out; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    async exec(sql) { db.exec(sql); return { count: 1, duration: 0 }; },
    sqlite: db,          // for the seeder
    close: () => db.close(),
  };
}
