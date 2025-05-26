"use client"

import type React from "react"
import { useEffect, useState, useRef, useMemo } from "react"
import { motion } from "framer-motion"
import { TrendingUp, Users, Music, Palette } from "lucide-react"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

// Компонент для анимации числа
const AnimatedCounter = ({ end = 500000, duration = 2000 }) => {
  const [count, setCount] = useState(0)
  const countRef = useRef(0)
  const startTimeRef = useRef(0)

  useEffect(() => {
    startTimeRef.current = Date.now()

    const animate = () => {
      const now = Date.now()
      const elapsed = now - startTimeRef.current

      if (elapsed < duration) {
        const progress = elapsed / duration
        const easedProgress =
          progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

        countRef.current = Math.floor(easedProgress * end)
        setCount(countRef.current)
        requestAnimationFrame(animate)
      } else {
        setCount(end)
      }
    }

    requestAnimationFrame(animate)

    return () => {
      countRef.current = 0
    }
  }, [end, duration])

  const formattedCount = count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")

  return <span className="text-emerald-400 font-bold">{formattedCount}</span>
}

// Добавим параметр mobileScale в интерфейс FactsSection
interface FactsSectionProps {
  windowSize: {
    width: number
    height: number
  }
}

// Теперь нужно использовать этот масштаб в компоненте
// Найдем в начале функции FactsSection и добавим:
export default function FactsSection({ windowSize }: FactsSectionProps) {
  // Адаптивные размеры в зависимости от размера экрана
  const titleSize = windowSize.width < 640 ? "text-2xl" : windowSize.width < 1024 ? "text-3xl" : "text-4xl"
  const cardPadding = windowSize.width < 640 ? "p-3" : windowSize.width < 1024 ? "p-4" : "p-6"

  // Применяем масштаб для мобильных устройств
  const isMobile = useMobileDetector()
  const [dynamicGridStyle, setDynamicGridStyle] = useState<React.CSSProperties>({})

  // Стиль для корневого div (190% на мобильных, как было изначально)
  const rootContainerMobileStyle = useMemo(() => {
    if (isMobile) {
      const widthMultiplier = 1.9; 
      const marginOffset = `${(widthMultiplier - 1) * 50}%`;
      return {
        width: `${widthMultiplier * 100}%`,
        maxWidth: `${widthMultiplier * 100}%`, // Важно для предотвращения сжатия, если есть min-width у viewport
        marginLeft: `-${marginOffset}`,
        marginRight: `-${marginOffset}`,
      };
    }
    return {}; // На десктопе этот стиль не применяется
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) {
      // Грид должен занимать 100% своего родителя (который будет 190% ширины экрана)
      setDynamicGridStyle({ width: '100%' }); 
    } else {
      const DESKTOP_BASE_WIDTH = 1200;
      const MIN_WIDTH = 540;
      const REFERENCE_WINDOW_WIDTH = 1080; 

      let currentMaxWidth: number;

      if (windowSize.width >= REFERENCE_WINDOW_WIDTH) {
        currentMaxWidth = DESKTOP_BASE_WIDTH;
      } else if (windowSize.width < REFERENCE_WINDOW_WIDTH && windowSize.width > MIN_WIDTH) { // Добавил условие, чтобы не было меньше MIN_WIDTH
        const scaleFactor = windowSize.width / REFERENCE_WINDOW_WIDTH;
        const scaledWidth = DESKTOP_BASE_WIDTH * scaleFactor;
        currentMaxWidth = Math.max(MIN_WIDTH, scaledWidth); 
      } else { // Если windowSize.width <= MIN_WIDTH
        currentMaxWidth = MIN_WIDTH;
      }
      // Устанавливаем и width, и maxWidth для лучшего контроля и предотвращения роста больше maxWidth
      // при сохранении возможности сжиматься
      setDynamicGridStyle({ width: '100%', maxWidth: `${currentMaxWidth}px` }); 
    }
  }, [windowSize.width, isMobile]);

  // Применяем стили к контейнеру
  return (
    <div className="w-full h-full flex items-center justify-center py-4 sm:py-12" style={rootContainerMobileStyle}>
      {/* Диагональные линии на фоне */}
      <div className="absolute inset-0 z-0">
        <div className="diagonal-lines"></div>
      </div>

      <div className="relative z-10 container mx-auto px-2 sm:px-4 md:px-6 flex flex-col items-center justify-center w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-5 sm:mb-8"
        >
          <h2 className={`${titleSize} font-bold text-white mb-3 sm:mb-4`}>Наши достижения</h2>
          <div className="w-12 sm:w-16 md:w-24 h-1 bg-emerald-500 mx-auto mb-3 sm:mb-4"></div>
        </motion.div>

        <div 
          className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-3 md:gap-6 w-full mx-auto px-2 sm:px-4" 
          style={dynamicGridStyle} 
        >
          <FactCard
            icon={<TrendingUp className={`w-6 h-6 sm:w-8 sm:h-8 text-emerald-400`} />}
            title={
              <>
                Свыше <AnimatedCounter end={500000} />
              </>
            }
            description="ежедневного стриминга на всех площадках"
            delay={1}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />

          <FactCard
            icon={<Users className={`w-6 h-6 sm:w-8 sm:h-8 text-emerald-400`} />}
            title="Большой опыт"
            description="в продвижении молодых талантов с новым звуком"
            delay={2}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />

          <FactCard
            icon={<Music className={`w-6 h-6 sm:w-8 sm:h-8 text-emerald-400`} />}
            title="Музыкальное сообщество"
            description="Дадим дорогу в большое музыкальное сообщество"
            delay={3}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />

          <FactCard
            icon={<Palette className={`w-6 h-6 sm:w-8 sm:h-8 text-emerald-400`} />}
            title="Коммерческий образ"
            description="Поможем сформировать коммерческий образ"
            delay={4}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />
        </div>
      </div>
    </div>
  )
}

interface FactCardProps {
  icon: React.ReactNode
  title: React.ReactNode
  description: string
  delay: number
  cardPadding: string
  windowSize: {
    width: number
    height: number
  }
}

const FactCard = ({ icon, title, description, delay, cardPadding, windowSize }: FactCardProps) => {
  const titleSize = windowSize.width < 640 ? "text-lg" : windowSize.width < 1024 ? "text-xl" : "text-2xl"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.1 }}
      viewport={{ once: true }}
      className={`glass-card ${cardPadding} bg-white/5 hover:bg-emerald-500/20 ${windowSize.width < 640 ? "py-5" : ""}`}
    >
      <div className="mb-3 sm:mb-4 flex items-center">
        <div className="mr-2 sm:mr-3">{icon}</div>
        <div className="w-6 sm:w-8 md:w-12 h-0.5 bg-emerald-400"></div>
      </div>

      <h3 className={`${titleSize} font-bold text-white mb-3 sm:mb-3`}>{title}</h3>
      <p className="text-gray-300 text-xs sm:text-sm md:text-base">{description}</p>
    </motion.div>
  )
}
