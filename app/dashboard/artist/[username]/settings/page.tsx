import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { userFromPrisma } from "@/lib/storage-adapters"
import { getSessionUser } from "@/lib/server-auth"
import { canViewArtistCabinet } from "@/lib/artist-links"
import ArtistSettingsClient from "./artist-settings-client"

export default async function SettingsPage({ params }: { params: { username: string } }) {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")

  const row = await prisma.user.findFirst({
    where: { username: params.username, role: "artist" },
  })
  if (!row) notFound()

  const u = userFromPrisma(row)
  if (!canViewArtistCabinet(session, u)) {
    notFound()
  }

  const initialArtist = {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    avatarUrl: u.avatarUrl ?? null,
  }

  return (
    <ArtistSettingsClient initialArtist={initialArtist} />
    )
}
