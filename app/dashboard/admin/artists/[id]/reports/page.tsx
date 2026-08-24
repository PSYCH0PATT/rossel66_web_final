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

  /* C-01: заголовок отдаём в PageHeader компонента — свой <h1> здесь давал
     вторую шапку подряд и был единственным голым h1 в кабинетах. */
  return (
    <ArtistReports
      username={artist.username}
      reports={reports}
      artistName={artist.name}
      title={`Отчёты: ${artist.name}`}
    />
  )
}
