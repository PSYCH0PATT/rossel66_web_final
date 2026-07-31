/** Pure helpers extracted for unit tests (mirrors outbox backoff table). */
export function backoffProbe(attempts: number): number {
  const table = [30, 120, 300, 900, 1800, 3600, 7200, 21600]
  const sec = table[Math.min(attempts, table.length - 1)] ?? 21600
  return sec * 1000
}
