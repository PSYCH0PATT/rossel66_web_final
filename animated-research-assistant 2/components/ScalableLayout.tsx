"use client"

import type React from "react"
import { useEffect, useState } from "react"
import styles from "./ScalableLayout.module.css"

interface ScalableLayoutProps {
  children: React.ReactNode
  baseWidth?: number
  baseHeight?: number
  minScale?: number
  maxScale?: number
}

export const ScalableLayout: React.FC<ScalableLayoutProps> = ({
  children,
  baseWidth = 1920,
  baseHeight = 1080,
  minScale = 0.5,
  maxScale = 1.2,
}) => {
  const [scale, setScale] = useState(1)
  const [contentHeight, setContentHeight] = useState("auto")

  // Функция для расчета масштаба на основе размеров окна
  const calculateScale = () => {
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    // Рассчитываем масштаб по ширине и высоте
    const widthScale = windowWidth / baseWidth
    const heightScale = windowHeight / baseHeight

    // Используем меньший масштаб, чтобы контент полностью поместился
    let newScale = Math.min(widthScale, heightScale)

    // Ограничиваем масштаб минимальным и максимальным значениями
    newScale = Math.max(minScale, Math.min(newScale, maxScale))

    setScale(newScale)

    // Устанавливаем высоту контента с учетом масштаба
    setContentHeight(`${windowHeight / newScale}px`)
  }

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

  return (
    <div className={styles.scalableLayoutContainer}>
      <div
        className={styles.scalableLayoutContent}
        style={{
          width: baseWidth,
          minHeight: contentHeight,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
