const { local, sleep } = await import('file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs');
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const today = '2026-09-22';
  const put = (who, items) => L.apiAs(who, '/api/data/prayer/batch?scope=family', { method: 'POST', body: { items } });
  let w = await put('dad', [{ key: 'prayer:rv-pf', value: { id: 'rv-pf', title: "Grandma Jo's visit", category: 'Family', status: 'active', cadence: 'daily', createdAt: '2026-09-20', prayedBy: {}, by: 'dad', updates: [] }, updated_at: Date.now() }]);
  console.log('create', JSON.stringify(w.body));
  for (const who of ['ezra','mom']) { const cur = (await L.apiAs(who, '/api/data/prayer?scope=family')).body; const row = cur.items.find(x => x.key === 'prayer:rv-pf'); const v = row.value; v.prayedBy[today] = [...(v.prayedBy[today]||[]), who]; v.lastPrayedAt = today; w = await put(who, [{ key: 'prayer:rv-pf', value: v, updated_at: row.updated_at + 1000 }]); console.log(who, JSON.stringify(w.body)); }
} catch (e) { console.log('ERR', e); }
await L.close();
