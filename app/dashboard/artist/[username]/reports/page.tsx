"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import ArtistReports from "@/components/artist-reports"

interface Artist {
  id: string
  username: string
  name: string
  role: string
}

interface Report {
  id: string
  artistId: string
  artistName: string
  quarter: string
  year: number
  fileName: string
  uploadDate: string
  status: string
  totalPlays: number
  totalAmount: number
  isRegistered: boolean
}

export default function ArtistReportsPage({ params }: { params: { username: string } }) {
  const [artist, setArtist] = useState<Artist | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchArtistAndReports = async () => {
      try {
        // Получаем всех артистов
        const artistsResponse = await fetch('/api/artists')
        const artistsResult = await artistsResponse.json()
        
        if (artistsResult.success) {
          const foundArtist = artistsResult.artists.find((a: Artist) => a.username === params.username)
          
          if (foundArtist) {
            setArtist(foundArtist)
            
            // Получаем отчеты для этого артиста
            const reportsResponse = await fetch('/api/reports/quarters')
            const quartersResult = await reportsResponse.json()
            
            if (quartersResult.quarters) {
              const allReports: Report[] = []
              
              for (const quarter of quartersResult.quarters) {
                const quarterReportsResponse = await fetch(`/api/reports/list/${quarter}`)
                const quarterReportsResult = await quarterReportsResponse.json()
                
                if (quarterReportsResult.reports) {
                  // Фильтруем отчеты для этого артиста
                  const artistReports = quarterReportsResult.reports.filter(
                    (report: Report) => report.artistId === foundArtist.id
                  )
                  allReports.push(...artistReports)
                }
              }
              
              setReports(allReports)
            }
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных артиста:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchArtistAndReports()
  }, [params.username])

  if (loading) {
    return (
      <Layout role="artist" requiredRole="artist">
        <div className="text-center py-8 text-gray-400">Загрузка...</div>
      </Layout>
    )
  }

  if (!artist) {
    return (
      <Layout role="artist" requiredRole="artist">
        <div className="text-center py-8 text-gray-400">Артист не найден</div>
      </Layout>
    )
  }

  return (
    <Layout role="artist" requiredRole="artist">
      <ArtistReports reports={reports} artistName={artist.name} />
    </Layout>
  )
}
