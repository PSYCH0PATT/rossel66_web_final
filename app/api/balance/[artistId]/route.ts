import { NextResponse } from "next/server"
import { getArtistBalance } from "@/lib/storage"

export async function GET(
  request: Request,
  { params }: { params: { artistId: string } }
) {
  try {
    const { artistId } = params
    
    if (!artistId) {
      return NextResponse.json(
        { error: "Artist ID is required" },
        { status: 400 }
      )
    }

    const balance = getArtistBalance(artistId)
    
    return NextResponse.json({
      success: true,
      balance
    })
  } catch (error) {
    console.error("Error getting artist balance:", error)
    return NextResponse.json(
      { error: "Error getting artist balance" },
      { status: 500 }
    )
  }
}





