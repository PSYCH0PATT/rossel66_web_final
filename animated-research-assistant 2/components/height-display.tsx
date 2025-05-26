"use client"

import { useEffect, useState } from "react"

interface HeightDisplayProps {
  sectionId: string
}

export default function HeightDisplay({ sectionId }: HeightDisplayProps) {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const updateHeight = () => {
      const section = document.getElementById(sectionId)
      if (section) {
        setHeight(section.offsetHeight)
      }
    }

    // Обновляем высоту при монтировании
    updateHeight()

    // Обновляем высоту при изменении размера окна
    window.addEventListener("resize", updateHeight)

    // Создаем MutationObserver для отслеживания изменений в DOM
    const observer = new MutationObserver(updateHeight)
    const section = document.getElementById(sectionId)

    if (section) {
      observer.observe(section, {
        attributes: true,
        childList: true,
        subtree: true,
      })
    }

    // Периодически обновляем высоту на случай, если другие события изменили размер
    const interval = setInterval(updateHeight, 1000)

    return () => {
      window.removeEventListener("resize", updateHeight)
      observer.disconnect()
      clearInterval(interval)
    }
  }, [sectionId])

  return (
    <div className="absolute bottom-4 right-4 z-50 bg-black/80 text-white text-xs p-2 rounded">
      {sectionId}: {height}px
    </div>
  )
}
