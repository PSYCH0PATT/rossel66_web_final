"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Radio, Target, Mic, MessageSquare, Video, Briefcase } from "lucide-react"
import Image from "next/image"

interface MobileServicesSliderProps {
  scale?: number
}

// Данные услуг с привязанными фоновыми изображениями
const services = [
  {
    icon: <Radio />,
    title: "Промо",
    description: "Дадим редакторам увидеть ваш трек",
    colorStyle: "emerald",
    background: "/images/artists/artist6.jpeg", // Изображение, которое мы только что добавили
  },
  {
    icon: <Target />,
    title: "Таргетинг/посевы",
    description: "Оставьте на нас продвижение вашей музыки",
    colorStyle: "emerald-cyan",
    background: "/images/artists/sour_diesel.jpeg",
  },
  {
    icon: <Mic />,
    title: "Выступления",
    description: "Организация мероприятий для вас",
    colorStyle: "cyan-teal",
    background: "/images/artists/blue_portrait.jpeg",
  },
  {
    icon: <MessageSquare />,
    title: "SMM",
    description: "Активное ведение аккаунтов поддерживает активность аудитории",
    colorStyle: "teal",
    background: "/images/artists/bw_portrait.jpeg",
  },
  {
    icon: <Video />,
    title: "Продакшн",
    description: "Съёмки клипов, фотосессии, помощь в оформлении соцсетей и другой визуальный материал",
    colorStyle: "teal-cyan",
    background: "/images/artists/wide_pie.png",
  },
  {
    icon: <Briefcase />,
    title: "Менеджмент",
    description: "Решение любых музыкальных вопросов",
    colorStyle: "cyan",
    background: "/images/artists/artist.png",
  },
]

// Получение цвета иконки в зависимости от индекса слайда
const getIconColorClasses = (index: number) => {
  const totalSlides = services.length - 1
  const position = index / totalSlides

  if (position < 0.2) return { text: "text-emerald-400", bg: "bg-emerald-400" }
  if (position < 0.4) return { text: "text-emerald-300", bg: "bg-emerald-300" }
  if (position < 0.6) return { text: "text-teal-400", bg: "bg-teal-400" }
  if (position < 0.8) return { text: "text-cyan-400", bg: "bg-cyan-400" }
  return { text: "text-cyan-300", bg: "bg-cyan-300" }
}

export default function MobileServicesSlider({ scale = 1 }: MobileServicesSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  const sliderRef = useRef<HTMLDivElement>(null)

  // Рассчитываем ширину слайдера с учетом масштаба (КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ)
  const widthMultiplier = Math.min(1 / scale, 2) // Ограничиваем максимальное увеличение до 2x
  const marginOffset = `${(widthMultiplier - 1) * 50}%`

  // Принудительная проверка и исправление высоты слайдера
  const forceHeightCorrection = () => {
    if (sliderRef.current && typeof window !== 'undefined') {
      const expectedHeight = window.innerHeight * 2
      
      // Фокусируемся только на коррекции родительского контейнера
      const servicesSection = document.getElementById('services')
      if (servicesSection) {
        servicesSection.style.height = `${expectedHeight}px`
        servicesSection.style.minHeight = `${expectedHeight}px`
        servicesSection.style.overflow = 'visible'
        servicesSection.style.position = 'relative'
        
        // Убеждаемся, что секция имеет правильные классы
        if (!servicesSection.classList.contains('flex')) {
          servicesSection.classList.add('flex')
        }
        if (!servicesSection.classList.contains('items-center')) {
          servicesSection.classList.add('items-center')
        }
        if (!servicesSection.classList.contains('justify-center')) {
          servicesSection.classList.add('justify-center')
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
      
      console.log(`MobileServicesSlider: Height correction applied - ${expectedHeight}px`)
    }
  }

  // Отладочные логи (только для текущей отладки)
  console.log('MobileServicesSlider scale:', scale, 'widthMultiplier:', widthMultiplier)

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
      console.log('MobileServicesSlider: Page reinitialization detected, forcing height correction')
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
    setCurrentSlide((prev) => (prev === services.length - 1 ? 0 : prev + 1))
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? services.length - 1 : prev - 1))
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
      className="mobile-services-slider w-full flex items-center justify-center"
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
      {/* Фоновое изображение с темным оверлеем */}
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
              <Image
                src={services[currentSlide].background || "/placeholder.svg"}
                alt={services[currentSlide].title}
                fill
                className="object-cover"
                priority
              />
              {/* Используем точно такой же оверлей, как в секции "Артисты" */}
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
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-8">Мы займёмся вашим продвижением!</h2>

          {/* Информация о текущей услуге - с фиксированным положением */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-white"
            >
              <div className="mb-6 flex items-center">
                {/* Цветные иконки в зависимости от типа услуги */}
                <div className={`mr-4 ${getIconColorClasses(currentSlide).text}`}>
                  {React.cloneElement(services[currentSlide].icon as React.ReactElement, { className: "w-8 h-8" })}
                </div>
                <div className={`w-12 h-0.5 ${getIconColorClasses(currentSlide).bg}`}></div>
              </div>

              <h3 className="text-4xl sm:text-5xl font-bold mb-4">{services[currentSlide].title}</h3>
              <div className="h-24">
                {" "}
                {/* Фиксированная высота для описания */}
                <p className="text-lg sm:text-xl text-gray-100">{services[currentSlide].description}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Индикаторы слайдов без стрелок */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <div className="flex space-x-2">
            {services.map((_, index) => (
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
