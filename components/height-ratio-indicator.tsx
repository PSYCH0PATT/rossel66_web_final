"use client"

import { useEffect, useState } from "react"

export default function HeightRatioIndicator() {
  const [heightRatio, setHeightRatio] = useState(1)
  const [inverseRatio, setInverseRatio] = useState(1)
  const [windowHeight, setWindowHeight] = useState(0)
  const [scaledHeight, setScaledHeight] = useState(0)
  const [decreasePercentage, setDecreasePercentage] = useState(0)
  const [baseHeight] = useState(1080) // Базовая высота

  useEffect(() => {
    const updateRatios = () => {
      const height = window.innerHeight
      const ratio = height / baseHeight

      setHeightRatio(ratio)
      setInverseRatio(1 / ratio)
      setWindowHeight(height)
      setScaledHeight(height * ratio)

      // Рассчитываем процент уменьшения размера секции
      const decrease = (1 - ratio) * 100
      setDecreasePercentage(decrease)
    }

    // Инициализация
    updateRatios()

    // Отслеживаем изменение размера окна
    window.addEventListener("resize", updateRatios)

    return () => {
      window.removeEventListener("resize", updateRatios)
    }
  }, [baseHeight])

  return (
    <div className="fixed top-4 right-4 z-50 bg-black/80 text-white text-xs p-2 rounded flex flex-col gap-1">
      <div className="flex justify-between">
        <span>Height Ratio:</span>
        <span className="text-emerald-400 font-bold ml-2">{heightRatio.toFixed(4)}</span>
      </div>
      <div className="flex justify-between">
        <span>1 / Height Ratio:</span>
        <span className="text-emerald-400 font-bold ml-2">{inverseRatio.toFixed(4)}</span>
      </div>
      <div className="flex justify-between">
        <span>Window Height:</span>
        <span className="text-emerald-400 font-bold ml-2">{windowHeight}px</span>
      </div>
      <div className="flex justify-between">
        <span>Height Ratio × Window Height:</span>
        <span className="text-emerald-400 font-bold ml-2">{scaledHeight.toFixed(2)}px</span>
      </div>
      <div className="flex justify-between">
        <span>Size Decrease:</span>
        <span className="text-emerald-400 font-bold ml-2">{decreasePercentage.toFixed(2)}%</span>
      </div>
    </div>
  )
}
