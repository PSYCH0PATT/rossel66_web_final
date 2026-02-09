import { NextResponse } from "next/server"
import { assignPlaylistToArtistManually } from "@/lib/sftp-playlist-storage"
import { addActivity, getUserById } from "@/lib/storage"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { playlistId, artistId } = body

    if (!playlistId || !artistId) {
      return NextResponse.json(
        { error: "Missing required fields: playlistId, artistId" },
        { status: 400 }
      )
    }

    // Assign playlist to artist
    const success = await assignPlaylistToArtistManually(playlistId, artistId)

    if (!success) {
      return NextResponse.json(
        { error: "Playlist not found or already assigned" },
        { status: 404 }
      )
    }

    // Get artist info for logging
    const artist = getUserById(artistId)
    
    // Log activity
    if (artist) {
      addActivity({
        type: 'playlist_found',
        userId: artistId,
        userRole: 'artist',
        title: 'Плейлист привязан к артисту',
        description: `Плейлист вручную привязан к артисту "${artist.name}"`,
        metadata: { 
          artistId, 
          playlistId,
          manual: true 
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: "Playlist assigned successfully"
    })
  } catch (error) {
    console.error('Error assigning playlist:', error)
    return NextResponse.json(
      { error: "Failed to assign playlist" },
      { status: 500 }
    )
  }
}
