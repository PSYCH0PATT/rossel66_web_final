import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCachedActivitiesForFeed } from "@/lib/cached-dashboard"
import { ActivityFeed } from "@/components/activity-feed"
import { PageHeader } from "@/components/ui/page-header"
import { getSessionUser } from "@/lib/server-auth"
import { canViewArtistCabinet } from "@/lib/artist-links"

/**
 * G9: у артиста не было страницы активности — ссылка «View All» под блоком
 * «Последняя активность» на дашборде вела в `href="#"`, то есть в никуда.
 * Артист видел только 5 последних событий и не мог посмотреть остальные.
 */
const ACTIVITY_LIMIT = 100

export default async function ArtistActivityPage({
  params,
}: {
  params: { username: string }
}) {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")

  const row = await prisma.user.findFirst({
    where: { username: params.username, role: "artist" },
    select: { id: true, mainArtistId: true },
  })
  if (!row) notFound()

  if (!canViewArtistCabinet(session, row)) {
    notFound()
  }

  const activities = await getCachedActivitiesForFeed(row.id, "artist", ACTIVITY_LIMIT)

  return (
    <div className="space-y-8">
      {/*
        Вердикт 3.10: счётчик «Показано событий: 14» из шапки убран — счётчик
        живёт в Pagination и только при нескольких страницах (F-21-паттерн);
        пустую ленту показывает EmptyState самой ленты. Подзаголовок обещал
        события «по выплатам», которых в ленте артиста нет вовсе.
      */}
      <PageHeader
        title="АКТИВНОСТЬ"
        subtitle="Статусы релизов, попадания в плейлисты и движение по отчётам."
      />

      <div className="card-glass rounded-2xl overflow-hidden border border-white/5">
        <ActivityFeed
          userId={row.id}
          role="artist"
          limit={ACTIVITY_LIMIT}
          initialActivities={activities}
        />
      </div>

      {/* F-30: единственный экран артиста, где футера не было. */}
    </div>
  )
}
