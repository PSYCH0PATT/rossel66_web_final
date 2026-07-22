/**
 * Process Buildin outbox retries.
 *   npx tsx scripts/process-buildin-outbox.ts [limit]
 */
import { processBuildinOutbox } from "../lib/buildin/process-outbox"

async function main() {
  const limit = Number(process.argv[2] || 20)
  const result = await processBuildinOutbox(Number.isFinite(limit) ? limit : 20)
  console.log(JSON.stringify(result, null, 2))
  if (result.failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
