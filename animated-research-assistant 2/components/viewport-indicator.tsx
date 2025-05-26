"use client"

import { useEffect, useState } from "react"

export default function ViewportIndicator() {
  const [viewportInfo, setViewportInfo] = useState({
    width: 0,
    height: 0,
    visualViewportWidth: 0,
    visualViewportHeight: 0,
    devicePixelRatio: 1,
    orientation: "",
  })

  useEffect(() => {
    const updateViewportInfo = () => {
      const orientation = window.innerWidth > window.innerHeight ? "landscape" : "portrait"

      setViewportInfo({
        width: window.innerWidth,
        height: window.innerHeight,
        visualViewportWidth: window.visualViewport?.width || window.innerWidth,
        visualViewportHeight: window.visualViewport?.height || window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        orientation,
      })
    }

    // Инициализация
    updateViewportInfo()

    // Обновляем при изменении размера окна
    window.addEventListener("resize", updateViewportInfo)

    // Если доступен visualViewport API, используем его
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewportInfo)
      window.visualViewport.addEventListener("scroll", updateViewportInfo)
    }

    return () => {
      window.removeEventListener("resize", updateViewportInfo)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewportInfo)
        window.visualViewport.removeEventListener("scroll", updateViewportInfo)
      }
    }
  }, [])

  return (
    <div className="fixed top-16 right-4 z-[9999] bg-black/80 text-white px-2 py-1 rounded-md text-xs">
      <div>
        Window: {Math.round(viewportInfo.width)}x{Math.round(viewportInfo.height)}
      </div>
      <div>
        Visual: {Math.round(viewportInfo.visualViewportWidth)}x{Math.round(viewportInfo.visualViewportHeight)}
      </div>
      <div>DPR: {viewportInfo.devicePixelRatio.toFixed(2)}</div>
      <div>{viewportInfo.orientation}</div>
    </div>
  )
}
