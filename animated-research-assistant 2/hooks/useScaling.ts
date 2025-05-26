"use client"

import { useState, useEffect, useCallback } from "react"

interface ScalingOptions {
  baseWidth?: number
  baseHeight?: number
  minScale?: number
  maxScale?: number
  scaleByWidth?: boolean
  scaleByHeight?: boolean
}

export const useScaling = ({
  baseWidth = 1920,
  baseHeight = 1080,
  minScale = 0.5,
  maxScale = 1.2,
  scaleByWidth = false,
  scaleByHeight = false,
}: ScalingOptions = {}) => {
  const [scale, setScale] = useState(1)
  const [dimensions, setDimensions] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  })

  const calculateScale = useCallback(() => {
    if (typeof window === "undefined") return 1

    const { width, height } = dimensions

    // Рассчитываем масштаб по ширине и высоте
    const widthScale = width / baseWidth
    const heightScale = height / baseHeight

    // Определяем, какой масштаб использовать
    let newScale
    if (scaleByWidth) {
      newScale = widthScale
    } else if (scaleByHeight) {
      newScale = heightScale
    } else {
      // По умолчанию используем меньший масштаб
      newScale = Math.min(widthScale, heightScale)
    }

    // Ограничиваем масштаб минимальным и максимальным значениями
    newScale = Math.max(minScale, Math.min(newScale, maxScale))

    return newScale
  }, [dimensions, baseWidth, baseHeight, minScale, maxScale, scaleByWidth, scaleByHeight])

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    // Инициализация при монтировании
    if (typeof window !== "undefined") {
      handleResize()
      window.addEventListener("resize", handleResize)
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleResize)
      }
    }
  }, [])

  // Пересчитываем масштаб при изменении размеров
  useEffect(() => {
    const newScale = calculateScale()
    setScale(newScale)
  }, [dimensions, calculateScale])

  return { scale, dimensions }
}
