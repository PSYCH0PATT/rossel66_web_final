"use client"

import { useState, useEffect } from "react"
import { formatDateRu } from "@/lib/format-date"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import { Banner } from "@/components/ui/banner"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { ReleaseStatusBadge } from "@/components/ui/status-badge"
import { releaseTrackCount } from "@/lib/release-status"
import { Spinner } from "@/components/ui/spinner"

export default function ArtistReleasesPage({ params }: { params: { id: string } }) {
  const artistId = params.id
  const [artist, setArtist] = useState<any>(null)
  const [artistReleases, setArtistReleases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    const fetchArtistAndReleases = async () => {
      try {
        const artistsRes = await fetch(
          `/api/artists?id=${encodeURIComponent(artistId)}`
        )
        const artistsData = await artistsRes.json()
        if (!artistsData.success || cancelled) return

        const foundArtist = artistsData.artists?.[0]
        if (!foundArtist) {
          setError("Артист не найден")
          return
        }

        setArtist(foundArtist)

        const releasesRes = await fetch(`/api/releases/artist/${artistId}`)
        const releasesData = await releasesRes.json()
        if (cancelled) return
        if (releasesData.success && Array.isArray(releasesData.releases)) {
          setArtistReleases(releasesData.releases)
        } else {
          setArtistReleases([])
        }
      } catch (e) {
        if (!cancelled) {
          setError("Ошибка загрузки данных")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchArtistAndReleases()
    return () => { cancelled = true }
  }, [artistId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      )
  }

  if (error) {
    return (
      
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/admin/artists"
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-base" aria-hidden>arrow_back</span>
              <span>Назад к списку артистов</span>
            </Link>
          </div>

          <Banner variant="danger">{error}</Banner>
        </div>
      )
  }

  return (
    
      <div className="space-y-8">
        <PageHeader
          backHref="/dashboard/admin/artists"
          backLabel="Назад к списку артистов"
          title={`Релизы артиста: ${artist?.name ?? ""}`}
          rowClassName="sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:items-center"
          actions={
            <Button>
              <span className="material-symbols-outlined text-lg mr-2" aria-hidden>add</span>
              Добавить релиз
            </Button>
          }
        />

        {artistReleases.length === 0 ? (
          /* F-25: одно действие на экран — CTA осталась в шапке. */
          <div className="card-glass rounded-2xl border border-white/5">
            <EmptyState
              icon="library_music"
              title="Нет релизов"
              description="У этого артиста пока нет релизов"
            />
          </div>
        ) : (
          <div className="releases-grid">
            {artistReleases.map((release) => (
              <div key={release.id} className="card-glass overflow-hidden rounded-2xl border border-white/5 text-white">
                <div className="aspect-square relative">
                  <Image
                    src={release.coverUrl || "/placeholder.svg"}
                    alt={release.title}
                    fill
                    className="object-cover"
                  />
                  {/* C-15/F-23: раньше подпись собиралась локальной картой из четырёх
                      английских ключей и на реальных статусах пилюля оставалась пустой. */}
                  <ReleaseStatusBadge
                    className="absolute top-2 right-2"
                    status={release.status}
                    trackCount={releaseTrackCount(release.tracks)}
                  />
                </div>
                <div className="p-4">
                  <h2 className="text-lg font-bold mb-1">{release.title}</h2>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-gray-400" aria-hidden>barcode</span>
                      <span className="text-gray-300">UPC: {release.upc}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-gray-400" aria-hidden>calendar_today</span>
                      <span className="text-gray-300">Дата: {formatDateRu(release.releaseDate)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-gray-400" aria-hidden>music_note</span>
                      <span className="text-gray-300">Треков: {release.tracks?.length ?? 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-4">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/admin/artists/${artistId}/releases/${release.id}`}>
                        <span className="material-symbols-outlined text-base mr-2" aria-hidden>edit</span>
                        Редактировать
                      </Link>
                    </Button>

                    <Button
                      variant="destructive-outline"
                      size="icon"
                      className="h-9 w-9"
                      aria-label={`Удалить ${release.title}`}
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden>delete</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
}
