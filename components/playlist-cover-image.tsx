"use client"

import Image, { type ImageProps } from "next/image"
import { useState } from "react"

/**
 * Обложка плейлиста с fallback на плейсхолдер при ошибке загрузки (I5).
 * Scraped-URL обложек могут истекать/404 — тогда показываем плейсхолдер платформы,
 * а не битую картинку.
 */
export function PlaylistCoverImage({
  src,
  fallbackSrc,
  alt,
  ...props
}: Omit<ImageProps, "src" | "onError"> & { src: string; fallbackSrc: string }) {
  const [current, setCurrent] = useState(src)
  return (
    <Image
      {...props}
      alt={alt}
      src={current}
      onError={() => {
        if (current !== fallbackSrc) setCurrent(fallbackSrc)
      }}
    />
  )
}
