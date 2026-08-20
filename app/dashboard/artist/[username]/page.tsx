"use client"

import { useState, useEffect } from "react"
import { formatDateRu } from "@/lib/format-date"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { DashboardFooter } from "@/components/dashboard-footer"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader, SectionHeaderLink } from "@/components/ui/section-header"
import { Spinner } from "@/components/ui/spinner"

type ReleasePreview = {
  id: string
  title: string
  coverUrl?: string | null
  releaseDate: string
}

/**
 * F-72: у кнопки площадки было ДВЕ иконки — платформенная слева и «открыть во
 * внешнем» справа. Осталась одна, та, что говорит о поведении ссылки.
 */
function PlatformLink({
  href,
  label,
  className,
}: {
  href: string
  label: string
  className: string
}) {
  return (
    <Button asChild variant="outline" size="sm" className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
        <span className="material-symbols-outlined text-sm" aria-hidden>
          open_in_new
        </span>
      </a>
    </Button>
  )
}

export default function ArtistProfilePage({ params }: { params: { username: string } }) {
  const [artist, setArtist] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [releases, setReleases] = useState<ReleasePreview[]>([])

  useEffect(() => {
    const fetchArtistData = async () => {
      try {
        const usersResponse = await fetch(
          `/api/users?username=${encodeURIComponent(params.username)}&role=artist`
        )
        const usersResult = await usersResponse.json()

        if (usersResult.success) {
          const foundArtist = usersResult.users?.[0]

          if (foundArtist) {
            setArtist(foundArtist)
            const relRes = await fetch(
              `/api/releases?artistId=${encodeURIComponent(foundArtist.id)}&page=1&pageSize=4`
            )
            const relJson = await relRes.json()
            if (relJson.success && Array.isArray(relJson.releases)) {
              setReleases(
                relJson.releases.slice(0, 4).map((r: any) => ({
                  id: r.id,
                  title: r.title,
                  coverUrl: r.coverUrl,
                  releaseDate: r.releaseDate,
                }))
              )
            } else {
              setReleases([])
            }
          }
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных артиста:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchArtistData()
  }, [params.username])

  if (!loading && !artist) {
    notFound()
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size="lg" label="Загрузка…" />
      </div>
    )
  }

  const releasesHref = `/dashboard/artist/${params.username}/releases`
  const playlistsHref = `/dashboard/artist/${params.username}/playlists`

  return (
    <div className="p-0 md:p-0 max-w-full pb-6 md:pb-0">
      <PageHeader
        className="mb-8"
        title={artist.name}
        subtitle="Публичная карточка и быстрые ссылки на релизы и плейлисты."
      />

      <div className="flex flex-col lg:flex-row gap-8 mb-12">
        <div className="w-full lg:w-1/3">
          <div className="card-glass rounded-2xl border border-white/5 p-8 text-center">
            <div className="relative w-24 h-24 rounded-full border-2 border-primary/50 overflow-hidden mx-auto mb-4">
              {artist.avatarUrl ? (
                artist.avatarUrl.startsWith("data:") ? (
                  <img src={artist.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Image src={artist.avatarUrl} alt="" fill className="object-cover" sizes="96px" />
                )
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white font-display">{artist.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <p className="text-xl font-bold text-white">{artist.name}</p>
            {artist.email && <p className="text-sm text-gray-400 mt-2 break-all">{artist.email}</p>}

            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {artist.vkMusicUrl && (
                <PlatformLink
                  href={artist.vkMusicUrl}
                  label="VK"
                  className="border-white/10 text-xs text-blue-400 hover:text-blue-400"
                />
              )}
              {artist.yandexMusicUrl && (
                <PlatformLink
                  href={artist.yandexMusicUrl}
                  label="Яндекс"
                  className="border-white/10 text-xs text-yellow-400 hover:text-yellow-400"
                />
              )}
              {artist.spotifyUrl && (
                <PlatformLink
                  href={artist.spotifyUrl}
                  label="Spotify"
                  className="border-white/10 text-xs text-emerald-400 hover:text-emerald-400"
                />
              )}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-2/3 space-y-8">
          <div>
            <SectionHeader
              className="mb-4"
              title="Последние релизы"
              action={
                <SectionHeaderLink asChild>
                  <Link href={releasesHref}>Все релизы</Link>
                </SectionHeaderLink>
              }
            />
            <div className="card-glass rounded-2xl border border-white/5 p-4 md:p-6">
              {releases.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {releases.map((release) => (
                    <Link
                      key={release.id}
                      href={`/dashboard/artist/${params.username}/releases/${release.id}`}
                      className="group flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:bg-white/5 hover:border-primary/20 transition-all min-w-0"
                    >
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                        <Image
                          src={release.coverUrl || "/placeholder.svg"}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white text-sm truncate transition-colors group-hover:text-brand">
                          {release.title}
                        </p>
                        <p className="text-[10px] font-mono text-gray-500 tabular-nums">
                          {formatDateRu(release.releaseDate)}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-gray-600 group-hover:text-white text-sm flex-shrink-0">
                        chevron_right
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState icon="album" title="Нет релизов" />
              )}
            </div>
          </div>

          <div>
            <SectionHeader
              className="mb-4"
              title="Плейлисты"
              accent="azure"
              action={
                <SectionHeaderLink asChild>
                  <Link href={playlistsHref}>Все плейлисты</Link>
                </SectionHeaderLink>
              }
            />
            {/*
              F-25: раньше в блоке было ДВА входа в один и тот же раздел —
              ссылка «Все плейлисты» в заголовке и кнопка «Перейти к плейлистам»
              внутри. EmptyState держит одно действие; вход остался в заголовке.
            */}
            <div className="card-glass rounded-2xl border border-white/5">
              <EmptyState
                icon="queue_music"
                title="Смотрите плейлисты"
                description="Полный список — на отдельной странице."
              />
            </div>
          </div>
        </div>
      </div>

      <DashboardFooter role="artist" />
    </div>
  )
}
