// Probe for verify-home-feed-never-refreshes-2: where does a fresh POST /api/activity line sort in GET /api/activity (real clock)?
import { local } from '../../lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'real' });
try {
  const before = await L.apiAs('eli', '/api/activity?limit=5');
  console.log('top 5 before:', JSON.stringify(before.body.activity.map(a => [a.profile_id, a.text.slice(0, 40), new Date(a.created_at).toISOString()])));
  const p = await L.apiAs('christian', '/api/activity', { method: 'POST', body: { app_id: 'hub', text: 'PROBE line' } });
  console.log('post:', p.status, JSON.stringify(p.body));
  const after = await L.apiAs('eli', '/api/activity?limit=100');
  const i = after.body.activity.findIndex(a => a.text === 'PROBE line');
  console.log('real now:', new Date().toISOString(), '| PROBE line index in feed:', i, '| rows:', after.body.activity.length);
} finally { await L.close(); }
