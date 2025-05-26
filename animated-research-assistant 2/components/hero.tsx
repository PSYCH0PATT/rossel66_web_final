"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { FloatingPaper } from "@/components/floating_paper"
import Image from "next/image"
import { memo, useState, useEffect, useMemo } from "react"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

// Выделяем анимированный логотип в отдельный мемоизированный компонент
const AnimatedLogo = memo(function AnimatedLogo() {
  return (
    <motion.div
      className="flex items-center justify-center"
      animate={{
        y: [0, -20, 0],
      }}
      transition={{
        duration: 4,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
    >
      <div className="relative">
        <motion.div
          className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 4,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%D0%BB%D0%BE%D0%B3%D0%BE%20%D1%84%D1%83%D0%BB%D0%BB-1uNYD3zhCnNZ6BTo2MvyRpgjkpAnya.png"
          alt="ROSSEL 66 MUSIC"
          width={150}
          height={150}
          className="relative z-10 w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] md:w-[150px] md:h-[150px]"
        />
        <motion.div
          className="absolute -inset-8 bg-emerald-400/24 rounded-full blur-2xl"
          animate={{
            scale: [1, 1.95, 1],
            opacity: [0.24, 0.48, 0.24],
          }}
          transition={{
            duration: 6,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      </div>
    </motion.div>
  )
})

// Добавим параметр mobileScale в интерфейс HeroProps
interface HeroProps {
  windowSize?: {
    width: number
    height: number
  }
  onContactClick?: () => void
  mobileScale?: number
}

// Теперь нужно использовать этот масштаб в компоненте
// Найдем в начале функции Hero и добавим:
export default function Hero({ windowSize = { width: 1200, height: 800 }, onContactClick, mobileScale }: HeroProps) {
  // Применяем масштаб для мобильных устройств
  const isMobile = useMobileDetector()
  const [currentScale, setCurrentScale] = useState(1)

  // Отслеживаем текущий масштаб
  useEffect(() => {
    if (mobileScale) {
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
  }, [mobileScale])

  // Рассчитываем ширину контейнера с учетом масштаба - точно так же, как в FAQ и Партнеры
  const containerStyle = useMemo(() => {
    if (isMobile && mobileScale) {
      const widthMultiplier = Math.min(1 / mobileScale, 1.5) // Уменьшаем до 1.5x как в секциях FAQ и Партнеры
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

  // Определяем классы для текста в зависимости от типа устройства
  const titleClass = isMobile
    ? "text-5xl font-bold text-white mb-4"
    : "text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 sm:mb-6"

  const subtitleClass = isMobile
    ? "text-xl text-gray-400 mb-6 max-w-3xl mx-auto"
    : "text-base sm:text-lg md:text-xl text-gray-400 mb-6 sm:mb-8 max-w-2xl mx-auto"

  const buttonClass = isMobile
    ? "bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-5 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.31)] transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.44)] text-base"
    : "bg-emerald-500 hover:bg-emerald-600 text-white px-6 sm:px-8 md:px-10 py-4 sm:py-5 md:py-6 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.31)] transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.44)] text-sm sm:text-base"

  // Определяем класс контейнера в зависимости от типа устройства
  const containerClass = isMobile
    ? "relative h-screen flex flex-col justify-center" // Изменено для вертикального центрирования
    : "container relative h-screen flex items-center justify-center"

  // Определяем класс внутреннего контейнера в зависимости от типа устройства
  const innerContainerClass = isMobile
    ? "relative z-10 container mx-auto px-2 sm:px-4 md:px-6 flex flex-col items-center w-full max-w-[95%] sm:max-w-[90%] md:max-w-[85%]"
    : "relative z-10 flex justify-center w-full"

  // Применяем стили к контейнеру
  return (
    <div className={containerClass} style={containerStyle}>
      {/* Floating papers background - всегда 6 картинок */}
      <div className="absolute inset-0 overflow-hidden">
        <FloatingPaper count={6} />
      </div>

      {/* Для мобильной версии добавляем логотип над контентом - передвинут чуть ниже */}
      {isMobile && (
        <div className="absolute top-[30%] left-1/2 transform -translate-x-1/2 -translate-y-[70%] w-[150px] h-[150px] z-20">
          <AnimatedLogo />
        </div>
      )}

      {/* Используем разные классы для внутреннего контейнера в зависимости от типа устройства */}
      <div className={innerContainerClass}>
        {isMobile ? (
          // Мобильная версия - текст центрирован по вертикали
          <div className="text-center w-full mt-[8vh]">
            {" "}
            {/* Уменьшен отступ сверху для компенсации смещения логотипа */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h1 className={titleClass}>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
                  ROSSEL 66 MUSIC
                </span>
              </h1>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={subtitleClass}
            >
              Деловые отношения, дружеская атмосфера
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col items-center justify-center gap-4"
            >
              <motion.div
                whileHover={{
                  y: -5,
                  transition: { duration: 0.2 },
                }}
              >
                <Button size="lg" className={buttonClass} onClick={onContactClick}>
                  Отправить заявку
                </Button>
              </motion.div>
            </motion.div>
          </div>
        ) : (
          // Компьютерная версия - оставляем без изменений
          <div className="max-w-4xl mx-auto text-center w-full">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h1 className={titleClass}>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
                  ROSSEL 66 MUSIC
                </span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={subtitleClass}
            >
              Деловые отношения, дружеская атмосфера
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <motion.div
                whileHover={{
                  y: -5,
                  transition: { duration: 0.2 },
                }}
              >
                <Button size="lg" className={buttonClass} onClick={onContactClick}>
                  Отправить заявку
                </Button>
              </motion.div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Animated logo только для компьютерной версии в правом нижнем углу, ниже кнопки */}
      {!isMobile && (
        <div className="absolute bottom-[-150px] right-0 w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96">
          <AnimatedLogo />
        </div>
      )}
    </div>
  )
}
