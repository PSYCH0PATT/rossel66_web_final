// @ts-nocheck
"use client"

import type React from "react"
import { memo, useMemo, useState, useEffect } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

// Мемоизированный компонент слайдера, адаптированный под CSS пользователя
const LogoSlider = memo(function LogoSlider({
  items,
  sliderHeight,
  sliderWidth,
  quantity,
  reverse = false,
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
  quantity: number
  reverse?: boolean
}) {
  if (items.length === 0) return null

  // Используем двойное дублирование, как наиболее частый подход для таких CSS-анимаций
  const itemsForSlider = [...items, ...items]

  return (
    <div
      className="slider"
      style={{
          "--width": sliderWidth,
          "--height": sliderHeight,
        "--quantity": quantity, // Передаем quantity, как в примере пользователя
      } as React.CSSProperties}
      data-reverse={reverse ? "true" : "false"} // Используем data-атрибут для reverse
    >
      <div className="list">
        {itemsForSlider.map((item, index) => (
          <div
            key={`item-${item.id}-${index}`}
            // Используем index из itemsForSlider для --position, он должен быть уникальным для каждого элемента в дублированном списке
            // Но CSS ожидает --position от 1 до quantity оригинальных элементов для корректной задержки.
            // Поэтому для --position используем (index % items.length) + 1
            className={`item ${index % 2 === 0 ? "emerald-border" : "cyan-border"}`}
            style={{
              "--position": (index % items.length) + 1,
            } as React.CSSProperties}
          >
              <Image
                src={item.image || "/placeholder.svg"}
                alt={item.alt}
              width={Number.parseInt(sliderWidth) * 0.8} // 80% от ширины элемента, как было
              height={Number.parseInt(sliderHeight) * 0.8} // 80% от высоты элемента, как было
                className="object-contain"
              />
          </div>
        ))}
      </div>
    </div>
  )
})

// Логотипы для первого слайдера (музыкальные сервисы)
const musicServices = [
  { id: 1, name: "Spotify", image: "/images/partners/spotify.svg", alt: "Spotify" },
  { id: 2, name: "Apple Music", image: "/images/partners/apple_music_dark.svg", alt: "Apple Music" },
  { id: 3, name: "YouTube Music", image: "/images/partners/youtube_music_dark.svg", alt: "YouTube Music" },
  { id: 4, name: "VK", image: "/images/partners/vk_dark.svg", alt: "VK" },
  { id: 5, name: "Yandex", image: "/images/partners/yandex_dark.svg", alt: "Yandex Music" },
  { id: 6, name: "Zvuk", image: "/images/partners/zvuk_dark.svg", alt: "Zvuk" },
  { id: 7, name: "Amazon", image: "/images/partners/amazon_dark.svg", alt: "Amazon Music" },
  { id: 8, name: "Deezer", image: "/images/partners/deezer_new.png", alt: "Deezer", hasWhiteOutline: true },
  { id: 9, name: "TikTok", image: "/images/partners/tiktok_new.png", alt: "TikTok", hasWhiteOutline: true },
  { id: 10, name: "Instagram", image: "/images/partners/instagram_dark.svg", alt: "Instagram" },
]

// Логотипы для второго слайдера (дистрибьюторы)
const distributors = [
  { id: 1, name: "Believe", image: "/images/partners/BELIEVE.png", alt: "Believe Distribution Services" },
  { id: 2, name: "Zvonko", image: "/images/partners/zvonko_new.png", alt: "Zvonko Digital" },
  { id: 3, name: "Soyuz", image: "/images/partners/soyuz.png", alt: "Soyuz Music" },
  { id: 4, name: "MA", image: "/images/partners/ma.png", alt: "MA Music" },
  { id: 5, name: "MH", image: "/images/partners/mh.png", alt: "MH Music" },
  { id: 6, name: "Koala Music", image: "/images/partners/koala_music.png", alt: "Koala Music" },
]

// Обновляем интерфейс, добавляя параметр mobileScale
interface PartnersSectionProps {
  windowSize: {
    width: number
    height: number
  }
}

