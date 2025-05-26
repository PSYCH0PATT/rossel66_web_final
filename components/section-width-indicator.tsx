"use client"

import { useEffect, useState, useRef } from "react"

interface SectionWidthIndicatorProps {
  sectionId: string
}

export default function SectionWidthIndicator({ sectionId }: SectionWidthIndicatorProps) {
  const [width, setWidth] = useState(0)
  const observerRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    const section = document.getElementById(sectionId)
    if (!section) return

    // Функция для обновления ширины
    const updateWidth = () => {
      const sectionWidth = section.offsetWidth
      setWidth(sectionWidth)
    }

    // Инициализация
    updateWidth()

    // Создаем ResizeObserver для отслеживания изменений размера секции
    observerRef.current = new ResizeObserver(updateWidth)
    observerRef.current.observe(section)

    // Также отслеживаем изменение размера окна
    window.addEventListener("resize", updateWidth)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      window.removeEventListener("resize", updateWidth)
    }
  }, [sectionId])

  return (
    <div className="fixed bottom-10 right-4 z-50 bg-black/80 text-white text-xs p-2 rounded">
      {sectionId} width: {width}px
    </div>
  )
}
