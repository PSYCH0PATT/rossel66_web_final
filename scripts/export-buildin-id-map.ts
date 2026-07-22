/**
 * Export Buildin ↔ local ID mapping for Pyrus archive period.
 *   npx tsx scripts/export-buildin-id-map.ts > buildin-id-map.json
 */
import { prisma } from "../lib/prisma"

async function main() {
  const [externalIds, submissions] = await Promise.all([
    prisma.buildinExternalId.findMany({ orderBy: [{ entityType: "asc" }, { createdAt: "asc" }] }),
    prisma.formSubmission.findMany({
      select: {
        id: true,
        formType: true,
        title: true,
        pyrusTaskId: true,
        buildinPageId: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ])

  console.log(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        externalIds,
        submissions,
        note: "Keep this export while Pyrus is read-only archive. Do not delete Pyrus tasks until retention ends.",
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
