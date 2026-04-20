// @ts-nocheck
"use client"

import React from "react"
import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Radio, Target, Mic, MessageSquare, Video, Briefcase } from "lucide-react"
import { useMobileDetector } from "@/hooks/use-mobile-detector"
import MobileServicesSlider from "@/components/mobile-services-slider"

interface ServicesSectionProps {
  windowSize: {
    width: number
    height: number
  }
  mobileScale?: number
}

export default function ServicesSection({ windowSize, mobileScale }: ServicesSectionProps) {
  const isMobile = useMobileDetector()
  const [dynamicGridStyle, setDynamicGridStyle] = useState<React.CSSProperties>({})

  // Новый useEffect для динамической ширины грида на десктопе
  useEffect(() => {
    if (isMobile) {
      // Для десктопного грида, который будет скрыт на мобильных, можно установить width: '100%'
      // Это не повлияет на MobileServicesSlider
      setDynamicGridStyle({ width: '100%' });
    } else {
      // Десктопная логика
      const DESKTOP_BASE_WIDTH = 1200;
      const MIN_WIDTH = 540;
      const REFERENCE_WINDOW_WIDTH = 1080;

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
        <MobileServicesSlider scale={mobileScale || 1} />
      </section>
    )
  }

  // Десктопная версия (увеличены размеры для мобильных на 25%)
  const titleSize = windowSize.width < 640 ? "text-4xl" : windowSize.width < 1024 ? "text-4xl" : "text-5xl"
  const cardPadding = windowSize.width < 640 ? "p-5" : windowSize.width < 1024 ? "p-5" : "p-6"

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

        <div 
          className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 w-full mx-auto px-4"
          style={dynamicGridStyle}
        >
          {/* Первая строка - изумрудный фон */}
          <ServiceCard
            icon={<Radio />}
            title="Промо"
            description="Покажем ваш трек редакторам цифровых платформ"
            colorStyle="emerald"
            delay={1}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />

          <ServiceCard
            icon={<Target />}
            title="Таргетинг/посевы"
            description="Оставьте на нас продвижение вашей музыки"
            colorStyle="emerald-cyan"
            delay={2}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />

          {/* Вторая строка - промежуточный цвет */}
          <ServiceCard
            icon={<Mic />}
            title="Выступления"
            description="Организуем концерты, клабшоу и другие события"
            colorStyle="cyan-teal"
            delay={3}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />

          <ServiceCard
            icon={<MessageSquare />}
            title="SMM"
            description="Продвижение через соцсети и рост вовлечённости"
            colorStyle="teal"
            delay={4}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />

          {/* Третья строка - лазурный фон */}
          <ServiceCard
            icon={<Video />}
            title="Продакшн"
            description="Съёмки клипов, фотосессии, помощь в оформлении соцсетей и другой визуальный материал"
            colorStyle="teal-cyan"
            delay={5}
            cardPadding={cardPadding}
            windowSize={windowSize}
          />

          <ServiceCard
            icon={<Briefcase />}
            title="Менеджмент"
            description="Возьмём на себя организацию всех процессов"
            colorStyle="cyan"
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
  colorStyle: "emerald" | "mixed" | "azure" | "emerald-cyan" | "cyan-teal" | "teal" | "teal-cyan" | "cyan"
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

  const titleSize = windowSize.width < 640 ? "text-xl" : windowSize.width < 1024 ? "text-xl" : "text-2xl"

  const iconSize = windowSize.width < 640 ? "w-8 h-8" : windowSize.width < 1024 ? "w-8 h-8" : "w-10 h-10"

  // Определяем базовый цвет фона в зависимости от стиля
  const getBaseColor = () => {
    switch (colorStyle) {
      case "emerald":
        return "bg-emerald-500/20"
      case "emerald-cyan":
        return "bg-emerald-500/20" // Or a mix
      case "mixed":
        return "bg-teal-500/20"
      case "cyan-teal":
        return "bg-teal-500/20" // Or a mix
      case "teal":
        return "bg-teal-500/20"
      case "azure":
        return "bg-cyan-500/20"
      case "teal-cyan":
        return "bg-cyan-500/20" // Or a mix
      case "cyan":
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
      case "emerald-cyan":
        return "from-emerald-500/40 to-cyan-600/20"
      case "mixed":
        return "from-teal-500/40 to-teal-600/20"
      case "cyan-teal":
        return "from-cyan-500/40 to-teal-600/20"
      case "teal":
        return "from-teal-500/40 to-teal-600/20"
      case "azure":
        return "from-cyan-500/40 to-cyan-600/20"
      case "teal-cyan":
        return "from-teal-500/40 to-cyan-600/20"
      case "cyan":
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
              colorStyle === "emerald" ? "rgba(16, 185, 129, 0.4)" :
              colorStyle === "emerald-cyan" ? "rgba(18, 186, 147, 0.4)" : // Mix
              colorStyle === "mixed" ? "rgba(20, 184, 166, 0.4)" :
              colorStyle === "cyan-teal" ? "rgba(13, 183, 189, 0.4)" : // Mix
              colorStyle === "teal" ? "rgba(20, 184, 166, 0.4)" :
              colorStyle === "azure" ? "rgba(6, 182, 212, 0.4)" :
              colorStyle === "teal-cyan" ? "rgba(13, 183, 189, 0.4)" : // Mix
              colorStyle === "cyan" ? "rgba(6, 182, 212, 0.4)" :
              "rgba(6, 182, 212, 0.4)"
            } 0%, 
            transparent 80%)`,
        }}
      />

      <div className="mb-3 sm:mb-4 md:mb-6 flex items-center relative z-10">
        <div
          className={`mr-3 sm:mr-4`}
        >
          {React.cloneElement(icon as React.ReactElement, { 
            className: iconSize, 
            color: colorStyle === 'mixed' ? 'rgb(94 234 212)' : (colorStyle === 'emerald' ? '#10b981' : '#06b6d4') 
          })}
        </div>
        <div
          className={`w-8 sm:w-12 h-0.5`}
          style={{ backgroundColor: colorStyle === 'mixed' ? 'rgb(94 234 212)' : (colorStyle === 'emerald' ? '#10b981' : '#06b6d4') }}
        ></div>
      </div>

      <h3 className={`${titleSize} font-bold text-white mb-2 sm:mb-4 relative z-10`}>{title}</h3>
      <p className="text-gray-300 text-base sm:text-base relative z-10">{description}</p>
    </motion.div>
  )
}
