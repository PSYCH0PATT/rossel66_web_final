import { NextResponse } from "next/server"
import { assignPlaylistToArtistManually } from "@/lib/sftp-playlist-storage"
import { addActivity, getUserById } from "@/lib/storage"
import { requireAdmin } from "@/lib/server-auth"
import { revalidateArtistPlaylistsForArtistIds } from "@/lib/revalidate-artist-dashboard"

export async function POST(request: Request) {
  try {
    const denied = await requireAdmin(request)
    if (denied) return denied

    const body = await request.json()
    const { playlistId, artistId, force } = body

    if (!playlistId || !artistId) {
      return NextResponse.json(
        { error: "Missing required fields: playlistId, artistId" },
        { status: 400 }
      )
    }

    const result = await assignPlaylistToArtistManually(playlistId, artistId, {
      force: force === true,
    })

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 })
    }

    if (result.status === "error") {
      return NextResponse.json({ error: "Failed to assign playlist" }, { status: 500 })
    }

    if (result.status === "unchanged") {
      return NextResponse.json({
        success: true,
        unchanged: true,
        message: "Плейлист уже привязан к этому артисту",
      })
    }

    // H3: плейлист уже принадлежит другому артисту — не забираем молча,
    // возвращаем текущего владельца, чтобы админ подтвердил переназначение.
    if (result.status === "needs_confirmation") {
      const previousOwner = await getUserById(result.previousArtistId)
      return NextResponse.json(
        {
          error: "Playlist already assigned",
          needsConfirmation: true,
          previousArtistId: result.previousArtistId,
          previousArtistName: previousOwner?.name ?? "другой артист",
        },
        { status: 409 }
      )
    }

    const artist = await getUserById(artistId)
    const previousOwner = result.previousArtistId
      ? await getUserById(result.previousArtistId)
      : null

    // Log activity
    if (artist) {
      await addActivity({
        type: 'playlist_found',
        userId: artistId,
        userRole: 'artist',
        title: previousOwner ? 'Плейлист переназначен' : 'Плейлист привязан к артисту',
        description: previousOwner
          ? `Плейлист переназначен с «${previousOwner.name}» на «${artist.name}»`
          : `Плейлист вручную привязан к артисту «${artist.name}»`,
        metadata: {
          artistId,
          playlistId,
          manual: true,
          ...(previousOwner ? { previousArtistId: previousOwner.id } : {}),
        }
      })
    }

    // H2: сбрасываем кэш и новому, и прежнему владельцу — иначе новый плейлист
    // не появлялся у артиста, а бывший владелец продолжал его видеть.
    await revalidateArtistPlaylistsForArtistIds([artistId, result.previousArtistId])

    return NextResponse.json({
      success: true,
      message: "Playlist assigned successfully",
      reassignedFrom: previousOwner?.name ?? null,
    })
  } catch (error) {
    console.error('Error assigning playlist:', error)
    return NextResponse.json(
      { error: "Failed to assign playlist" },
      { status: 500 }
    )
  }
}
