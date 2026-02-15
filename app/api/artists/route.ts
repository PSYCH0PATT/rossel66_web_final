import { NextResponse } from "next/server"
import { addUser, getUserByUsername, loadUsers, assignReportsToNewArtist, assignReleasesToNewArtist, updateUser, deleteUser, addActivity } from "@/lib/storage"
import * as fs from "fs"
import * as path from "path"

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type")
    let username: string, password: string, name: string, email: string, avatarUrl: string | undefined
    let vkMusicUrl: string | undefined, yandexMusicUrl: string | undefined, spotifyUrl: string | undefined

    if (contentType?.includes("application/json")) {
      // Handle JSON data
      const data = await request.json()
      username = data.username
      password = data.password
      name = data.name
      email = data.email
      avatarUrl = data.avatarUrl
      vkMusicUrl = data.vkMusicUrl
      yandexMusicUrl = data.yandexMusicUrl
      spotifyUrl = data.spotifyUrl
    } else {
      // Handle FormData (legacy)
      const data = await request.formData()
      username = data.get("username") as string
      password = data.get("password") as string
      name = data.get("name") as string
      email = data.get("email") as string
      const avatar = data.get("avatar") as File | null
      
      // Save avatar if provided
      if (avatar) {
        const artistDir = path.join(process.cwd(), "data", "artists", username)
        fs.mkdirSync(artistDir, { recursive: true })
        const buffer = Buffer.from(await avatar.arrayBuffer())
        const avatarPath = path.join(artistDir, "avatar.jpg")
        fs.writeFileSync(avatarPath, new Uint8Array(buffer))
        avatarUrl = `/data/artists/${username}/avatar.jpg`
      }
    }

    // Validate required fields
    if (!username || !password || !name) {
      return NextResponse.json({ error: "Username, password and name are required" }, { status: 400 })
    }

    // Check if username already exists
    const existingUser = await getUserByUsername(username)
    if (existingUser) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 })
    }

    // Create artist directory structure
    const artistDir = path.join(process.cwd(), "data", "artists", username)
    const coversDir = path.join(artistDir, "covers")
    const playlistsDir = path.join(artistDir, "playlists")
    const reportsDir = path.join(artistDir, "reports")

    // Create directories
    fs.mkdirSync(artistDir, { recursive: true })
    fs.mkdirSync(coversDir, { recursive: true })
    fs.mkdirSync(playlistsDir, { recursive: true })
    fs.mkdirSync(reportsDir, { recursive: true })

    // Add user to database
    const newUser = await addUser({
      username,
      password,
      role: "artist",
      name,
      email: email || '',
      avatarUrl,
      vkMusicUrl,
      yandexMusicUrl,
      spotifyUrl,
    })

    // Auto-assign existing data to this artist by name matching
    const assignedReports = await assignReportsToNewArtist(newUser.id, name)
    const assignedReleases = await assignReleasesToNewArtist(newUser.id, name, username)
    
    // Try to assign playlists from SFTP database
    let assignedPlaylists = 0
    try {
      const { assignPlaylistsToArtist } = await import('@/lib/sftp-playlist-storage')
      assignedPlaylists = await assignPlaylistsToArtist(newUser.id, name, username)
    } catch (error) {
      console.error('Error assigning playlists:', error)
    }

    // Log artist creation
    await addActivity({
      type: 'artist_added',
      userId: 'system',
      userRole: 'admin',
      title: 'Добавлен артист',
      description: `Артист "${newUser.name}" создан`,
      metadata: { 
        artistId: newUser.id, 
        artistName: newUser.name,
        assignedReports,
        assignedReleases,
        assignedPlaylists
      }
    })
    
    // Log each assigned report
    if (assignedReports > 0) {
      await addActivity({
        type: 'report_received',
        userId: newUser.id,
        userRole: 'artist',
        title: 'Отчёты привязаны к артисту',
        description: `Автоматически привязано ${assignedReports} отчёт(ов) к артисту "${newUser.name}"`,
        metadata: { artistId: newUser.id, count: assignedReports }
      })
    }
    
    // Log each assigned release
    if (assignedReleases > 0) {
      await addActivity({
        type: 'release_added',
        userId: newUser.id,
        userRole: 'artist',
        title: 'Релизы привязаны к артисту',
        description: `Автоматически привязано ${assignedReleases} релиз(ов) к артисту "${newUser.name}"`,
        metadata: { artistId: newUser.id, count: assignedReleases }
      })
    }
    
    // Log each assigned playlist
    if (assignedPlaylists > 0) {
      await addActivity({
        type: 'playlist_found',
        userId: newUser.id,
        userRole: 'artist',
        title: 'Плейлисты привязаны к артисту',
        description: `Автоматически привязано ${assignedPlaylists} плейлист(ов) к артисту "${newUser.name}"`,
        metadata: { artistId: newUser.id, count: assignedPlaylists }
      })
    }

    return NextResponse.json({
      success: true,
      message: "Artist created successfully",
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        avatarUrl: newUser.avatarUrl,
      },
    })
  } catch (error) {
    console.error("Error creating artist:", error)
    return NextResponse.json(
      { error: `Error creating artist: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const verifiedParam = searchParams.get('verified')
    
    const users = await loadUsers()
    let artists = users.filter(user => user.role === 'artist')
    
    // Фильтр по статусу подтверждения
    if (verifiedParam !== null) {
      const isVerified = verifiedParam === 'true'
      artists = artists.filter(artist => (artist.verified ?? true) === isVerified)
    }
    
    return NextResponse.json({
      success: true,
      artists: artists.map(artist => ({
        id: artist.id,
        username: artist.username,
        password: artist.password,
        name: artist.name,
        email: artist.email,
        avatarUrl: artist.avatarUrl,
        vkMusicUrl: artist.vkMusicUrl,
        yandexMusicUrl: artist.yandexMusicUrl,
        spotifyUrl: artist.spotifyUrl,
        // Новые поля
        fio: artist.fio,
        fioShort: artist.fioShort,
        contract: artist.contract,
        percentage: artist.percentage,
        verified: artist.verified ?? true,
      }))
    })
  } catch (error) {
    console.error("Error loading artists:", error)
    return NextResponse.json(
      { error: "Error loading artists" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json()
    const { id, username, password, name, email, vkMusicUrl, yandexMusicUrl, spotifyUrl, avatarUrl, fio, fioShort, contract, percentage, verified } = data

    // Validate required field (only ID is required)
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const users = await loadUsers()
    
    // Check if username already exists (excluding current user) - only if username is being updated
    if (username) {
      const existingUser = users.find(user => user.username === username && user.id !== id)
      if (existingUser) {
        return NextResponse.json({ error: "Username already exists" }, { status: 400 })
      }
    }

    // Build update data object with only provided fields
    const updateData: any = {}
    
    if (username !== undefined) updateData.username = username
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email || ''
    if (vkMusicUrl !== undefined) updateData.vkMusicUrl = vkMusicUrl
    if (yandexMusicUrl !== undefined) updateData.yandexMusicUrl = yandexMusicUrl
    if (spotifyUrl !== undefined) updateData.spotifyUrl = spotifyUrl
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
    if (password !== undefined) updateData.password = password
    // Новые поля
    if (fio !== undefined) updateData.fio = fio
    if (fioShort !== undefined) updateData.fioShort = fioShort
    if (contract !== undefined) updateData.contract = contract
    if (percentage !== undefined) updateData.percentage = percentage
    if (verified !== undefined) updateData.verified = verified

    const updatedUser = await updateUser(id, updateData)

    if (!updatedUser) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 })
    }

    await addActivity({
      type: 'user_data_updated',
      userId: 'system',
      userRole: 'admin',
      title: 'Данные артиста обновлены',
      description: `Профиль артиста "${updatedUser.name}" был обновлен`,
      metadata: { artistId: updatedUser.id, artistName: updatedUser.name }
    })

    return NextResponse.json({
      success: true,
      message: "Artist updated successfully",
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatarUrl,
        vkMusicUrl: updatedUser.vkMusicUrl,
        yandexMusicUrl: updatedUser.yandexMusicUrl,
        spotifyUrl: updatedUser.spotifyUrl,
        // Новые поля
        fio: updatedUser.fio,
        fioShort: updatedUser.fioShort,
        contract: updatedUser.contract,
        percentage: updatedUser.percentage,
        verified: updatedUser.verified,
      },
    })
  } catch (error) {
    console.error("Error updating artist:", error)
    return NextResponse.json(
      { error: `Error updating artist: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const artistId = searchParams.get('id')

    if (!artistId) {
      return NextResponse.json({ error: "Artist ID is required" }, { status: 400 })
    }

    // Проверяем, существует ли артист
    const users = await loadUsers()
    const artist = users.find(user => user.id === artistId && user.role === 'artist')
    
    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 })
    }

    // Удаляем артиста
    await deleteUser(artistId)

    await addActivity({
      type: 'artist_removed',
      userId: 'system',
      userRole: 'admin',
      title: 'Артист удалён',
      description: `Артист "${artist.name}" удалён`,
      metadata: { artistId, artistName: artist.name }
    })

    console.log(`Артист ${artist.name} (${artistId}) успешно удален`)

    return NextResponse.json({
      success: true,
      message: "Artist deleted successfully",
      deletedArtist: {
        id: artist.id,
        name: artist.name,
        username: artist.username
      }
    })
  } catch (error) {
    console.error("Error deleting artist:", error)
    return NextResponse.json(
      { error: `Error deleting artist: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}