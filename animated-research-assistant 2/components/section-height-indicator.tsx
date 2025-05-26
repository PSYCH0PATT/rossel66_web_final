"use client"

import { useEffect, useState, useRef } from "react"

interface SectionHeightIndicatorProps {
  sectionId: string
}

export default function SectionHeightIndicator({ sectionId }: SectionHeightIndicatorProps) {
  const [height, setHeight] = useState(0)
  const observerRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    const section = document.getElementById(sectionId)
    if (!section) return

    // Функция для обновления высоты
    const updateHeight = () => {
      const sectionHeight = section.offsetHeight
      setHeight(sectionHeight)
    }

    // Инициализация
    updateHeight()

    // Создаем ResizeObserver для отслеживания изменений размера секции
    observerRef.current = new ResizeObserver(updateHeight)
    observerRef.current.observe(section)

    // Также отслеживаем изменение размера окна
    window.addEventListener("resize", updateHeight)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      window.removeEventListener("resize", updateHeight)
    }
  }, [sectionId])

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/80 text-white text-xs p-2 rounded">
      {sectionId}: {height}px
    </div>
  )
}
