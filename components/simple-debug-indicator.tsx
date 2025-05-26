"use client"

import { useEffect, useState } from "react"

// Базовые значения для расчета масштаба
const BASE_WIDTH = 1920
const BASE_HEIGHT = 1080

interface SectionMetrics {
  id: string
  width: number
  height: number
  contentHeight: number
  paddingTop: number
  paddingBottom: number
  scaleFactorWidth: number
  scaleFactorHeight: number
}

export default function SimpleDebugIndicator() {
  const [sections, setSections] = useState<SectionMetrics[]>([])
  const [isVisible, setIsVisible] = useState(false) // По умолчанию скрыто
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [isCollapsed, setIsCollapsed] = useState(true) // Компактный режим по умолчанию

  useEffect(() => {
    const updateMetrics = () => {
      // Обновляем размер окна
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight
      setWindowSize({ width: windowWidth, height: windowHeight })

      const sectionElements = document.querySelectorAll("section")
      const metricsData: SectionMetrics[] = []

      sectionElements.forEach((section) => {
        const sectionEl = section as HTMLElement
        const sectionId = sectionEl.id || "unknown"

        // Получаем основные размеры секции
        const sectionRect = sectionEl.getBoundingClientRect()
        const sectionWidth = sectionRect.width
        const sectionHeight = sectionRect.height

        // Рассчитываем масштаб относительно базовых значений
        const scaleFactorWidth = sectionWidth / BASE_WIDTH
        const scaleFactorHeight = sectionHeight / BASE_HEIGHT

        // Находим контейнер контента (первый дочерний элемент или элемент с классом container)
        const contentContainer = sectionEl.querySelector(".container") || sectionEl.firstElementChild
        let contentHeight = 0

        if (contentContainer) {
          const contentRect = (contentContainer as HTMLElement).getBoundingClientRect()
          contentHeight = contentRect.height
        }

        // Находим отступы (спейсеры)
        const topSpacer = sectionEl.querySelector(".padding-spacer-top") as HTMLElement
        const bottomSpacer = sectionEl.querySelector(".padding-spacer-bottom") as HTMLElement

        const paddingTop = topSpacer ? topSpacer.offsetHeight : 0
        const paddingBottom = bottomSpacer ? bottomSpacer.offsetHeight : 0

        metricsData.push({
          id: sectionId,
          width: Math.round(sectionWidth),
          height: Math.round(sectionHeight),
          contentHeight: Math.round(contentHeight),
          paddingTop: Math.round(paddingTop),
          paddingBottom: Math.round(paddingBottom),
          scaleFactorWidth: Number.parseFloat(scaleFactorWidth.toFixed(3)),
          scaleFactorHeight: Number.parseFloat(scaleFactorHeight.toFixed(3)),
        })
      })

      setSections(metricsData)
    }

    // Инициализация
    updateMetrics()

    // Обновляем при изменении размера окна и прокрутке
    window.addEventListener("resize", updateMetrics)
    window.addEventListener("scroll", updateMetrics)

    // Обновляем каждые 500мс для отслеживания динамических изменений
    const interval = setInterval(updateMetrics, 500)

    return () => {
      window.removeEventListener("resize", updateMetrics)
      window.removeEventListener("scroll", updateMetrics)
      clearInterval(interval)
    }
  }, [])

  // Получаем текущий масштаб из атрибута data-scale
  const getCurrentScale = () => {
    if (typeof document !== "undefined") {
      const scalableContent = document.querySelector(".scalable-content")
      return scalableContent ? Number.parseFloat(scalableContent.getAttribute("data-scale") || "1") : 1
    }
    return 1
  }

  const currentScale = getCurrentScale()

  // Компактный режим показывает только самую важную информацию
  const renderCompactMode = () => (
    <div className="bg-black/80 text-white p-2 rounded-md">
      <div className="flex items-center space-x-2">
        <div className="text-blue-400 font-bold">Масштаб: {currentScale.toFixed(3)}</div>
        <div className="text-emerald-400">
          {windowSize.width}x{windowSize.height}
        </div>
      </div>
    </div>
  )

  // Полный режим показывает все метрики
  const renderFullMode = () => (
    <div className="bg-black/80 text-white p-3 rounded-md max-w-[280px] max-h-[80vh] overflow-auto">
      {/* Информация о размере окна */}
      <div className="mb-4 border-b border-gray-700 pb-2">
        <h3 className="font-bold mb-2 text-blue-400">Размер окна:</h3>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <div>Ширина:</div>
          <div className="text-blue-400">{windowSize.width}px</div>
          <div>Высота:</div>
          <div className="text-blue-400">{windowSize.height}px</div>
          <div>Масштаб контейнера:</div>
          <div className="text-blue-400">{currentScale.toFixed(3)}</div>
        </div>
      </div>

      <h3 className="font-bold mb-2 text-emerald-400">Метрики секций:</h3>

      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.id} className="border-b border-gray-700 pb-2">
            <button
              className="w-full text-left font-semibold mb-1 flex justify-between items-center"
              onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
            >
              <span className="text-emerald-300">{section.id}</span>
              <span className="text-xs text-gray-400">{activeSection === section.id ? "▼" : "▶"}</span>
            </button>

            {activeSection === section.id && (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <div>Ширина:</div>
                <div className="text-emerald-400">{section.width}px</div>

                <div>Высота:</div>
                <div className="text-emerald-400">{section.height}px</div>

                <div>Высота контента:</div>
                <div className="text-emerald-400">{section.contentHeight}px</div>

                <div>Отступ сверху:</div>
                <div className="text-emerald-400">{section.paddingTop}px</div>

                <div>Отступ снизу:</div>
                <div className="text-emerald-400">{section.paddingBottom}px</div>

                <div>Масштаб (ширина):</div>
                <div className="text-yellow-400">{section.scaleFactorWidth}</div>

                <div>Масштаб (высота):</div>
                <div className="text-yellow-400">{section.scaleFactorHeight}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="fixed top-4 right-4 z-[9999] text-xs">
      {/* Кнопка переключения */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-black/80 text-white px-3 py-1 rounded-md mb-2 flex items-center"
      >
        {isVisible ? "Скрыть" : "Показать"} метрики
      </button>

      {isVisible && (
        <div>
          {/* Кнопка переключения режима отображения */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="bg-black/80 text-white px-3 py-1 rounded-md mb-2 w-full text-center"
          >
            {isCollapsed ? "Развернуть" : "Свернуть"}
          </button>

          {/* Отображаем соответствующий режим */}
          {isCollapsed ? renderCompactMode() : renderFullMode()}
        </div>
      )}
    </div>
  )
}