// Основной компонент секции партнеров
const PartnersSection = function PartnersSection({ windowSize }: PartnersSectionProps) {
  // Адаптивные размеры в зависимости от размера экрана (увеличены на 25% для мобильных)
  const titleSize = windowSize.width < 640 ? "text-4xl" : windowSize.width < 1024 ? "text-4xl" : "text-5xl"
  
  // Размеры для слайдеров - УВЕЛИЧИВАЕМ ДЛЯ МОБИЛЬНЫХ
  const sliderHeight1 = windowSize.width < 640 ? "80px" : windowSize.width < 1024 ? "90px" : "100px" // Было 60, 70, 80
  const sliderWidth1 = windowSize.width < 640 ? "200px" : windowSize.width < 1024 ? "220px" : "240px" // Было 150, 180, 200
  
  // Изменяем размеры для второго слайдера, чтобы элементы были прямоугольными - УВЕЛИЧИВАЕМ ДЛЯ МОБИЛЬНЫХ
  const sliderHeight2 = windowSize.width < 640 ? "100px" : windowSize.width < 1024 ? "110px" : "120px" // Было 80, 100, 120 (оставим 120 для больших)
  const sliderWidth2 = windowSize.width < 640 ? "220px" : windowSize.width < 1024 ? "240px" : "260px" // Было 160, 200, 240
  
  // Quantity теперь соответствует количеству ОРИГИНАЛЬНЫХ элементов, которые должны участвовать в расчете задержек
  // CSS использует var(--quantity) для расчета animation-delay. 
  // Это должно быть количество уникальных элементов, а не дублированных.
  const musicServicesQuantity = musicServices.length;
  const distributorsQuantity = distributors.length;

  // Применяем масштаб для мобильных устройств
  const isMobile = useMobileDetector()

  // Рассчитываем ширину контейнера с учетом масштаба
  const rootContainerStyle = useMemo(() => {
    if (isMobile) {
      const widthMultiplier = 1.9; // Set to 190%
      const marginOffset = `${(widthMultiplier - 1) * 50}%`; // (1.9 - 1) * 50 = 45%

      return {
        width: `${widthMultiplier * 100}%`,
        maxWidth: `${widthMultiplier * 100}%`,
        marginLeft: `-${marginOffset}`,
        marginRight: `-${marginOffset}`,
      };
    }
    return {}; 
  }, [isMobile]);

  // Новый стиль для внутреннего div с контентом (динамическая ширина на десктопе)
  const [dynamicContentStyle, setDynamicContentStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (isMobile) {
      // На мобильных возвращаем управление Tailwind классам, удаляя инлайн стили ширины
      setDynamicContentStyle({}); 
    } else {
      const DESKTOP_BASE_WIDTH = 1600; // Базовая ширина для Партнеров
      const MIN_WIDTH = 540;
      const REFERENCE_WINDOW_WIDTH = 1350; // ИЗМЕНЕНО с 1080 на 1350

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
      setDynamicContentStyle({ width: '100%', maxWidth: `${currentMaxWidth}px` });
      }
  }, [windowSize.width, isMobile]);

  // Удаляем неиспользуемую переменную
  // const distributorsForSlider = [...distributors, ...distributors, ...distributors, ...distributors]

  return (
    <div className="w-full h-full flex items-center justify-center py-12 sm:py-16" style={rootContainerStyle}>
      {/* Диагональные линии на фоне */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="diagonal-lines"></div>
      </div>

      {/* Возвращаем классы max-w-* для мобильных и десктопных брейкпоинтов */}
      <div 
        className="relative z-10 container mx-auto px-4 sm:px-6 md:px-8 flex flex-col items-center justify-center w-full max-w-[95%] sm:max-w-[90%] md:max-w-[85%] lg:max-w-[80%]"
        style={dynamicContentStyle}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-12"
        >
          <h2 className={`${titleSize} font-bold text-white mb-4`}>Наши партнеры</h2>
          <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto mb-4 sm:mb-8"></div>
          <p className="text-gray-300 text-lg sm:text-lg md:text-xl max-w-2xl mx-auto">
            Мы сотрудничаем с лучшими музыкальными дистрибьюторами и сервисами
          </p>
        </motion.div>

        {/* Первый слайдер - музыкальные сервисы */}
        <LogoSlider 
          items={musicServices} 
          sliderHeight={sliderHeight1} 
          sliderWidth={sliderWidth1} 
          quantity={musicServicesQuantity} 
        />

        {/* Второй слайдер - дистрибьюторы, более широкий */}
        <LogoSlider 
          items={distributors} 
          sliderHeight={sliderHeight2} 
          sliderWidth={sliderWidth2} 
          quantity={distributorsQuantity} 
          reverse={true} 
        />

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
