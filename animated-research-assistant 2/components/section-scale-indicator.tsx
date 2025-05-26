"use client"

import { useEffect, useState, useRef } from "react"

interface SectionScaleIndicatorProps {
  sectionId: string
  baseWidth: number
  baseHeight: number
}

export default function SectionScaleIndicator({ sectionId, baseWidth, baseHeight }: SectionScaleIndicatorProps) {
  const [scale, setScale] = useState(1)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [originalDimensions, setOriginalDimensions] = useState({ width: baseWidth, height: baseHeight })
  const observerRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    const section = document.getElementById(sectionId)
    if (!section) return

    // Функция для обновления масштаба и размеров
    const updateScaleAndDimensions = () => {
      // Получаем текущие размеры секции
      const rect = section.getBoundingClientRect()
      const currentWidth = rect.width
      const currentHeight = rect.height

      // Получаем текущий масштаб из scalable-content
      const scalableContent = document.querySelector(".scalable-content")
      const globalScale = scalableContent ? Number.parseFloat(scalableContent.getAttribute("data-scale") || "1") : 1

      // Рассчитываем масштаб секции относительно базовых размеров
      const widthScale = currentWidth / baseWidth
      const heightScale = currentHeight / baseHeight

      // Используем глобальный масштаб для более точного отображения
      setScale(globalScale)

      // Обновляем текущие размеры
      setDimensions({
        width: Math.round(currentWidth),
        height: Math.round(currentHeight),
      })
    }

    // Инициализация
    updateScaleAndDimensions()

    // Создаем ResizeObserver для отслеживания изменений размера секции
    observerRef.current = new ResizeObserver(updateScaleAndDimensions)
    observerRef.current.observe(section)

    // Также отслеживаем изменение размера окна и масштаба
    window.addEventListener("resize", updateScaleAndDimensions)
    document.addEventListener("scalechange", updateScaleAndDimensions)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      window.removeEventListener("resize", updateScaleAndDimensions)
      document.removeEventListener("scalechange", updateScaleAndDimensions)
    }
  }, [sectionId, baseWidth, baseHeight])

  return (
    <div className="fixed bottom-16 right-4 z-50 bg-black/80 text-white text-xs p-2 rounded">
      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <span>{sectionId} scale:</span>
          <span className="text-emerald-400 font-bold ml-2">{scale.toFixed(3)}x</span>
        </div>
        <div className="flex justify-between">
          <span>Original:</span>
          <span className="text-emerald-400 font-bold ml-2">
            {originalDimensions.width}x{originalDimensions.height}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Current:</span>
          <span className="text-emerald-400 font-bold ml-2">
            {dimensions.width}x{dimensions.height}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Ratio:</span>
          <span className="text-emerald-400 font-bold ml-2">{Math.round(scale * 100)}%</span>
        </div>
      </div>
    </div>
  )
}
