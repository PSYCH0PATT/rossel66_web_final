#!/usr/bin/env tsx
/**
 * Migration script to fix Report.artistId database fields.
 * It maps the incorrect artistId (which contains artist canonical name)
 * to the actual User.id of the registered artist user.
 *
 * Usage: npx tsx scripts/fix-report-artist-ids.ts
 */

import { prisma } from "../lib/prisma"

async function main() {
  console.log("Starting migration to fix Report.artistId...")

  // Fetch all users with role 'artist'
  const artists = await prisma.user.findMany({
    where: { role: 'artist' }
  })

  console.log(`Loaded ${artists.length} artists from database.`)

  // Build lookup maps
  const mapByName = new Map<string, string>()
  const mapByUsername = new Map<string, string>()
  const mapByFio = new Map<string, string>()
  const mapByFioShort = new Map<string, string>()

  for (const artist of artists) {
    if (artist.name) {
      mapByName.set(artist.name.toLowerCase().trim(), artist.id)
    }
    if (artist.username) {
      mapByUsername.set(artist.username.toLowerCase().trim(), artist.id)
    }
    if (artist.fio) {
      mapByFio.set(artist.fio.toLowerCase().trim(), artist.id)
    }
    if (artist.fioShort) {
      mapByFioShort.set(artist.fioShort.toLowerCase().trim(), artist.id)
    }
  }

  // Fetch all reports
  const reports = await prisma.report.findMany({})
  console.log(`Loaded ${reports.length} reports from database.`)

  let updatedCount = 0
  let skippedCount = 0
  let unmatchedCount = 0

  for (const report of reports) {
    const artistIdVal = report.artistId || ""
    const artistNameVal = report.artistName || ""

    // Check if report.artistId is already a valid user ID
    const isIdValid = artists.some(a => a.id === artistIdVal)

    if (isIdValid) {
      // It's already a valid user ID. Ensure isRegistered is true
      if (report.isRegistered !== true) {
        await prisma.report.update({
          where: { id: report.id },
          data: { isRegistered: true }
        })
        console.log(`[OK] Report ${report.id} already has valid artistId but isRegistered was false. Fixed isRegistered = true.`)
        updatedCount++
      } else {
        skippedCount++
      }
      continue
    }

    // Try to find matching user ID
    let matchedUserId: string | undefined = undefined

    // Keys to search
    const keysToTry = [
      artistIdVal.toLowerCase().trim(),
      artistNameVal.toLowerCase().trim()
    ].filter(Boolean)

    for (const key of keysToTry) {
      matchedUserId = mapByName.get(key) || 
                      mapByUsername.get(key) || 
                      mapByFio.get(key) || 
                      mapByFioShort.get(key)
      if (matchedUserId) break
    }

    if (matchedUserId) {
      // Update database report
      await prisma.report.update({
        where: { id: report.id },
        data: {
          artistId: matchedUserId,
          isRegistered: true
        }
      })
      console.log(`[MIGRATED] Report ${report.id}: artistId "${artistIdVal}" (name: "${artistNameVal}") -> user.id "${matchedUserId}"`)
      updatedCount++
    } else {
      console.log(`[WARN] Could not find registered artist for report ${report.id} (artistId: "${artistIdVal}", name: "${artistNameVal}")`)
      unmatchedCount++
    }
  }

  console.log("\nMigration completed Summary:")
  console.log(`- Updated/Fixed: ${updatedCount}`)
  console.log(`- Skipped (already correct): ${skippedCount}`)
  console.log(`- Unmatched: ${unmatchedCount}`)
  await prisma.$disconnect()
  process.exit(0)
}

main()
  .catch(async err => {
    console.error("Migration failed:", err)
    await prisma.$disconnect()
    process.exit(1)
  })
