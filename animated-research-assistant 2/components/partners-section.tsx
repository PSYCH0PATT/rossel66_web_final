"use client"

import type React from "react"
import { useEffect, useState, memo, useMemo } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

// Мемоизированный компонент слайдера
const LogoSlider = memo(function LogoSlider({
  items,
  sliderHeight,
  sliderWidth,
  reverse = false,
  quantity = 10,
}: {
  items: Array<{
    id: number
    name: string
    image: string
    alt: string
    hasWhiteOutline?: boolean
  }>
  sliderHeight: string
  sliderWidth: string
  reverse?: boolean
  quantity?: number
}) {
  const [hoveredLogo, setHoveredLogo] = useState<string | null>(null)
  const [isSliderHovered, setIsSliderHovered] = useState(false)

  // Дублируем массив для бесконечной прокрутки
  const itemsForSlider = [...items, ...items]

  return (
    <div
      className="slider mb-12 sm:mb-16"
      style={
        {
          "--width": sliderWidth,
          "--height": sliderHeight,
          "--quantity": quantity.toString(),
        } as React.CSSProperties
      }
      reverse={reverse ? "true" : "false"}
      onMouseEnter={() => setIsSliderHovered(true)}
      onMouseLeave={() => {
        setIsSliderHovered(false)
        setHoveredLogo(null)
      }}
    >
      <div className="list">
        {itemsForSlider.map((item, index) => (
          <div
            key={`item-${item.id}-${index}`}
            className={`item overflow-hidden ${index % 2 === 0 ? "emerald-border" : "cyan-border"} 
              ${isSliderHovered ? "paused" : ""} 
              ${isSliderHovered && hoveredLogo !== item.name ? "grayscale" : ""}
              ${hoveredLogo === item.name ? "hovered" : ""}`}
            style={{ "--position": (index % quantity) + 1 } as React.CSSProperties}
            onMouseEnter={() => setHoveredLogo(item.name)}
            onMouseLeave={() => setHoveredLogo(null)}
          >
            <div className="relative w-full h-full p-2 sm:p-4 flex items-center justify-center bg-black bg-opacity-30">
              <Image
                src={item.image || "/placeholder.svg"}
                alt={item.alt}
                width={Number.parseInt(sliderWidth) * 0.8}
                height={Number.parseInt(sliderHeight) * 0.8}
                className="object-contain"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

// Логотипы для первого слайдера (музыкальные сервисы)
const musicServices = [
  {
    id: 1,
    name: "Spotify",
    image: "/images/partners/spotify.svg",
    alt: "Spotify",
  },
  {
    id: 2,
    name: "Apple Music",
    image: "/images/partners/apple_music_dark.svg",
    alt: "Apple Music",
  },
  {
    id: 3,
    name: "YouTube Music",
    image: "/images/partners/youtube_music_dark.svg",
    alt: "YouTube Music",
  },
  {
    id: 4,
    name: "VK",
    image: "/images/partners/vk_dark.svg",
    alt: "VK",
  },
  {
    id: 5,
    name: "Yandex",
    image: "/images/partners/yandex_dark.svg",
    alt: "Yandex Music",
  },
  {
    id: 6,
    name: "Zvuk",
    image: "/images/partners/zvuk_dark.svg",
    alt: "Zvuk",
  },
  {
    id: 7,
    name: "Amazon",
    image: "/images/partners/amazon_dark.svg",
    alt: "Amazon Music",
  },
  {
    id: 8,
    name: "Deezer",
    image: "/images/partners/deezer_new.png",
    alt: "Deezer",
    hasWhiteOutline: true,
  },
  {
    id: 9,
    name: "TikTok",
    image: "/images/partners/tiktok_new.png",
    alt: "TikTok",
    hasWhiteOutline: true,
  },
  {
    id: 10,
    name: "Instagram",
    image: "/images/partners/instagram_dark.svg",
    alt: "Instagram",
  },
]

// Логотипы для второго слайдера (дистрибьюторы)
const distributors = [
  {
    id: 1,
    name: "Believe",
    image: "/images/partners/believe.png",
    alt: "Believe Distribution Services",
  },
  {
    id: 2,
    name: "Zvonko",
    image: "/images/partners/zvonko_new.png",
    alt: "Zvonko Digital",
  },
  {
    id: 3,
    name: "Soyuz",
    image: "/images/partners/soyuz.png",
    alt: "Soyuz Music",
  },
  {
    id: 4,
    name: "MA",
    image: "/images/partners/ma.png",
    alt: "MA Music",
  },
  {
    id: 5,
    name: "MH",
    image: "/images/partners/mh.png",
    alt: "MH Music",
  },
]

// Обновляем интерфейс, добавляя параметр mobileScale
interface PartnersSectionProps {
  windowSize: {
    width: number
    height: number
  }
  mobileScale?: number
}

// Основной компонент секции партнеров
const PartnersSection = function PartnersSection({ windowSize, mobileScale }: PartnersSectionProps) {
  // Адаптивные размеры в зависимости от размера экрана
  const titleSize = windowSize.width < 640 ? "text-3xl" : windowSize.width < 1024 ? "text-4xl" : "text-5xl"
  const sliderHeight1 = windowSize.width < 640 ? "60px" : windowSize.width < 1024 ? "70px" : "80px"
  const sliderHeight2 = windowSize.width < 640 ? "100px" : windowSize.width < 1024 ? "120px" : "140px"
  const sliderWidth1 = windowSize.width < 640 ? "150px" : windowSize.width < 1024 ? "180px" : "200px"
  const sliderWidth2 = windowSize.width < 640 ? "180px" : windowSize.width < 1024 ? "220px" : "240px"

  // Применяем масштаб для мобильных устройств
  const isMobile = useMobileDetector()
  const [currentScale, setCurrentScale] = useState(1)

  // Отслеживаем текущий масштаб
  useEffect(() => {
    if (isMobile && mobileScale) {
      setCurrentScale(mobileScale)
    } else {
      const updateScale = () => {
        const scalableContent = document.querySelector(".scalable-content")
        const scale = scalableContent ? Number.parseFloat(scalableContent.getAttribute("data-scale") || "1") : 1
        setCurrentScale(scale)
      }

      updateScale()

      const handleScaleChange = () => {
        updateScale()
      }

      window.addEventListener("resize", handleScaleChange)
      document.addEventListener("scalechange", handleScaleChange)

      return () => {
        window.removeEventListener("resize", handleScaleChange)
        document.removeEventListener("scalechange", handleScaleChange)
      }
    }
  }, [mobileScale, isMobile])

  // Рассчитываем ширину контейнера с учетом масштаба
  const containerStyle = useMemo(() => {
    if (isMobile && mobileScale) {
      const widthMultiplier = Math.min(1 / mobileScale, 1.5) // Уменьшаем до 1.5x для соответствия форме
      const marginOffset = `${(widthMultiplier - 1) * 50}%`

      return {
        width: `${widthMultiplier * 100}%`,
        maxWidth: `${widthMultiplier * 100}%`,
        marginLeft: `-${marginOffset}`,
        marginRight: `-${marginOffset}`,
      }
    }

    return {}
  }, [isMobile, mobileScale])

  // Создаем дублированные массивы для второго слайдера
  const distributorsForSlider = [...distributors, ...distributors, ...distributors, ...distributors]

  // Добавляем стили для слайдера в head при монтировании компонента
  useEffect(() => {
    const style = document.createElement("style")
    style.innerHTML = `
      .slider {
        width: 100%;
        height: var(--height);
        overflow: hidden;
        position: relative;
        mask-image: linear-gradient(
          to right,
          transparent,
          #000 10% 90%,
          transparent
        );
        -webkit-mask-image: linear-gradient(
          to right,
          transparent,
          #000 10% 90%,
          transparent
        );
      }
      
      .slider .list {
        display: flex;
        width: 100%;
        min-width: calc(var(--width) * var(--quantity));
        position: relative;
      }
      
      .slider .list .item {
        width: var(--width);
        height: var(--height);
        position: absolute;
        left: 100%;
        animation: autoRun 20s linear infinite;
        transition: all 0.3s ease;
        animation-delay: calc((20s / var(--quantity)) * (var(--position) - 1) - 20s) !important;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .slider .list .item img {
        width: 100%;
        height: auto;
        object-fit: contain;
        max-height: 100%;
      }
      
      @keyframes autoRun {
        from {
          left: 100%;
        }
        to {
          left: calc(var(--width) * -1);
        }
      }
      
      .slider[reverse="true"] .list .item {
        animation: reversePlay 20s linear infinite;
      }
      
      @keyframes reversePlay {
        from {
          left: calc(var(--width) * -1);
        }
        to {
          left: 100%;
        }
      }
      
      .emerald-border {
        border: 2px solid rgba(16, 185, 129, 0.3);
        box-shadow: none;
      }
      
      .cyan-border {
        border: 2px solid rgba(6, 182, 212, 0.3);
        box-shadow: none;
      }
      
      .emerald-bg {
        background-color: rgba(16, 185, 129, 0.2);
      }
      
      .cyan-bg {
        background-color: rgba(6, 182, 212, 0.2);
      }
      
      /* Стили для паузы и grayscale управляются через JS */
      .paused {
        animation-play-state: paused !important;
      }
      
      .grayscale {
        filter: grayscale(1);
      }
      
      .hovered {
        transform: scale(1.15);
        z-index: 100;
        filter: grayscale(0) !important;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return (
    <div className="w-full h-full flex items-center justify-center py-12 sm:py-16" style={containerStyle}>
      {/* Диагональные линии на фоне */}
      <div className="absolute inset-0 z-0">
        <div className="diagonal-lines"></div>
      </div>

      {/* Изменяем класс контейнера, добавляя ограничение ширины */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 flex flex-col items-center justify-center w-full max-w-[95%] sm:max-w-[90%] md:max-w-[85%]">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-12"
        >
          <h2 className={`${titleSize} font-bold text-white mb-4`}>Наши партнеры</h2>
          <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto mb-4 sm:mb-8"></div>
          <p className="text-gray-300 text-base sm:text-lg md:text-xl max-w-2xl mx-auto">
            Мы сотрудничаем с лучшими музыкальными дистрибьюторами и сервисами
          </p>
        </motion.div>

        {/* Первый слайдер - музыкальные сервисы */}
        <LogoSlider items={musicServices} sliderHeight={sliderHeight1} sliderWidth={sliderWidth1} />

        {/* Второй слайдер - дистрибьюторы, более широкий */}
        <LogoSlider items={distributors} sliderHeight={sliderHeight2} sliderWidth={sliderWidth2} reverse={true} />

        {/* Дополнительная информация */}
        <div className="mt-12 sm:mt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center"
          >
            <p className="text-gray-300 text-sm sm:text-base md:text-lg max-w-3xl mx-auto">
              Наши партнеры обеспечивают широкий охват аудитории и максимальное продвижение вашей музыки на всех
              ключевых площадках
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default memo(PartnersSection)
