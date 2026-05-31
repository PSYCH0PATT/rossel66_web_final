import fs from 'fs'
import { prisma } from './prisma'
import { userFromPrisma, releaseFromPrisma } from './storage-adapters'

export interface ExportPaths {
  usersPath: string
  releasesPath: string
}

export async function exportPrismaDataForPython(requestId: string): Promise<ExportPaths> {
  const usersPath = `/tmp/users_export_${requestId}.json`
  const releasesPath = `/tmp/releases_export_${requestId}.json`

  // 1. Fetch artists
  const users = await prisma.user.findMany({
    where: { role: 'artist' }
  })
  const artistsData = users.map((u) => {
    const dto = userFromPrisma(u)
    return {
      ...dto,
      percentage: u.percentage ?? null,
    }
  })

  // 2. Fetch releases
  const releases = await prisma.release.findMany()
  const releasesData = releases.map(releaseFromPrisma)

  // Write temporary files
  fs.writeFileSync(usersPath, JSON.stringify(artistsData, null, 2), 'utf-8')
  fs.writeFileSync(releasesPath, JSON.stringify(releasesData, null, 2), 'utf-8')

  return {
    usersPath,
    releasesPath
  }
}

export function cleanupExportedData(paths: ExportPaths) {
  try {
    if (fs.existsSync(paths.usersPath)) {
      fs.unlinkSync(paths.usersPath)
    }
    if (fs.existsSync(paths.releasesPath)) {
      fs.unlinkSync(paths.releasesPath)
    }
  } catch (err) {
    console.error('Error cleaning up exported data files:', err)
  }
}
