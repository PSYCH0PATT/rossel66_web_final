"use client"

import type React from "react"
import { useRef, useEffect, useState } from "react"
import styles from "./ResponsiveScalableSection.module.css"

interface ResponsiveScalableSectionProps {
  children: React.ReactNode
  baseWidth?: number
  baseHeight?: number
  minScale?: number
  maxScale?: number
  className?: string
  padding?: number
  preserveAspectRatio?: boolean
}

export const ResponsiveScalableSection: React.FC<ResponsiveScalableSectionProps> = ({
  children,
  baseWidth = 1920,
  baseHeight = 1080,
  minScale = 0.5,
  maxScale = 1.2,
  className = "",
  padding = 0,
  preserveAspectRatio = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [contentSize, setContentSize] = useState({ width: baseWidth, height: baseHeight })

  // Функция для расчета масштаба с учетом отступов
  const calculateScale = () => {
    if (!containerRef.current) return

    const containerWidth = containerRef.current.clientWidth - padding * 2
    const containerHeight = containerRef.current.clientHeight - padding * 2

    // Рассчитываем масштаб по ширине и высоте
    const widthScale = containerWidth / baseWidth
    const heightScale = containerHeight / baseHeight

    // Определяем масштаб в зависимости от настроек
    let newScale
    if (preserveAspectRatio) {
      // Используем меньший масштаб для сохранения пропорций
      newScale = Math.min(widthScale, heightScale)
    } else {
      // Используем разные масштабы для ширины и высоты
      newScale = widthScale
      // Обновляем размеры контента для адаптации по высоте
      setContentSize({
        width: baseWidth,
        height: preserveAspectRatio ? baseHeight : containerHeight / newScale,
      })
    }

    // Ограничиваем масштаб минимальным и максимальным значениями
    newScale = Math.max(minScale, Math.min(newScale, maxScale))

    setScale(newScale)
  }

  // Обработчик изменения размера окна
  useEffect(() => {
    calculateScale()

    const handleResize = () => {
      calculateScale()
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [baseWidth, baseHeight, minScale, maxScale, padding, preserveAspectRatio])

  return (
    <div
      ref={containerRef}
      className={`${styles.responsiveContainer} ${className}`}
      style={{ padding: `${padding}px` }}
    >
      <div
        ref={contentRef}
        className={styles.responsiveContent}
        style={{
          width: contentSize.width,
          height: contentSize.height,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
