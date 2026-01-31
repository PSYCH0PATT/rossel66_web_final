import { NextResponse } from "next/server"
import { addUser, getUserByUsername, loadUsers, assignReportsToNewArtist, updateUser, deleteUser, addActivity } from "@/lib/storage"
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
    const existingUser = getUserByUsername(username)
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
    const newUser = addUser({
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

    // Assign any existing unregistered reports to this artist
    assignReportsToNewArtist(newUser.id, name)

    addActivity({
      type: 'artist_added',
      userId: 'system',
      userRole: 'admin',
      title: 'Добавлен артист',
      description: `Артист "${newUser.name}" создан`,
      metadata: { artistId: newUser.id, artistName: newUser.name }
    })

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

export async function GET() {
  try {
    const users = loadUsers()
    const artists = users.filter(user => user.role === 'artist')
    
    return NextResponse.json({
      success: true,
      artists: artists.map(artist => ({
        id: artist.id,
        username: artist.username,
        // password НЕ возвращаем - используйте /api/auth/login для аутентификации
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
    const { id, username, password, name, email, vkMusicUrl, yandexMusicUrl, spotifyUrl, avatarUrl, fio, fioShort, contract, percentage } = data

    // Validate required field (only ID is required)
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const users = loadUsers()
    
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

    const updatedUser = updateUser(id, updateData)

    if (!updatedUser) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 })
    }

    addActivity({
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
    const users = loadUsers()
    const artist = users.find(user => user.id === artistId && user.role === 'artist')
    
    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 })
    }

    // Удаляем артиста
    deleteUser(artistId)

    addActivity({
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