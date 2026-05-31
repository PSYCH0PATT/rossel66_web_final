import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"
import { prisma } from "@/lib/prisma"
import ReleasesClient from "./releases-client"

export default async function ArtistReleasesPage({ params }: { params: { username: string } }) {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")

  const artist = await prisma.user.findFirst({
    where: { username: params.username, role: "artist" },
    select: { id: true, name: true },
  })
  if (!artist) notFound()

  if (session.role === "artist" && session.id !== artist.id) notFound()

  return (
    <ReleasesClient
        artistId={artist.id}
        username={params.username}
        mainArtistName={artist.name}
      />
    )
}
