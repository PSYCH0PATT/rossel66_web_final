"use client"

import type React from "react"
import { useRef, useEffect, useState } from "react"

interface ScalableSectionProps {
  children: React.ReactNode
  baseWidth?: number
  baseHeight?: number
  minScale?: number
  maxScale?: number
  className?: string
  scaleOrigin?: "center" | "top" | "bottom" | "left" | "right"
  preserveHeight?: boolean
}

export default function ScalableSection({
  children,
  baseWidth = 1920,
  baseHeight = 1080,
  minScale = 0.5,
  maxScale = 1.2,
  className = "",
  scaleOrigin = "top",
  preserveHeight = false,
}: ScalableSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  // Функция для расчета масштаба
  const calculateScale = () => {
    if (!containerRef.current) return

    const containerWidth = containerRef.current.clientWidth
    const containerHeight = containerRef.current.clientHeight

    // Рассчитываем масштаб по ширине и высоте
    const widthScale = containerWidth / baseWidth
    const heightScale = containerHeight / baseHeight

    // Используем меньший масштаб, чтобы контент полностью поместился
    let newScale = Math.min(widthScale, heightScale)

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
  }, [baseWidth, baseHeight, minScale, maxScale])

  // Определяем origin для transform
  const getTransformOrigin = () => {
    switch (scaleOrigin) {
      case "top":
        return "center top"
      case "bottom":
        return "center bottom"
      case "left":
        return "left center"
      case "right":
        return "right center"
      default:
        return "center center"
    }
  }

  return (
    <div
      ref={containerRef}
      className={`scalable-section-container ${className}`}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        ref={contentRef}
        className="scalable-section-content"
        style={{
          width: baseWidth,
          height: preserveHeight ? "auto" : baseHeight,
          transform: `scale(${scale})`,
          transformOrigin: getTransformOrigin(),
          position: "relative",
          transition: "transform 0.3s ease",
          overflow: "visible",
        }}
      >
        {children}
      </div>
    </div>
  )
}
