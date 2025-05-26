"use client"

import { useEffect, useState } from "react"

export default function ScaleIndicator() {
  const [scale, setScale] = useState(1)
  const [originalDimensions, setOriginalDimensions] = useState({ width: 1920, height: 1080 })
  const [currentDimensions, setCurrentDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    // Функция для получения текущего масштаба из scalable-content
    const updateScale = () => {
      const scalableContent = document.querySelector(".scalable-content")
      if (scalableContent) {
        const currentScale = Number.parseFloat(scalableContent.getAttribute("data-scale") || "1")
        setScale(currentScale)

        // Обновляем текущие размеры с учетом масштаба
        setCurrentDimensions({
          width: Math.round(originalDimensions.width * currentScale),
          height: Math.round(originalDimensions.height * currentScale),
        })
      }
    }

    // Инициализация
    updateScale()

    // Отслеживаем изменение масштаба через событие scalechange
    const handleScaleChange = () => {
      updateScale()
    }

    document.addEventListener("scalechange", handleScaleChange)
    window.addEventListener("resize", handleScaleChange)

    return () => {
      document.removeEventListener("scalechange", handleScaleChange)
      window.removeEventListener("resize", handleScaleChange)
    }
  }, [originalDimensions])

  return (
    <div className="fixed top-4 left-4 z-50 bg-black/80 text-white text-xs p-2 rounded flex flex-col gap-1">
      <div className="flex justify-between">
        <span>Scale:</span>
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
          {currentDimensions.width}x{currentDimensions.height}
        </span>
      </div>
      <div className="flex justify-between">
        <span>Ratio:</span>
        <span className="text-emerald-400 font-bold ml-2">{Math.round(scale * 100)}%</span>
      </div>
    </div>
  )
}
