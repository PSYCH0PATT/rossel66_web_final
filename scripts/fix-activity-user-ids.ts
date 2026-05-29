#!/usr/bin/env tsx
/**
 * Migration script to fix Activity.userId database fields.
 * It maps the incorrect userId/artistId in Activity feed
 * to the actual User.id of the registered artist.
 *
 * Usage: npx tsx scripts/fix-activity-user-ids.ts
 */

import { prisma } from "../lib/prisma"

async function main() {
  console.log("Starting migration to fix Activity.userId...")

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

  // Fetch all activities where userRole is artist or metadata looks like it has artistName
  const activities = await prisma.activity.findMany({
    where: {
      OR: [
        { userRole: 'artist' },
        { type: 'report_status_changed' }
      ]
    }
  })

  console.log(`Loaded ${activities.length} potential artist activities from database.`)

  let updatedCount = 0
  let skippedCount = 0
  let unmatchedCount = 0

  for (const activity of activities) {
    const userIdVal = activity.userId || ""

    // Check if activity.userId is already a valid user ID
    const isIdValid = artists.some(a => a.id === userIdVal)

    if (isIdValid) {
      skippedCount++
      continue
    }

    // Try to find matching user ID for the invalid userIdVal (which is likely a name/username)
    let matchedUserId: string | undefined = undefined

    if (userIdVal) {
      const key = userIdVal.toLowerCase().trim()
      matchedUserId = mapByName.get(key) || 
                      mapByUsername.get(key) || 
                      mapByFio.get(key) || 
                      mapByFioShort.get(key)
    }

    // Fallback: check metadata
    if (!matchedUserId && activity.metadata && typeof activity.metadata === 'object') {
      const meta = activity.metadata as any
      const artistIdInMeta = meta.artistId || ""
      if (artistIdInMeta) {
        const key = artistIdInMeta.toLowerCase().trim()
        matchedUserId = mapByName.get(key) || 
                        mapByUsername.get(key) || 
                        mapByFio.get(key) || 
                        mapByFioShort.get(key)
      }
    }

    if (matchedUserId) {
      // Update activity userId
      // Also update metadata if needed
      let updatedMetadata = activity.metadata
      if (updatedMetadata && typeof updatedMetadata === 'object') {
        const meta = { ...(updatedMetadata as any) }
        if (meta.artistId && !artists.some(a => a.id === meta.artistId)) {
          meta.artistId = matchedUserId
        }
        updatedMetadata = meta
      }

      await prisma.activity.update({
        where: { id: activity.id },
        data: {
          userId: matchedUserId,
          metadata: updatedMetadata || undefined
        }
      })
      console.log(`[MIGRATED] Activity ${activity.id} (${activity.type}): userId "${userIdVal}" -> "${matchedUserId}"`)
      updatedCount++
    } else {
      console.log(`[WARN] Could not find registered artist for activity ${activity.id} (userId: "${userIdVal}", title: "${activity.title}")`)
      unmatchedCount++
    }
  }

  console.log("\nActivity Migration completed Summary:")
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
