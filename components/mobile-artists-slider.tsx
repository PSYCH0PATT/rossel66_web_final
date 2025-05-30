"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

interface MobileArtistsSliderProps {
  scale?: number
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
    image: "/images/artists/sour_diesel.jpeg",
  },
  {
    id: 4,
    name: "Здесь можешь быть ты!",
    description: "Заполни форму ниже и стань частью нашей команды",
    isSpecial: true,
    useQuestionMark: true,
  },
]

export default function MobileArtistsSlider({ scale = 1 }: MobileArtistsSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)

  // Рассчитываем ширину слайдера с учетом масштаба (КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ)
  const widthMultiplier = Math.min(1 / scale, 2) // Ограничиваем максимальное увеличение до 2x
  const marginOffset = `${(widthMultiplier - 1) * 50}%`

  // Отладочные логи (только для текущей отладки)
  console.log('MobileArtistsSlider scale:', scale, 'widthMultiplier:', widthMultiplier)

  // Обработчики свайпа
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      // Свайп влево
      nextSlide()
    }

    if (touchStart - touchEnd < -75) {
      // Свайп вправо
      prevSlide()
    }
  }

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === artists.length - 1 ? 0 : prev + 1))
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? artists.length - 1 : prev - 1))
  }

  // Автоматическая смена слайдов
  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide()
    }, 5000)

    return () => clearInterval(interval)
  }, [currentSlide])

  return (
    <div
      className="mobile-artists-slider w-full min-h-screen flex items-center justify-center"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: `${widthMultiplier * 100}vw`,
        maxWidth: `${widthMultiplier * 100}vw`,
        margin: 0,
        padding: 0,
        marginLeft: `-${marginOffset}`,
        marginRight: `-${marginOffset}`,
        transition: "width 0.3s ease, margin 0.3s ease",
        background: "black",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Фоновое изображение */}
      <div className="absolute inset-0 z-0">
        <div className="relative w-full h-full">
          <AnimatePresence initial={false}>
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              {artists[currentSlide].useQuestionMark ? (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500/30 to-cyan-500/30">
                  <div className="text-white text-9xl font-bold opacity-50">?</div>
                </div>
              ) : (
                <Image
                  src={artists[currentSlide].image || "/placeholder.svg"}
                  alt={artists[currentSlide].name}
                  fill
                  className="object-cover"
                  priority
                />
              )}
              {/* Используем точно такой же оверлей, как в секции "Сервисы" */}
              <div className="absolute inset-0 bg-black/50"></div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Контент слайдера */}
      <div className="relative z-10 h-full w-full">
        {/* Фиксированный контейнер для текста, привязанный к левому краю */}
        <div className="absolute left-6 bottom-24 w-full max-w-md">
          {/* Заголовок секции */}
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">Наши артисты</h2>

          {/* Зеленая линия под заголовком */}
          <div className="w-16 h-1 bg-emerald-500 mb-8"></div>

          {/* Информация о текущем артисте - с фиксированным положением */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-white"
            >
              <h3 className="text-4xl sm:text-5xl font-bold mb-4">{artists[currentSlide].name}</h3>
              <div className="h-24">
                {" "}
                {/* Фиксированная высота для описания */}
                <p className="text-lg sm:text-xl text-gray-100">{artists[currentSlide].description}</p>
              </div>

              <div className="mt-4">
                {!artists[currentSlide].isSpecial ? (
                  <div className="inline-flex items-center text-emerald-400 text-sm">
                    <span className="mr-2 w-2 h-2 rounded-full bg-emerald-400"></span>
                    Активный артист
                  </div>
                ) : (
                  <div className="inline-flex items-center text-cyan-400 text-sm">
                    <span className="mr-2 w-2 h-2 rounded-full bg-cyan-400"></span>
                    Присоединяйся к нам
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Индикаторы слайдов без стрелок */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <div className="flex space-x-2">
            {artists.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-8 h-1 rounded-full transition-all duration-300 ${
                  index === currentSlide ? "bg-white w-12" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
