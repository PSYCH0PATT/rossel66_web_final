import { cleanupExpiredFormSessions } from "@/lib/buildin/form-session"

async function main() {
  const deleted = await cleanupExpiredFormSessions()
  console.log(`Deleted ${deleted} expired form delivery session(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
