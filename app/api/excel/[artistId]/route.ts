import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { generateArtistExcelData, users } from "@/lib/data"

export async function GET(request: Request, { params }: { params: { artistId: string } }) {
  try {
    const artistId = params.artistId

    // Check if artist exists
    const artist = users.find((user) => user.id === artistId && user.role === "artist")
    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 })
    }

    // Generate Excel data
    const excelData = generateArtistExcelData(artistId)

    // Create workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(excelData)

    // Set column widths
    const colWidths = [
      { wch: 20 }, // Никнейм артиста
      { wch: 25 }, // Название релиза
      { wch: 25 }, // Название трека
      { wch: 15 }, // Дата
      { wch: 15 }, // UPC
      { wch: 15 }, // ISRC
      { wch: 10 }, // Длительность
      { wch: 15 }, // Статус
    ]
    worksheet["!cols"] = colWidths

    XLSX.utils.book_append_sheet(workbook, worksheet, "Релизы и треки")

    // Convert to buffer
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    // Return as downloadable file
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
