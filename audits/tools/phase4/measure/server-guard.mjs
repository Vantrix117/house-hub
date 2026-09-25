// Runs audits/tools/lib/server.mjs (read-only import, unchanged) in this process and exits when the parent's stdin
// pipe closes, so a measure.mjs lane that is killed (timeout, Ctrl+C) never leaves a rig server behind on Windows.
// server.mjs reads its options from process.argv, which this process shares.
process.stdin.on('end', () => process.exit(0));
process.stdin.on('error', () => process.exit(0));
process.stdin.resume();
await import('../../lib/server.mjs');
