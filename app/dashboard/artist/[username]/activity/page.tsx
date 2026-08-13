import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getCachedActivitiesForFeed } from "@/lib/cached-dashboard"
import { ActivityFeed } from "@/components/activity-feed"
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
    <div className="max-w-full p-0 pb-6 md:pb-0">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
          <Link
            href={`/dashboard/artist/${params.username}/dashboard`}
            className="hover:text-[#10b981] cursor-pointer transition-colors"
          >
            ДАШБОРД
          </Link>
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
            chevron_right
          </span>
          <span className="text-white">Активность</span>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
              АКТИВНОСТЬ
            </h1>
            <p className="text-sm text-gray-400 font-light max-w-md">
              События по вашим релизам, плейлистам, отчётам и выплатам.
            </p>
          </div>
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">
            {activities.length > 0
              ? `Показано событий: ${activities.length}`
              : "Событий пока нет"}
          </p>
        </div>
      </div>

      <div className="card-glass rounded-2xl overflow-hidden border border-white/5">
        <ActivityFeed
          userId={row.id}
          role="artist"
          limit={ACTIVITY_LIMIT}
          initialActivities={activities}
        />
      </div>
    </div>
  )
}
