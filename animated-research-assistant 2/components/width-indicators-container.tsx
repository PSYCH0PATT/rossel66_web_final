"use client"

import { useEffect, useState } from "react"
import SectionWidthIndicator from "./section-width-indicator"
import SectionBorderLines from "./section-border-lines"
import ScaleIndicator from "./scale-indicator"
import SectionScaleIndicator from "./section-scale-indicator"

export default function WidthIndicatorsContainer() {
  const [sections, setSections] = useState<string[]>([])
  const [showIndicators, setShowIndicators] = useState(true)
  const [activeSection, setActiveSection] = useState(0)

  useEffect(() => {
    // Собираем все секции на странице
    const sectionElements = document.querySelectorAll("section")
    const sectionIds = Array.from(sectionElements)
      .map((section) => section.id)
      .filter((id) => id) // Фильтруем секции без id

    setSections(sectionIds)

    // Добавляем горячую клавишу для включения/выключения индикаторов
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "w" && e.altKey) {
        setShowIndicators((prev) => !prev)
      }
    }

    // Отслеживаем изменение активной секции
    const handleSectionChange = (e: CustomEvent) => {
      setActiveSection(e.detail.index)
    }

    window.addEventListener("keydown", handleKeyDown)
    document.addEventListener("sectionChange", handleSectionChange as EventListener)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("sectionChange", handleSectionChange as EventListener)
    }
  }, [])

  if (!showIndicators) {
    return (
      <div className="fixed bottom-4 left-4 z-50 bg-black/80 text-white text-xs p-2 rounded">
        Indicators hidden (Alt+W to show)
      </div>
    )
  }

  // Получаем ID активной секции
  const activeSectionId = sections[activeSection] || "hero"

  return (
    <>
      <div className="fixed bottom-4 left-4 z-50 bg-black/80 text-white text-xs p-2 rounded">
        Indicators visible (Alt+W to hide)
      </div>

      {/* Глобальный индикатор масштаба */}
      <ScaleIndicator />

      {/* Индикатор масштаба для активной секции */}
      <SectionScaleIndicator sectionId={activeSectionId} baseWidth={1920} baseHeight={1080} />

      {/* Линии границ для всех секций */}
      {sections.map((sectionId, index) => (
        <SectionBorderLines
          key={`border-${sectionId}`}
          sectionId={sectionId}
          color={`rgba(16, ${185 - index * 20}, 129, 0.7)`}
        />
      ))}

      {/* Индикаторы ширины для всех секций */}
      <div className="fixed right-4 bottom-20 z-50 flex flex-col gap-2">
        {sections.map((sectionId, index) => (
          <SectionWidthIndicator key={`indicator-${sectionId}`} sectionId={sectionId} />
        ))}
      </div>
    </>
  )
}
