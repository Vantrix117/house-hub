#!/usr/bin/env node
// Set (or rotate) the household pairing code.
//
//   node scripts/set-pairing-code.mjs            -> live D1
//   node scripts/set-pairing-code.mjs --local    -> wrangler dev's local D1
//
// Prompts for the code (input hidden), hashes it exactly like the Worker does
// (PBKDF2-SHA256, 10 000 iterations, 16-byte salt) and stores only the hash in the
// `settings` table via wrangler. The code itself is never written anywhere.
// If stdin is not a terminal (piped), the first line is used as the code.

import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ITER = 10000;
const local = process.argv.includes('--local');
const workerDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'worker');

const b64url = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function ask(prompt) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    if (process.stdin.isTTY) {
      // Hide what is typed.
      rl._writeToOutput = s => { if (s.includes('\n')) process.stdout.write('\n'); };
      process.stdout.write(prompt);
    }
    rl.question('', a => { rl.close(); resolve(a.trim()); });
  });
}

const code = await ask('Pairing code (hidden, 6-64 chars): ');
if (code.length < 6 || code.length > 64) { console.error('Pairing code must be 6-64 characters.'); process.exit(1); }
if (process.stdin.isTTY) {
  const again = await ask('Type it again: ');
  if (again !== code) { console.error('Codes did not match.'); process.exit(1); }
}

const salt = randomBytes(16);
const hash = `pbkdf2:${ITER}:${b64url(salt)}:${b64url(pbkdf2Sync(code, salt, ITER, 32, 'sha256'))}`;
const sql = `INSERT INTO settings (key, value) VALUES ('pairing_code_hash', '${hash}') ON CONFLICT(key) DO UPDATE SET value = excluded.value`;

console.log(`Storing the hash in ${local ? 'the local' : 'the LIVE'} house-hub database...`);
const r = spawnSync(
  `npx wrangler d1 execute house-hub ${local ? '--local' : '--remote'} --command "${sql}"`,
  { cwd: workerDir, stdio: 'inherit', shell: true },
);
if (r.status !== 0) { console.error('wrangler failed.'); process.exit(r.status || 1); }
console.log('Done. Devices that are already paired stay paired; new devices need the new code.');
