import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"
import { canViewArtistCabinet, getArtistGroup } from "@/lib/artist-links"
import { prisma } from "@/lib/prisma"
import DashboardShell from "@/components/dashboard-shell"
import type { DashboardProfile } from "@/components/dashboard-user-context"

export default async function ArtistDashboardRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { username: string }
}) {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")

  const artist = await prisma.user.findFirst({
    where: { username: params.username, role: "artist" },
    select: { id: true, username: true, name: true, avatarUrl: true, mainArtistId: true },
  })
  if (!artist) notFound()

  if (!canViewArtistCabinet(session, artist)) {
    notFound()
  }

  const profile: DashboardProfile = {
    id: session.id,
    username: session.username,
    name: session.username === artist.username ? artist.name : session.username,
    avatarUrl: session.id === artist.id ? artist.avatarUrl : null,
    role: session.role,
  }

  if (session.role === "artist") {
    profile.name = artist.name
    profile.avatarUrl = artist.avatarUrl
  } else {
    const adminRow = await prisma.user.findUnique({
      where: { id: session.id },
      select: { name: true, avatarUrl: true },
    })
    if (adminRow) {
      profile.name = adminRow.name || session.username
      profile.avatarUrl = adminRow.avatarUrl
    }
  }

  // Переключатель профилей: главный видит свои привязанные профили (AKA) и может
  // открыть кабинет любого из них. У привязанного профиля группа состоит из него
  // одного — связь односторонняя.
  const group = session.role === "artist" ? await getArtistGroup(session.id) : []
  profile.viewedArtistId = artist.id
  profile.profiles = group.map((member) => ({
    id: member.id,
    username: member.username,
    name: member.name,
    isMain: member.mainArtistId == null,
  }))

  return (
    <DashboardShell
      role={session.role}
      requiredRole={session.role === "artist" ? "artist" : undefined}
      username={params.username}
      profile={profile}
    >
      {children}
    </DashboardShell>
  )
}
