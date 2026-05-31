import { prisma } from "@/lib/prisma"
import { reportFromPrisma } from "@/lib/storage-adapters"
import ArtistReports from "@/components/artist-reports"

export default async function AdminArtistReportsPage({ params }: { params: { id: string } }) {
  const artist = await prisma.user.findUnique({ where: { id: params.id } })

  if (!artist || artist.role !== "artist") {
    return (
      <div className="text-center py-8 text-gray-400">Артист не найден</div>
      )
  }

  const reportRows = await prisma.report.findMany({
    where: { artistId: params.id },
    orderBy: [{ year: "desc" }, { quarter: "desc" }],
  })
  const reports = reportRows.map(reportFromPrisma)

  return (
    
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Отчеты: {artist.name}</h1>
        <ArtistReports username={artist.username} reports={reports} artistName={artist.name} />
      </div>
    )
}
