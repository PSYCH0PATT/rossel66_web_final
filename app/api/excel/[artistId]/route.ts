import { NextResponse } from "next/server"
import { formatDateRu } from "@/lib/format-date"
import * as XLSX from "xlsx"
import { prisma } from "@/lib/prisma"
import { releaseFromPrisma, userFromPrisma } from "@/lib/storage-adapters"
import { getSessionUser, requireAuth } from "@/lib/server-auth"

export async function GET(request: Request, { params }: { params: { artistId: string } }) {
  const denied = await requireAuth(request)
  if (denied) return denied

  const session = getSessionUser()!
  const artistId = params.artistId

  if (session.role !== "admin" && session.id !== artistId) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 })
  }

  try {
    const userRow = await prisma.user.findUnique({ where: { id: artistId } })
    if (!userRow || userRow.role !== "artist") {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 })
    }

    const artist = userFromPrisma(userRow)
    const releaseRows = await prisma.release.findMany({
      where: { artistId },
      orderBy: { releaseDate: "desc" },
    })
    const releases = releaseRows.map(releaseFromPrisma)

    const excelData: Record<string, string | number | undefined>[] = []
    for (const release of releases) {
      for (const track of release.tracks) {
        excelData.push({
          "Никнейм артиста": artist.name,
          "Название релиза": release.title,
          "Название трека": track.title,
          Дата: formatDateRu(release.releaseDate),
          UPC: release.upc,
          ISRC: track.isrc || "Не присвоен",
          Длительность: track.duration,
          Статус: String(release.status ?? ""),
        })
      }
    }

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(excelData)

    const colWidths = [
      { wch: 20 },
      { wch: 25 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 15 },
    ]
    worksheet["!cols"] = colWidths

    XLSX.utils.book_append_sheet(workbook, worksheet, "Релизы и треки")

    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    return new Response(excelBuffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${artist.username}_tracks.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    })
  } catch (error) {
    console.error("Error generating Excel:", error)
    return NextResponse.json({ error: "Failed to generate Excel file" }, { status: 500 })
  }
}
