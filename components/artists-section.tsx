"use client"

import type React from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useMobileDetector } from "@/hooks/use-mobile-detector"
import MobileArtistsSlider from "./mobile-artists-slider"

interface ArtistsSectionProps {
  windowSize: {
    width: number
    height: number
  }
  mobileScale?: number // Добавляем проп для передачи масштаба
}

// Данные артистов
const artists = [
  {
    id: 1,
    name: "WIDE PIE",
    description: 'Релиз "blurred", выпущенный через ROSSEL 66, собрал более 200к прослушиваний в первую неделю',
    image: "/images/artists/wide_pie.png",
  },
  {
    id: 2,
    name: "PLVT",
    description:
      'Более 1500000 прослушиваний на треке "like you" и свыше 100000 ежемесячных слушателей на Яндекс Музыке',
    image: "/images/artists/artist.png",
  },
  {
    id: 3,
    name: "Sour Diesel",
    description: 'Более 1000000 прослушиваний на треке "Воспоминания"',
    image: "/images/artists/sour_diesel.webp",
  },
  {
    id: 4,
    name: "Здесь можешь быть ты!",
    description: "Заполни форму ниже и стань частью нашей команды",
    isSpecial: true,
    useQuestionMark: true,
  },
]

export default function ArtistsSection({ windowSize, mobileScale }: ArtistsSectionProps) {
  const isMobile = useMobileDetector()
  const [dynamicGridStyle, setDynamicGridStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    if (isMobile) {
      setDynamicGridStyle({ width: '100%' });
    } else {
      const DESKTOP_BASE_WIDTH = 1600; // Базовая ширина для Артистов
      const MIN_WIDTH = 540;
      const REFERENCE_WINDOW_WIDTH = 1350;

      let currentMaxWidth: number;

      if (windowSize.width >= REFERENCE_WINDOW_WIDTH) {
        currentMaxWidth = DESKTOP_BASE_WIDTH;
      } else if (windowSize.width < REFERENCE_WINDOW_WIDTH && windowSize.width > MIN_WIDTH) {
        const scaleFactor = windowSize.width / REFERENCE_WINDOW_WIDTH;
        const scaledWidth = DESKTOP_BASE_WIDTH * scaleFactor;
        currentMaxWidth = Math.max(MIN_WIDTH, scaledWidth);
      } else { 
        currentMaxWidth = MIN_WIDTH;
      }
      setDynamicGridStyle({ width: '100%', maxWidth: `${currentMaxWidth}px` });
    }
  }, [windowSize.width, isMobile]);

  if (isMobile) {
    return (
      <section
        id="artists"
        className="w-full min-h-screen flex items-center justify-center relative"
        style={{
          overflow: "visible",
          position: "relative",
          padding: 0,
          margin: 0,
          border: "none",
          background: "black",
        }}
      >
        <MobileArtistsSlider scale={mobileScale || 1} />
      </section>
    )
  }

  const titleSize = windowSize.width < 640 ? "text-3xl" : windowSize.width < 1024 ? "text-4xl" : "text-5xl"

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center py-12 sm:py-16">
      <div className="absolute inset-0 z-0">
        <div className="diagonal-lines"></div>
      </div>

      <div className="relative z-10 w-full px-4 sm:px-6 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-12 w-full"
        >
          <h2 className={`${titleSize} font-bold text-white mb-4`}>Наши артисты</h2>
          <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto mb-4 sm:mb-8"></div>
          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto mb-8">
            Мы гордимся нашими талантливыми артистами, которые уже добились успеха с нашей поддержкой
          </p>
        </motion.div>

        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 sm:gap-10 w-full mx-auto px-4 sm:px-8 md:px-12"
          style={dynamicGridStyle}
        >
          {artists.map((artist, index) => (
            <motion.div
              key={artist.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{
                scale: 1.03,
                transition: { duration: 0.3 },
              }}
              className={`artist-card overflow-hidden h-[240px] ${
                index % 2 === 0
                  ? "bg-emerald-500/20 hover:bg-gradient-to-br from-emerald-500/40 to-emerald-600/20"
                  : "bg-cyan-500/20 hover:bg-gradient-to-br from-cyan-500/40 to-cyan-600/20"
              } ${artist.isSpecial ? "border-emerald-500/50" : ""}`}
              style={
                {
                  "--mouse-x": "0px",
                  "--mouse-y": "0px",
                } as React.CSSProperties
              }
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                const y = e.clientY - rect.top
                e.currentTarget.style.setProperty("--mouse-x", `${x}px`)
                e.currentTarget.style.setProperty("--mouse-y", `${y}px`)
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: `radial-gradient(circle 200px at var(--mouse-x) var(--mouse-y), 
          ${index % 2 === 0 ? "rgba(16, 185, 129, 0.4)" : "rgba(6, 182, 212, 0.4)"} 0%, 
          transparent 80%)`,
                }}
              />

              <div className="flex flex-col md:flex-row h-full">
                <div className="relative h-full md:h-full md:w-2/5 overflow-hidden">
                  {artist.useQuestionMark ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500/30 to-cyan-500/30">
                      <div className="text-white text-9xl font-bold opacity-50">?</div>
                    </div>
                  ) : (
                    <Image
                      src={artist.image || "/placeholder.svg"}
                      alt={artist.name}
                      fill
                      className="object-cover transition-transform duration-500 hover:scale-110"
                    />
                  )}
                </div>
                <div className="p-5 md:w-3/5 flex flex-col justify-between relative z-10">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-3">{artist.name}</h3>
                    <p className="text-gray-300 text-sm">{artist.description}</p>
                  </div>

                  <div className="mt-3">
                    {!artist.isSpecial && (
                      <div className="inline-flex items-center text-emerald-400 text-xs">
                        <span className="mr-2 w-2 h-2 rounded-full bg-emerald-400"></span>
                        Активный артист
                      </div>
                    )}
                    {artist.isSpecial && (
                      <div className="inline-flex items-center text-cyan-400 text-xs">
                        <span className="mr-2 w-2 h-2 rounded-full bg-cyan-400"></span>
                        Присоединяйся к нам
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
