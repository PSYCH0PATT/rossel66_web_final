"use client"

import { useEffect, useState } from "react"

interface SectionInfo {
  id: string
  height: number
  top: number
  bottom: number
  left: number
  right: number
  width: number
  zIndex: number
  computedStyle: {
    paddingTop: string
    paddingBottom: string
    marginTop: string
    marginBottom: string
    position: string
    display: string
    overflow: string
  }
}

export default function DebugIndicators() {
  const [sections, setSections] = useState<SectionInfo[]>([])
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [scrollPosition, setScrollPosition] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState("dimensions")

  useEffect(() => {
    const updateSectionsInfo = () => {
      const sectionElements = document.querySelectorAll("section")
      const sectionsData: SectionInfo[] = []

      sectionElements.forEach((section) => {
        const rect = section.getBoundingClientRect()
        const computedStyle = window.getComputedStyle(section)

        sectionsData.push({
          id: section.id || "unknown",
          height: rect.height,
          top: rect.top + window.scrollY,
          bottom: rect.bottom + window.scrollY,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          zIndex: Number.parseInt(computedStyle.zIndex) || 0,
          computedStyle: {
            paddingTop: computedStyle.paddingTop,
            paddingBottom: computedStyle.paddingBottom,
            marginTop: computedStyle.marginTop,
            marginBottom: computedStyle.marginBottom,
            position: computedStyle.position,
            display: computedStyle.display,
            overflow: computedStyle.overflow,
          },
        })
      })

      setSections(sectionsData)
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
      setScrollPosition(window.scrollY)
    }

    // Добавляем границы к секциям
    const addBorders = () => {
      const sectionElements = document.querySelectorAll("section")

      sectionElements.forEach((section) => {
        const sectionEl = section as HTMLElement
        sectionEl.style.border = "2px dashed rgba(16, 185, 129, 0.5)"
      })
    }

    // Инициализация
    updateSectionsInfo()
    addBorders()

    // Обновляем при изменении размера окна и прокрутке
    window.addEventListener("resize", updateSectionsInfo)
    window.addEventListener("scroll", updateSectionsInfo)

    // Обновляем каждые 500мс для отслеживания динамических изменений
    const interval = setInterval(updateSectionsInfo, 500)

    return () => {
      window.removeEventListener("resize", updateSectionsInfo)
      window.removeEventListener("scroll", updateSectionsInfo)
      clearInterval(interval)

      // Удаляем границы при размонтировании
      const sectionElements = document.querySelectorAll("section")
      sectionElements.forEach((section) => {
        const sectionEl = section as HTMLElement
        sectionEl.style.border = "none"
      })
    }
  }, [])

  // Функция для форматирования чисел
  const formatNumber = (num: number) => {
    return Math.round(num)
  }

  return (
    <div className="fixed bottom-4 left-4 z-[9999] text-xs">
      {/* Кнопка переключения */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-black/80 text-white px-3 py-1 rounded-md mb-2 flex items-center"
      >
        {isExpanded ? "Скрыть" : "Показать"} индикаторы
      </button>

      {isExpanded && (
        <div className="bg-black/80 text-white p-2 rounded-md max-w-[300px] max-h-[300px] overflow-auto">
          {/* Табы */}
          <div className="flex mb-2 border-b border-gray-700">
            <button
              className={`px-2 py-1 ${activeTab === "dimensions" ? "bg-emerald-800/50 text-white" : "text-gray-400"}`}
              onClick={() => setActiveTab("dimensions")}
            >
              Размеры
            </button>
            <button
              className={`px-2 py-1 ${activeTab === "styles" ? "bg-emerald-800/50 text-white" : "text-gray-400"}`}
              onClick={() => setActiveTab("styles")}
            >
              Стили
            </button>
            <button
              className={`px-2 py-1 ${activeTab === "viewport" ? "bg-emerald-800/50 text-white" : "text-gray-400"}`}
              onClick={() => setActiveTab("viewport")}
            >
              Viewport
            </button>
          </div>

          {/* Содержимое табов */}
          {activeTab === "dimensions" && (
            <div>
              <h3 className="font-bold mb-1 text-emerald-400">Размеры секций:</h3>
              <div className="space-y-2">
                {sections.map((section, index) => (
                  <div key={index} className="border-b border-gray-700 pb-1">
                    <div className="font-semibold">{section.id || `Секция ${index + 1}`}</div>
                    <div className="grid grid-cols-2 gap-x-2">
                      <div>Высота:</div>
                      <div className="text-emerald-400">{formatNumber(section.height)}px</div>
                      <div>Ширина:</div>
                      <div className="text-emerald-400">{formatNumber(section.width)}px</div>
                      <div>Верх:</div>
                      <div className="text-emerald-400">{formatNumber(section.top)}px</div>
                      <div>Низ:</div>
                      <div className="text-emerald-400">{formatNumber(section.bottom)}px</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "styles" && (
            <div>
              <h3 className="font-bold mb-1 text-emerald-400">Стили секций:</h3>
              <div className="space-y-2">
                {sections.map((section, index) => (
                  <div key={index} className="border-b border-gray-700 pb-1">
                    <div className="font-semibold">{section.id || `Секция ${index + 1}`}</div>
                    <div className="grid grid-cols-2 gap-x-2">
                      <div>Padding верх:</div>
                      <div className="text-emerald-400">{section.computedStyle.paddingTop}</div>
                      <div>Padding низ:</div>
                      <div className="text-emerald-400">{section.computedStyle.paddingBottom}</div>
                      <div>Margin верх:</div>
                      <div className="text-emerald-400">{section.computedStyle.marginTop}</div>
                      <div>Margin низ:</div>
                      <div className="text-emerald-400">{section.computedStyle.marginBottom}</div>
                      <div>Position:</div>
                      <div className="text-emerald-400">{section.computedStyle.position}</div>
                      <div>Display:</div>
                      <div className="text-emerald-400">{section.computedStyle.display}</div>
                      <div>Overflow:</div>
                      <div className="text-emerald-400">{section.computedStyle.overflow}</div>
                      <div>z-index:</div>
                      <div className="text-emerald-400">{section.zIndex}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "viewport" && (
            <div>
              <h3 className="font-bold mb-1 text-emerald-400">Информация о viewport:</h3>
              <div className="grid grid-cols-2 gap-x-2">
                <div>Ширина viewport:</div>
                <div className="text-emerald-400">{formatNumber(viewportSize.width)}px</div>
                <div>Высота viewport:</div>
                <div className="text-emerald-400">{formatNumber(viewportSize.height)}px</div>
                <div>Позиция скролла:</div>
                <div className="text-emerald-400">{formatNumber(scrollPosition)}px</div>
                <div>window.innerHeight:</div>
                <div className="text-emerald-400">{typeof window !== "undefined" ? window.innerHeight : 0}px</div>
                <div>document.body.clientHeight:</div>
                <div className="text-emerald-400">
                  {typeof document !== "undefined" ? document.body.clientHeight : 0}px
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Компактные индикаторы размеров для каждой секции */}
      <div className="fixed top-4 left-4 z-[9999] space-y-1">
        {sections.map((section, index) => (
          <div
            key={index}
            className="bg-black/80 text-white px-2 py-1 rounded-md text-xs"
            style={{ transform: `translateY(${index * 24}px)` }}
          >
            {section.id}: {formatNumber(section.height)}px
          </div>
        ))}
      </div>

      {/* Индикатор viewport */}
      <div className="fixed top-4 right-4 z-[9999] bg-black/80 text-white px-2 py-1 rounded-md text-xs">
        Viewport: {formatNumber(viewportSize.width)}x{formatNumber(viewportSize.height)}
      </div>
    </div>
  )
}
