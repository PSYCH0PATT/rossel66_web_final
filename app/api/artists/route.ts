import { NextResponse } from "next/server"
import { isHashedPassword, verifyPassword } from "@/lib/password"
import type { Prisma } from "@prisma/client"
import { addUser, getUserByUsername, assignReportsToNewArtist, assignReleasesToNewArtist, updateUser, deleteUser, addActivity, getReleasesByArtistId } from "@/lib/storage"
import { prisma } from "@/lib/prisma"
import * as path from "path"
import { supabase, ensureBucketExists } from "@/lib/supabase"
import { requireAdmin, requireSelfOrAdmin, getSessionUser } from "@/lib/server-auth"
import { artistPostSchema, artistPutSchema } from "@/lib/api-schemas"
import {
  getArtistReportMissingFields,
  type IncompleteReportArtist,
} from "@/lib/artist-report-requirements"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const contentType = request.headers.get("content-type")
    let username: string, password: string, name: string, email: string, avatarUrl: string | undefined
    let vkMusicUrl: string | undefined, yandexMusicUrl: string | undefined, spotifyUrl: string | undefined
    let fio: string | undefined, fioShort: string | undefined, contract: string | undefined
    let percentage: number | undefined

    if (contentType?.includes("application/json")) {
      // Handle JSON data
      const data = await request.json()
      const parsed = artistPostSchema.safeParse(data)
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Некорректные данные", details: parsed.error.flatten() },
          { status: 400 }
        )
      }
      username = parsed.data.username
      password = parsed.data.password
      name = parsed.data.name
      email = parsed.data.email ?? ''
      avatarUrl = parsed.data.avatarUrl
      vkMusicUrl = parsed.data.vkMusicUrl
      yandexMusicUrl = parsed.data.yandexMusicUrl
      spotifyUrl = parsed.data.spotifyUrl
      fio = parsed.data.fio
      fioShort = parsed.data.fioShort
      contract = parsed.data.contract
      percentage = parsed.data.percentage
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
        const buffer = Buffer.from(await avatar.arrayBuffer())
        const ext = path.extname(avatar.name || '').toLowerCase() || '.jpg'
        const filename = `${username}_avatar_${Date.now()}${ext}`
        
        await ensureBucketExists('avatars', true)
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filename, buffer, {
            contentType: avatar.type || 'image/jpeg',
            cacheControl: '3600',
            upsert: true
          })
          
        if (uploadError) {
          console.error('Supabase avatar upload error:', uploadError)
        } else {
          const { data } = supabase.storage.from('avatars').getPublicUrl(filename)
          avatarUrl = data.publicUrl
        }
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
      fio,
      fioShort,
      contract,
      percentage,
      // G7: артиста завёл админ вручную — он сразу подтверждён.
      // Раньше это полагалось на @default(true) в схеме, то есть было неявным:
      // любой новый путь создания молча получал verified=true. Парсеры,
      // наоборот, ставят verified=false — их артисты ждут подтверждения
      // во вкладке «Новые».
      verified: true,
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

    let assignedAnalytics = { aliasesCreated: 0, rowsUpdated: 0 }
    try {
      const { assignAnalyticsToArtist } = await import('@/lib/analytics-artist-match')
      assignedAnalytics = await assignAnalyticsToArtist(newUser.id, [name, username])
    } catch (error) {
      console.error('Error assigning analytics:', error)
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
        assignedPlaylists,
        assignedAnalytics,
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
    
    // Log each assigned release (one notification per release)
    if (assignedReleases > 0) {
      const artistReleases = await getReleasesByArtistId(newUser.id)
      for (const release of artistReleases) {
        // Уведомление для артиста
        await addActivity({
          type: 'release_added',
          userId: newUser.id,
          userRole: 'artist',
          title: 'Добавлен релиз',
          description: `Добавлен релиз "${release.title}"`,
          metadata: { artistId: newUser.id, releaseId: release.id, releaseTitle: release.title }
        })
        
        // Уведомление для админа
        await addActivity({
          type: 'release_added',
          userId: 'system',
          userRole: 'admin',
          title: 'Добавлен релиз',
          description: `Добавлен релиз "${release.title}" (артист: ${newUser.name || newUser.username})`,
          metadata: { artistId: newUser.id, artistName: newUser.name, releaseId: release.id, releaseTitle: release.title }
        })
      }
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

    try {
      const { enqueueArtistSync } = await import("@/lib/buildin/sync-hooks")
      await enqueueArtistSync({
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        verified: newUser.verified,
        vkMusicUrl: newUser.vkMusicUrl,
        yandexMusicUrl: newUser.yandexMusicUrl,
        spotifyUrl: newUser.spotifyUrl,
      })
    } catch (err) {
      console.error("Buildin artist sync enqueue failed:", err)
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

const ARTIST_PAGE_SIZES = new Set([20, 50, 100])

export async function GET(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)

    const artistSelect = {
      id: true,
      username: true,
      name: true,
      email: true,
      avatarUrl: true,
      vkMusicUrl: true,
      yandexMusicUrl: true,
      spotifyUrl: true,
      fio: true,
      fioShort: true,
      contract: true,
      percentage: true,
      verified: true,
      mainArtistId: true,
    } as const

    const idParam = searchParams.get("id")?.trim()
    const incompleteReportData =
      searchParams.get("incompleteReportData") === "1" ||
      searchParams.get("missingContract") === "1"

    if (incompleteReportData) {
      const rows = await prisma.user.findMany({
        where: { role: "artist" },
        orderBy: { name: "asc" },
        select: artistSelect,
      })
      const incomplete: IncompleteReportArtist[] = rows
        .map((artist) => {
          const missingFields = getArtistReportMissingFields(artist)
          if (missingFields.length === 0) return null
          return {
            id: artist.id,
            name: artist.name,
            username: artist.username,
            missingFields,
          }
        })
        .filter((row): row is IncompleteReportArtist => row !== null)

      return NextResponse.json({
        success: true,
        artists: incomplete,
        total: incomplete.length,
        page: 1,
        pageSize: incomplete.length,
        incompleteReportData: true,
        /** @deprecated use incompleteReportData */
        missingContract: true,
      })
    }

    if (searchParams.get("forPicker") === "1") {
      const artists = await prisma.user.findMany({
        where: { role: "artist" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, username: true, mainArtistId: true },
        take: 500,
      })
      return NextResponse.json({
        success: true,
        artists,
        total: artists.length,
        forPicker: true,
      })
    }

    if (idParam) {
      // J1: карточка одного артиста — отдаём пароль, чтобы админ мог зайти в
      // профиль. Только этот путь (роут целиком под requireAdmin); в списках
      // пароль не отдаётся. Для legacy-bcrypt показать нечего — сообщаем это.
      const row = await prisma.user.findFirst({
        where: { id: idParam, role: "artist" },
        select: { ...artistSelect, password: true },
      })
      if (!row) {
        return NextResponse.json({ success: false, error: "Артист не найден" }, { status: 404 })
      }
      const { password: storedPassword, ...publicFields } = row
      const artist = {
        ...publicFields,
        verified: row.verified ?? true,
        password: isHashedPassword(storedPassword) ? null : storedPassword,
        passwordIsHashed: isHashedPassword(storedPassword),
      }
      const isUnverified = artist.verified === false
      return NextResponse.json({
        success: true,
        artists: [artist],
        total: 1,
        page: 1,
        pageSize: 1,
        stats: {
          all: 1,
          verified: isUnverified ? 0 : 1,
          unverified: isUnverified ? 1 : 0,
        },
      })
    }

    const verifiedParam = searchParams.get("verified")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
    const rawPs = parseInt(searchParams.get("pageSize") || "20", 10)
    const pageSize = ARTIST_PAGE_SIZES.has(rawPs) ? rawPs : 20
    const q = (searchParams.get("q") || "").trim()

    const searchWhere: Prisma.UserWhereInput | undefined =
      q.length > 0
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined

    const where: Prisma.UserWhereInput = {
      role: "artist",
      ...(verifiedParam !== null ? { verified: verifiedParam === "true" } : {}),
      ...(searchWhere ?? {}),
    }

    const baseArtistWhere: Prisma.UserWhereInput = {
      role: "artist",
      ...(searchWhere ?? {}),
    }

    const skip = (page - 1) * pageSize

    const [artists, total, statsAll, statsVerified, statsUnverified] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "asc" },
        select: artistSelect,
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: baseArtistWhere }),
      prisma.user.count({ where: { ...baseArtistWhere, verified: true } }),
      prisma.user.count({ where: { ...baseArtistWhere, verified: false } }),
    ])

    return NextResponse.json({
      success: true,
      artists: artists.map((artist) => ({
        ...artist,
        verified: artist.verified ?? true,
      })),
      total,
      page,
      pageSize,
      stats: {
        all: statsAll,
        verified: statsVerified,
        unverified: statsUnverified,
      },
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
    const parsed = artistPutSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные", details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const session = getSessionUser()
    if (!session) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }
    const deniedPut = await requireSelfOrAdmin(request, parsed.data.id)
    if (deniedPut) return deniedPut
    const {
      id,
      username,
      password,
      currentPassword,
      name,
      email,
      vkMusicUrl,
      yandexMusicUrl,
      spotifyUrl,
      avatarUrl,
      fio,
      fioShort,
      contract,
      percentage,
      verified,
    } = parsed.data

    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: { username, NOT: { id } },
      })
      if (existingUser) {
        return NextResponse.json({ error: "Username already exists" }, { status: 400 })
      }
    }

    if (password !== undefined) {
      const existingUser = await prisma.user.findUnique({ where: { id } })
      if (!existingUser) {
        return NextResponse.json({ error: "Artist not found" }, { status: 404 })
      }
      // Текущий пароль обязателен при смене СВОЕГО пароля (в т.ч. для админа).
      // Админ может сбросить пароль ДРУГОМУ пользователю без currentPassword.
      const isSelfChange = session.id === id
      if (session.role !== "admin" || isSelfChange) {
        if (!currentPassword) {
          return NextResponse.json(
            { error: "Для смены пароля укажите текущий пароль" },
            { status: 400 }
          )
        }
        // J1: открытый текст или legacy-bcrypt (см. lib/password.ts)
        const match = await verifyPassword(currentPassword, existingUser.password)
        if (!match) {
          return NextResponse.json({ error: "Неверный текущий пароль" }, { status: 401 })
        }
      }
    }

    // Build update data object with only provided fields
    const updateData: Record<string, unknown> = {}
    
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
    if (verified !== undefined && session.role === "admin") updateData.verified = verified

    const updatedUser = await updateUser(id, updateData as Parameters<typeof updateUser>[1])

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

    try {
      const { enqueueArtistSync } = await import("@/lib/buildin/sync-hooks")
      await enqueueArtistSync({
        id: updatedUser.id,
        name: updatedUser.name,
        username: updatedUser.username,
        email: updatedUser.email,
        verified: updatedUser.verified,
        vkMusicUrl: updatedUser.vkMusicUrl,
        yandexMusicUrl: updatedUser.yandexMusicUrl,
        spotifyUrl: updatedUser.spotifyUrl,
      })
    } catch (err) {
      console.error("Buildin artist sync enqueue failed:", err)
    }

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
  const deniedDel = await requireAdmin(request)
  if (deniedDel) return deniedDel

  try {
    const { searchParams } = new URL(request.url)
    const artistId = searchParams.get('id')

    if (!artistId) {
      return NextResponse.json({ error: "Artist ID is required" }, { status: 400 })
    }

    const artist = await prisma.user.findFirst({
      where: { id: artistId, role: "artist" },
    })

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