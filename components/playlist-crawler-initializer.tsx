"use client"

import { useEffect } from "react"
import { startScheduledCrawling } from "@/lib/playlist-crawler"

export function PlaylistCrawlerInitializer() {
  useEffect(() => {
    // Запускаем автоматический парсинг плейлистов при загрузке приложения
    startScheduledCrawling(3) // Каждые 3 часа

    // Возвращаем функцию очистки, которая будет вызвана при размонтировании компонента
    return () => {
      // Здесь можно добавить код для остановки парсинга, если нужно
    }
  }, [])

  // Этот компонент не рендерит никакого UI
  return null
}
