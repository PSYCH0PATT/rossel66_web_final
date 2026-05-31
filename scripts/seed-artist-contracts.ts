/**
 * One-time seed: import contract fields from scripts/seed-data/artist-contracts.json into Supabase.
 * Also reverts fabricated percentage=60 rows (no fio/contract) before seeding.
 *
 * Run:
 *   npx tsx scripts/seed-artist-contracts.ts --dry-run
 *   npx tsx scripts/seed-artist-contracts.ts
 */
import fs from "fs"
import path from "path"
import { prisma } from "../lib/prisma"

type ContractRow = {
  name: string
  fio?: string
  fioShort?: string
  contract?: string
  percentage: number
  aliases?: string[]
}

const SEED_PATH = path.join(process.cwd(), "scripts", "seed-data", "artist-contracts.json")

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]/g, "")
}

function isEmpty(v: string | null | undefined): boolean {
  return v == null || v.trim() === "" || v.trim() === "-"
}

function loadSeed(): ContractRow[] {
  if (!fs.existsSync(SEED_PATH)) {
    throw new Error(`Seed file not found: ${SEED_PATH}`)
  }
  return JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"))
}

function buildSeedIndex(contracts: ContractRow[]) {
  const byKey = new Map<string, ContractRow>()
  for (const row of contracts) {
    byKey.set(norm(row.name), row)
    byKey.set(slug(row.name), row)
    for (const alias of row.aliases ?? []) {
      byKey.set(norm(alias), row)
      byKey.set(slug(alias), row)
    }
  }
  return { contracts, byKey }
}

function findSeedMatch(
  artist: { name: string; username: string },
  byKey: Map<string, ContractRow>
): ContractRow | undefined {
  const keys = [norm(artist.name), norm(artist.username), slug(artist.name), slug(artist.username)]
  for (const key of keys) {
    if (key && byKey.has(key)) return byKey.get(key)
  }
  return undefined
}

function buildMerge(
  artist: {
    percentage: number | null
    fio: string | null
    fioShort: string | null
    contract: string | null
  },
  match: ContractRow
): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  if (artist.percentage == null) data.percentage = match.percentage
  if (isEmpty(artist.fio) && match.fio && !isEmpty(match.fio)) data.fio = match.fio
  if (isEmpty(artist.fioShort) && match.fioShort && !isEmpty(match.fioShort)) data.fioShort = match.fioShort
  if (isEmpty(artist.contract) && match.contract && !isEmpty(match.contract)) data.contract = match.contract
  return data
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const contracts = loadSeed()
  const { byKey } = buildSeedIndex(contracts)

  const artists = await prisma.user.findMany({
    where: { role: "artist" },
    select: {
      id: true,
      name: true,
      username: true,
      percentage: true,
      fio: true,
      fioShort: true,
      contract: true,
    },
  })

  let revertCount = 0
  let seedUpdates = 0
  const matchedSeed = new Set<string>()
  const unmatchedSeed = [...contracts.map((c) => c.name)]
  const revertIds: string[] = []

  for (const artist of artists) {
    const isFabricated =
      artist.percentage === 60 &&
      isEmpty(artist.contract) &&
      isEmpty(artist.fio)

    if (isFabricated) {
      revertCount++
      revertIds.push(artist.id)
      if (!dryRun) {
        await prisma.user.update({ where: { id: artist.id }, data: { percentage: null } })
      }
    }
  }

  for (const artist of artists) {
    const match = findSeedMatch(artist, byKey)
    if (!match) continue

    matchedSeed.add(match.name)
    const data = buildMerge(artist, match)
    if (Object.keys(data).length === 0) continue

    seedUpdates++
    if (!dryRun) {
      await prisma.user.update({ where: { id: artist.id }, data })
    }
  }

  const unmatchedSeedNames = contracts
    .map((c) => c.name)
    .filter((name) => !matchedSeed.has(name))

  const stats = {
    dryRun,
    artistsTotal: artists.length,
    revertedFabricated60: revertCount,
    seedRows: contracts.length,
    seedMatched: matchedSeed.size,
    seedUpdated: seedUpdates,
    unmatchedSeed: unmatchedSeedNames,
  }

  const stillNull = await prisma.user.count({ where: { role: "artist", percentage: null } })
  const withContract = await prisma.user.count({
    where: { role: "artist", contract: { not: null }, NOT: { contract: "" } },
  })
  const suspicious60 = await prisma.user.count({
    where: {
      role: "artist",
      percentage: 60,
      OR: [{ contract: null }, { contract: "" }],
    },
  })

  console.log(JSON.stringify({ ...stats, stillNullPercentage: stillNull, withContract, suspicious60 }, null, 2))
  if (dryRun) {
    console.log(`Dry-run: would revert ${revertCount} ids, would seed-update ${seedUpdates}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
