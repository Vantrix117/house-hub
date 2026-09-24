// Skeptic #1 helper: how big is Eli's first F260 pull (GET /api/data/f260?scope=person&since=0) in the typical demo household?
//   node "audits/tools/phase2/SYNC/verify-slow-first-pull-weekstart-1-size.mjs"
import { local } from '../../lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const r = await L.apiAs('eli', '/api/data/f260?scope=person&since=0');
  const bytes = Buffer.byteLength(JSON.stringify(r.body));
  const big = (r.body.items || []).map(i => [i.key, Buffer.byteLength(JSON.stringify(i.value))]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log('status', r.status, '| items', (r.body.items || []).length, '| body bytes', bytes, '| largest rows', JSON.stringify(big));
} finally { await L.close(); }
