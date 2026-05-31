import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/server-auth"
import { prisma } from "@/lib/prisma"
import { getCachedArtistReports } from "@/lib/cached-dashboard"
import ArtistReports from "@/components/artist-reports"

export const revalidate = 600

export default async function ArtistReportsPage({ params }: { params: { username: string } }) {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")

  const artist = await prisma.user.findFirst({
    where: { username: params.username, role: "artist" },
    select: { id: true, name: true },
  })
  if (!artist) notFound()

  if (session.role === "artist" && session.id !== artist.id) notFound()

  const reports = await getCachedArtistReports(artist.id)

  return (
    <ArtistReports username={params.username} reports={reports as any} artistName={artist.name} />
    )
}
