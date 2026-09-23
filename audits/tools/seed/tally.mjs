// Tally counter (apps/tally.html): one personal number per person, person scope, key 'count'.
//   empty     nothing — every counter reads 0
//   typical   Eli 37, Ezra 12, Kiara 5 (a Tuesday morning; counted yesterday evening)
//   overflow  big numbers to stress the dial: Eli 1,284,750 (7 digits), Ezra 250,000, Kiara 9,999
// No other app reads these rows (no Home widget, no TV pane; inventory "Only F260 has a tile widget").
export default function tally(h) {
  if (h.empty) return;
  // apps/tally.html:150 reads Number(hub.get('count', { default: 0 })); :152 writes Math.max(0, v) — a plain non-negative number
  const counts = h.overflow
    ? { eli: 1284750, ezra: 250000, kiara: 9999 }
    : { eli: 37, ezra: 12, kiara: 5 };
  const at = {
    eli: h.time(-1, '20:15'),
    ezra: h.time(-1, '18:30'),
    kiara: h.time(-2, '17:05'),
  };
  for (const [pid, n] of Object.entries(counts)) h.person(pid, 'tally', 'count', n, at[pid]);
}
