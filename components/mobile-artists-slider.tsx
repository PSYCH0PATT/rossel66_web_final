"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
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
  const sliderRef = useRef<HTMLDivElement>(null)

  // Рассчитываем ширину слайдера с учетом масштаба (КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ)
  const widthMultiplier = Math.min(1 / scale, 2) // Ограничиваем максимальное увеличение до 2x
  const marginOffset = `${(widthMultiplier - 1) * 50}%`

  // Принудительная проверка и исправление высоты слайдера
  const forceHeightCorrection = () => {
    if (sliderRef.current && typeof window !== 'undefined' && window.innerWidth < 768) {
      const expectedHeight = window.innerHeight * 2
      
      // Фокусируемся только на коррекции родительского контейнера
      const artistsSection = document.getElementById('artists')
      if (artistsSection) {
        artistsSection.style.height = `${expectedHeight}px`
        artistsSection.style.minHeight = `${expectedHeight}px`
        artistsSection.style.overflow = 'visible'
        artistsSection.style.position = 'relative'
        
        // Убеждаемся, что секция имеет правильные классы
        if (!artistsSection.classList.contains('flex')) {
          artistsSection.classList.add('flex')
        }
        if (!artistsSection.classList.contains('items-center')) {
          artistsSection.classList.add('items-center')
        }
        if (!artistsSection.classList.contains('justify-center')) {
          artistsSection.classList.add('justify-center')
        }
      }
      
      // Принудительно устанавливаем высоту слайдера
      sliderRef.current.style.height = `${expectedHeight}px`
      sliderRef.current.style.minHeight = `${expectedHeight}px`
      
      // Для слайдера убеждаемся, что классы центрирования есть
      if (!sliderRef.current.classList.contains('flex')) {
        sliderRef.current.classList.add('flex')
      }
      if (!sliderRef.current.classList.contains('items-center')) {
        sliderRef.current.classList.add('items-center')
      }
      if (!sliderRef.current.classList.contains('justify-center')) {
        sliderRef.current.classList.add('justify-center')
      }
      
      // Только сброс transform, без position свойств
      sliderRef.current.style.transform = 'none'
      
      console.log(`MobileArtistsSlider: Height correction applied - ${expectedHeight}px`)
    } else if (sliderRef.current && typeof window !== 'undefined') {
      // Для десктопа, просто сбрасываем стили, которые могли быть применены ранее
      const artistsSection = document.getElementById('artists');
      if (artistsSection) {
        artistsSection.style.height = ''
        artistsSection.style.minHeight = ''
        // artistsSection.style.overflow = '' // Оставим, т.к. может быть нужно
        // artistsSection.style.position = '' // Оставим, т.к. может быть нужно
      }
      sliderRef.current.style.height = ''
      sliderRef.current.style.minHeight = ''
      sliderRef.current.style.transform = ''
      console.log('MobileArtistsSlider: Desktop mode, styles reset');
    }
  }

  // Отладочные логи (только для текущей отладки)
  console.log('MobileArtistsSlider scale:', scale, 'widthMultiplier:', widthMultiplier)

  // Эффект для принудительной коррекции высоты при монтировании и изменении размера
  useEffect(() => {
    // Немедленная проверка
    const immediateCheck = () => {
      forceHeightCorrection()
    }
    
    // Проверка с задержкой для случаев, когда DOM еще не полностью готов
    const delayedCheck = setTimeout(() => {
      forceHeightCorrection()
    }, 100)
    
    // Дополнительная проверка через более длительное время
    const additionalCheck = setTimeout(() => {
      forceHeightCorrection()
    }, 500)
    
    immediateCheck()
    
    // Обработчик изменения размера окна
    const handleResize = () => {
      setTimeout(forceHeightCorrection, 50)
    }
    
    // Обработчик события реинициализации страницы
    const handlePageReinitialization = () => {
      console.log('MobileArtistsSlider: Page reinitialization detected, forcing height correction')
      setTimeout(forceHeightCorrection, 100)
    }
    
    window.addEventListener('resize', handleResize)
    document.addEventListener('pageReinitialization', handlePageReinitialization)
    
    return () => {
      clearTimeout(delayedCheck)
      clearTimeout(additionalCheck)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('pageReinitialization', handlePageReinitialization)
    }
  }, [])

  // Эффект для проверки высоты при изменении масштаба
  useEffect(() => {
    const checkAfterScaleChange = setTimeout(() => {
      forceHeightCorrection()
    }, 200)
    
    return () => clearTimeout(checkAfterScaleChange)
  }, [scale])

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
      ref={sliderRef}
      className="mobile-artists-slider w-full flex items-center justify-center"
      style={{
        transform: 'none', // Принудительно сбрасываем любые трансформации
        width: `${widthMultiplier * 100}vw`,
        maxWidth: `${widthMultiplier * 100}vw`,
        height: `${typeof window !== 'undefined' ? window.innerHeight * 2 : 1600}px`, // Принудительная высота
        minHeight: `${typeof window !== 'undefined' ? window.innerHeight * 2 : 1600}px`,
        margin: 0,
        padding: 0,
        marginLeft: `-${marginOffset}`,
        marginRight: `-${marginOffset}`,
        marginTop: 0, // Принудительно сбрасываем отступы
        marginBottom: 0,
        transition: "width 0.3s ease, margin 0.3s ease",
        background: "black",
        zIndex: 1, // Устанавливаем предсказуемый z-index
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
