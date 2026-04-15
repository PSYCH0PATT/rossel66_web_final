import { getArtistReports } from "@/lib/data"
import { users } from "@/lib/data"
import Layout from "@/components/layout"
import ArtistReports from "@/components/artist-reports"

export default function AdminArtistReportsPage({ params }: { params: { id: string } }) {
  // Находим артиста по ID
  const artist = users.find((user) => user.id === params.id)

  if (!artist) {
    return (
      <Layout role="admin" requiredRole="admin">
        <div className="text-center py-8 text-gray-400">Артист не найден</div>
      </Layout>
    )
  }

  // Получаем отчеты артиста
  const reports = getArtistReports(artist.id)

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Отчеты: {artist.name}</h1>
        <ArtistReports username={artist.username} reports={reports} artistName={artist.name} />
      </div>
    </Layout>
  )
}
