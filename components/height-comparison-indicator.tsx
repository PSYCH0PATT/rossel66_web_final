"use client"

import { useEffect, useState } from "react"

export default function HeightComparisonIndicator() {
  const [heights, setHeights] = useState({
    innerHeight: 0,
    clientHeight: 0,
    vh100: 0,
    artists: 0,
    services: 0,
    artistsToVh: 0,
    servicesToVh: 0,
  })

  useEffect(() => {
    const updateHeights = () => {
      // Получаем высоту секций
      const artistsSection = document.getElementById("artists")
      const servicesSection = document.getElementById("services")

      // Создаем тестовый элемент для измерения 100vh
      const testElement = document.createElement("div")
      testElement.style.height = "100vh"
      testElement.style.position = "fixed"
      testElement.style.visibility = "hidden"
      document.body.appendChild(testElement)
      const vh100 = testElement.offsetHeight
      document.body.removeChild(testElement)

      const artistsHeight = artistsSection?.getBoundingClientRect().height || 0
      const servicesHeight = servicesSection?.getBoundingClientRect().height || 0

      setHeights({
        innerHeight: window.innerHeight,
        clientHeight: document.documentElement.clientHeight,
        vh100,
        artists: artistsHeight,
        services: servicesHeight,
        artistsToVh: artistsHeight / vh100,
        servicesToVh: servicesHeight / vh100,
      })
    }

    // Инициализация
    updateHeights()

    // Обновляем при изменении размера окна
    window.addEventListener("resize", updateHeights)

    // Обновляем каждые 500мс
    const interval = setInterval(updateHeights, 500)

    return () => {
      window.removeEventListener("resize", updateHeights)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="fixed top-32 right-4 z-[9999] bg-black/80 text-white px-2 py-1 rounded-md text-xs">
      <div className="font-bold text-emerald-400">Сравнение высот:</div>
      <div className="grid grid-cols-2 gap-x-2 mt-1">
        <div>window.innerHeight:</div>
        <div className="text-emerald-400">{Math.round(heights.innerHeight)}px</div>
        <div>document.clientHeight:</div>
        <div className="text-emerald-400">{Math.round(heights.clientHeight)}px</div>
        <div>100vh:</div>
        <div className="text-emerald-400">{Math.round(heights.vh100)}px</div>
        <div>Артисты:</div>
        <div className="text-emerald-400">{Math.round(heights.artists)}px</div>
        <div>Услуги:</div>
        <div className="text-emerald-400">{Math.round(heights.services)}px</div>
        <div>Артисты / 100vh:</div>
        <div className="text-emerald-400">{heights.artistsToVh.toFixed(2)}</div>
        <div>Услуги / 100vh:</div>
        <div className="text-emerald-400">{heights.servicesToVh.toFixed(2)}</div>
      </div>
    </div>
  )
}
