import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"
import { canViewArtistCabinet } from "@/lib/artist-links"
import { prisma } from "@/lib/prisma"
import { getCachedArtistReports } from "@/lib/cached-dashboard"
import { getArtistBalance } from "@/lib/storage"
import ArtistReports from "@/components/artist-reports"

export const revalidate = 600

/**
 * «Отчёты и выплаты» — объединённый экран кабинета артиста (решение 0-а,
 * артистская половина; Б-16 в docs/backlog.md). Экранов было два, /reports и
 * /payments, и второй повторял первый карточка-в-карточку. Теперь баланс,
 * аванс и квартальные отчёты живут вместе, а /payments отвечает редиректом.
 */
export default async function ArtistReportsPage({ params }: { params: { username: string } }) {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")

  const artist = await prisma.user.findFirst({
    where: { username: params.username, role: "artist" },
    select: { id: true, name: true, mainArtistId: true },
  })
  if (!artist) notFound()

  if (!canViewArtistCabinet(session, artist)) notFound()

  const [reports, balance] = await Promise.all([
    getCachedArtistReports(artist.id),
    getArtistBalance(artist.id),
  ])

  return (
    <ArtistReports
      username={params.username}
      reports={reports as any}
      artistName={artist.name}
      title="ОТЧЁТЫ И ВЫПЛАТЫ"
      subtitle="Баланс, выплаты и квартальные отчёты."
      balance={balance}
    />
  )
}
