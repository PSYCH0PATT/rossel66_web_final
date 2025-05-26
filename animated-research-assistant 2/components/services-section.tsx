"use client"

import React from "react"
import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Radio, Target, Mic, MessageSquare, Video, Briefcase } from "lucide-react"
import { useMobileDetector } from "@/hooks/use-mobile-detector"
import MobileServicesSlider from "./mobile-services-slider"

interface ServicesSectionProps {
  windowSize: {
    width: number
    height: number
  }
  mobileScale?: number // Добавляем проп для передачи масштаба
}

export default function ServicesSection({ windowSize, mobileScale }: ServicesSectionProps) {
  const isMobile = useMobileDetector()
  const [currentScale, setCurrentScale] = useState(1)

  // Отслеживаем текущий масштаб
  useEffect(() => {
    const updateScale = () => {
      const scalableContent = document.querySelector(".scalable-content")
      const scale = scalableContent ? Number.parseFloat(scalableContent.getAttribute("data-scale") || "1") : 1
      setCurrentScale(scale)
    }

    // Инициализация
    updateScale()

    // Обновляем при изменении масштаба
    const handleScaleChange = () => {
      updateScale()
    }

    window.addEventListener("resize", handleScaleChange)
    document.addEventListener("scalechange", handleScaleChange)

    return () => {
      window.removeEventListener("resize", handleScaleChange)
      document.removeEventListener("scalechange", handleScaleChange)
    }
  }, [])

  // Если мобильное устройство, показываем мобильный слайдер
  if (isMobile) {
    return (
      <section
        id="services"
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
        <MobileServicesSlider scale={mobileScale || currentScale} />
      </section>
    )
  }

  // Десктопная версия остается без изменений
  // Адаптивные размеры в зависимости от размера экрана
  const titleSize = windowSize.width < 640 ? "text-3xl" : windowSize.width < 1024 ? "text-4xl" : "text-5xl"
  const cardPadding = windowSize.width < 640 ? "p-4" : windowSize.width < 1024 ? "p-5" : "p-6"

  return (
    <div className="w-full min-h-screen flex items-center justify-center py-12 sm:py-16">
      {/* Диагональные линии на фоне */}
      <div className="absolute inset-0 z-0">
        <div className="diagonal-lines"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-12"
        >
          <h2 className={`${titleSize} font-bold text-white mb-4`}>Мы займёмся вашим продвижением!</h2>
          <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto mb-4 sm:mb-8"></div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 w-full max-w-[1200px] mx-auto px-4">
          {/* Первая строка - изумрудный фон */}
          <ServiceCard
            icon={<Radio />}
            title="Промо"
            description="Дадим редакторам увидеть ваш трек"
            colorStyle="emerald"
            delay={1}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />

          <ServiceCard
            icon={<Target />}
            title="Таргетинг/посевы"
            description="Оставьте на нас продвижение вашей музыки"
            colorStyle="emerald"
            delay={2}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />

          {/* Вторая строка - промежуточный цвет */}
          <ServiceCard
            icon={<Mic />}
            title="Выступления"
            description="Организация мероприятий для вас"
            colorStyle="mixed"
            delay={3}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />

          <ServiceCard
            icon={<MessageSquare />}
            title="SMM"
            description="Активное ведение аккаунтов поддерживает активность аудитории"
            colorStyle="mixed"
            delay={4}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />

          {/* Третья строка - лазурный фон */}
          <ServiceCard
            icon={<Video />}
            title="Продакшн"
            description="Съёмки клипов, фотосессии, помощь в оформлении соцсетей и другой визуальный материал"
            colorStyle="azure"
            delay={5}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />

          <ServiceCard
            icon={<Briefcase />}
            title="Менеджмент"
            description="Решение любых музыкальных вопросов"
            colorStyle="azure"
            delay={6}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />
        </div>
      </div>
    </div>
  )
}

interface ServiceCardProps {
  icon: React.ReactNode
  title: string
  description: string
  colorStyle: "emerald" | "mixed" | "azure"
  delay: number
  cardPadding: string
  windowSize: {
    width: number
    height: number
  }
}

const ServiceCard = ({ icon, title, description, colorStyle, delay, cardPadding, windowSize }: ServiceCardProps) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const titleSize = windowSize.width < 640 ? "text-lg" : windowSize.width < 1024 ? "text-xl" : "text-2xl"

  const iconSize = windowSize.width < 640 ? "w-6 h-6" : windowSize.width < 1024 ? "w-8 h-8" : "w-10 h-10"

  // Определяем базовый цвет фона в зависимости от стиля
  const getBaseColor = () => {
    switch (colorStyle) {
      case "emerald":
        return "bg-emerald-500/20"
      case "mixed":
        return "bg-teal-500/20"
      case "azure":
        return "bg-cyan-500/20"
      default:
        return "bg-emerald-500/20"
    }
  }

  // Определяем цвет градиента при наведении
  const getHoverGradient = () => {
    switch (colorStyle) {
      case "emerald":
        return "from-emerald-500/40 to-emerald-600/20"
      case "mixed":
        return "from-teal-500/40 to-teal-600/20"
      case "azure":
        return "from-cyan-500/40 to-cyan-600/20"
      default:
        return "from-emerald-500/40 to-emerald-600/20"
    }
  }

  // Отслеживаем позицию мыши относительно карточки
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.1 }}
      viewport={{ once: true }}
      onMouseMove={handleMouseMove}
      className={`glass-card ${cardPadding} ${getBaseColor()} hover:bg-gradient-to-br ${getHoverGradient()} relative overflow-hidden group`}
      style={
        {
          "--mouse-x": `${mousePosition.x}px`,
          "--mouse-y": `${mousePosition.y}px`,
        } as React.CSSProperties
      }
    >
      {/* Градиент, следующий за мышью */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle 200px at var(--mouse-x) var(--mouse-y), 
            ${
              colorStyle === "emerald"
                ? "rgba(16, 185, 129, 0.4)"
                : colorStyle === "mixed"
                  ? "rgba(20, 184, 166, 0.4)"
                  : "rgba(6, 182, 212, 0.4)"
            } 0%, 
            transparent 80%)`,
        }}
      />

      <div className="mb-3 sm:mb-4 md:mb-6 flex items-center relative z-10">
        <div
          className={`mr-3 sm:mr-4 text-${colorStyle === "emerald" ? "emerald" : colorStyle === "mixed" ? "teal" : "cyan"}-400`}
        >
          {React.cloneElement(icon as React.ReactElement, { className: iconSize })}
        </div>
        <div
          className={`w-8 sm:w-12 h-0.5 bg-${colorStyle === "emerald" ? "emerald" : colorStyle === "mixed" ? "teal" : "cyan"}-400`}
        ></div>
      </div>

      <h3 className={`${titleSize} font-bold text-white mb-2 sm:mb-4 relative z-10`}>{title}</h3>
      <p className="text-gray-300 text-sm sm:text-base relative z-10">{description}</p>
    </motion.div>
  )
}
