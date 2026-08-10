/**
 * BLOCKED — recreates the obsolete child-DB architecture
 * (submission_releases / submission_tracks).
 *
 * Use instead:
 *   npx tsx scripts/setup-buildin-form-queues.ts
 *   npx tsx scripts/migrate-buildin-form-queue-schemas.ts --dry-run
 */
console.error(
  [
    "BLOCKED: scripts/setup-buildin-form-databases.ts is deprecated.",
    "It would recreate submission_releases / submission_tracks (old architecture).",
    "Use scripts/setup-buildin-form-queues.ts and migrate-buildin-form-queue-schemas.ts.",
  ].join("\n")
)
process.exit(1)
