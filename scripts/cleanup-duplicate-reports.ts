#!/usr/bin/env tsx
/**
 * Cleanup script to remove duplicate reports from database and data/reports.json.
 * Duplicates occur when the processing script is run multiple times for the same quarter and year,
 * generating new IDs due to the timestamp suffix.
 *
 * Usage: npx tsx scripts/cleanup-duplicate-reports.ts
 */

import { prisma } from "../lib/prisma"
import * as fs from "fs"
import * as path from "path"

async function main() {
  console.log("Starting cleanup of duplicate reports...")

  // --- Part 1: Clean data/reports.json ---
  const reportsJsonPath = path.join(process.cwd(), 'data', 'reports.json')
  if (fs.existsSync(reportsJsonPath)) {
    try {
      const reports = JSON.parse(fs.readFileSync(reportsJsonPath, 'utf-8'))
      if (Array.isArray(reports)) {
        console.log(`Original reports.json count: ${reports.length}`)
        
        // Group by (quarter, year, artistName) and keep the last one (latest)
        const uniqueReportsMap = new Map<string, any>()
        for (const report of reports) {
          const key = `${report.quarter}_${report.year}_${(report.artistName || "").toLowerCase().trim()}`
          // Since they are appended, the later ones in the list are newer
          uniqueReportsMap.set(key, report)
        }

        const cleanedReports = Array.from(uniqueReportsMap.values())
        console.log(`Cleaned reports.json count: ${cleanedReports.length}`)

        fs.writeFileSync(reportsJsonPath, JSON.stringify(cleanedReports, null, 2), 'utf-8')
        console.log("Successfully cleaned up data/reports.json")
      }
    } catch (err) {
      console.error("Failed to clean up data/reports.json:", err)
    }
  }

  // --- Part 2: Clean database ---
  const dbReports = await prisma.report.findMany({})
  console.log(`Original database reports count: ${dbReports.length}`)

  // Group by (quarter, year, artistName)
  const grouped = new Map<string, typeof dbReports>()
  for (const report of dbReports) {
    const key = `${report.quarter}_${report.year}_${(report.artistName || "").toLowerCase().trim()}`
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(report)
  }

  let deletedCount = 0

  for (const [key, list] of grouped.entries()) {
    if (list.length > 1) {
      // Sort by uploadedAt (or ID timestamp) descending to keep the newest
      list.sort((a, b) => {
        // Fallback to ID timestamp if uploadedAt is same
        const timeA = a.uploadedAt.getTime()
        const timeB = b.uploadedAt.getTime()
        if (timeA !== timeB) return timeB - timeA
        return b.id.localeCompare(a.id)
      })

      const [newest, ...duplicates] = list
      console.log(`For group "${key}", keeping newest ID "${newest.id}" and deleting ${duplicates.length} duplicates.`)

      for (const duplicate of duplicates) {
        await prisma.report.delete({
          where: { id: duplicate.id }
        })
        deletedCount++
      }
    }
  }

  console.log(`Successfully deleted ${deletedCount} duplicate reports from the database.`)
  const finalCount = await prisma.report.count()
  console.log(`Final database reports count: ${finalCount}`)

  await prisma.$disconnect()
  process.exit(0)
}

main().catch(async (e) => {
  console.error("Cleanup failed:", e)
  await prisma.$disconnect()
  process.exit(1)
})
