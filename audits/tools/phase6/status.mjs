// Phase 6: the status of every finding a batch has closed, read by audits/tools/phase5/build-findings.mjs so that
// audits/05-findings.md carries it (constitution, Phase 6: "Update audits/05-findings.md with status (FIXED / PARTIAL /
// DEFERRED / NEEDS DEVICE CHECK) and the commit hash"). One entry per finding; a pointer gets its primary's status.
// The batch's full record (reruns, captures, tests, what was not verified) is in audits/06-implementation.md.
//
// BATCHES[n]: the batch's code commit and date.
// STATUS[id]: { status, batch, note, after: [after-evidence paths] }. The commit comes from the batch.

export const STATUSES = ['FIXED', 'PARTIAL', 'DEFERRED', 'NEEDS DEVICE CHECK'];

export const BATCHES = {
  '0a': { commit: 'ae274a6', date: '2026-09-26' },
};

export const STATUS = {
  'P2-STAB-01': {
    status: 'FIXED', batch: '0a',
    note: 'hub.js defines hub.sheenFrom before its reduced-motion return (apps/hub.js:442); index.html:662 calls it only if it is a function. With Reduce Motion on, all 11 skeptic cases and all 6 STAB cases boot (shell or gate shown, 0 page errors) in WebKit and Chromium, and the render matches Reduce Motion off (4 pairs, 0 pixels over tolerance).',
    after: ['audits/evidence/p6/0a/VIS/verify-rm2.json', 'audits/evidence/p6/0a/STAB/reduced-motion.json', 'audits/evidence/p6/0a/VIS/verify-rm2-webkit-iphone-eli-reduce.png', 'audits/evidence/p6/0a/VIS/verify-rm2-webkit-ipad-unpaired-reduce.png'],
  },
  'P2-VIS-01': {
    status: 'FIXED', batch: '0a',
    note: 'Pointer to P2-STAB-01; its own check (density-motion.mjs, last block) now prints shellHidden=false under reduce.',
    after: ['audits/evidence/p6/0a/VIS/density-motion.json', 'audits/evidence/p6/0a/VIS/reduced-motion-reduce-webkit-ipad.png'],
  },
};

for (const [id, s] of Object.entries(STATUS)) {
  if (!STATUSES.includes(s.status)) throw new Error(`${id}: unknown status ${s.status}`);
  if (!BATCHES[s.batch]) throw new Error(`${id}: batch ${s.batch} has no BATCHES entry`);
}
