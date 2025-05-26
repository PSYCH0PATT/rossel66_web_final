"use client"

import { useEffect, useState } from "react"

interface SectionInfo {
  id: string
  height: number
  top: number
  width: number
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

export default function CompactDebugPanel() {
  const [sections, setSections] = useState<SectionInfo[]>([])
  const [viewportInfo, setViewportInfo] = useState({
    width: 0,
    height: 0,
    vh100: 0,
    devicePixelRatio: 1,
  })
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [showBorders, setShowBorders] = useState(true)

  useEffect(() => {
    const updateInfo = () => {
      // Получаем информацию о секциях
      const sectionElements = document.querySelectorAll("section")
      const sectionsData: SectionInfo[] = []

      sectionElements.forEach((section) => {
        const rect = section.getBoundingClientRect()
        const computedStyle = window.getComputedStyle(section)

        sectionsData.push({
          id: section.id || "unknown",
          height: rect.height,
          top: rect.top + window.scrollY,
          width: rect.width,
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

      // Создаем тестовый элемент для измерения 100vh
      const testElement = document.createElement("div")
      testElement.style.height = "100vh"
      testElement.style.position = "fixed"
      testElement.style.visibility = "hidden"
      document.body.appendChild(testElement)
      const vh100 = testElement.offsetHeight
      document.body.removeChild(testElement)

      // Обновляем информацию о viewport
      setViewportInfo({
        width: window.innerWidth,
        height: window.innerHeight,
        vh100,
        devicePixelRatio: window.devicePixelRatio,
      })
    }

    // Добавляем/удаляем границы секций
    const toggleBorders = () => {
      const sectionElements = document.querySelectorAll("section")
      sectionElements.forEach((section) => {
        const sectionEl = section as HTMLElement
        if (showBorders) {
          sectionEl.style.border = "1px dashed rgba(16, 185, 129, 0.5)"
        } else {
          sectionEl.style.border = "none"
        }
      })
    }

    // Инициализация
    updateInfo()
    toggleBorders()

    // Обновляем при изменении размера окна и прокрутке
    window.addEventListener("resize", updateInfo)
    window.addEventListener("scroll", updateInfo)

    // Обновляем каждые 500мс для отслеживания динамических изменений
    const interval = setInterval(updateInfo, 500)

    return () => {
      window.removeEventListener("resize", updateInfo)
      window.removeEventListener("scroll", updateInfo)
      clearInterval(interval)

      // Удаляем границы при размонтировании
      const sectionElements = document.querySelectorAll("section")
      sectionElements.forEach((section) => {
        const sectionEl = section as HTMLElement
        sectionEl.style.border = "none"
      })
    }
  }, [showBorders])

  // Функция для форматирования чисел
  const formatNumber = (num: number) => {
    return Math.round(num)
  }

  // Функция для переключения границ
  const toggleBorders = () => {
    setShowBorders(!showBorders)
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] text-xs">
      {/* Кнопка переключения */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-black/80 text-white px-3 py-1 rounded-md mb-2 flex items-center"
      >
        {isExpanded ? "Скрыть" : "Показать"} отладку
      </button>

      {/* Компактная панель с основной информацией */}
      {isExpanded && (
        <div className="bg-black/80 text-white p-2 rounded-md max-w-[200px] max-h-[300px] overflow-auto">
          <div className="flex justify-between items-center mb-2">
            <div className="font-bold text-emerald-400">Отладка</div>
            <button
              onClick={toggleBorders}
              className={`text-xs px-2 py-0.5 rounded ${showBorders ? "bg-emerald-600" : "bg-gray-600"}`}
            >
              {showBorders ? "Скрыть" : "Показать"} границы
            </button>
          </div>

          {/* Информация о viewport */}
          <div className="mb-2">
            <div className="text-emerald-400 font-semibold">Viewport:</div>
            <div className="grid grid-cols-2 gap-x-1">
              <div>Размер:</div>
              <div>
                {formatNumber(viewportInfo.width)}x{formatNumber(viewportInfo.height)}
              </div>
              <div>100vh:</div>
              <div>{formatNumber(viewportInfo.vh100)}px</div>
              <div>DPR:</div>
              <div>{viewportInfo.devicePixelRatio.toFixed(1)}</div>
            </div>
          </div>

          {/* Список секций */}
          <div>
            <div className="text-emerald-400 font-semibold">Секции:</div>
            <div className="space-y-1">
              {sections.map((section, index) => (
                <div key={index} className="border-b border-gray-700 pb-1 last:border-b-0">
                  <button
                    className="w-full text-left flex justify-between items-center"
                    onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                  >
                    <span>{section.id || `Секция ${index + 1}`}</span>
                    <span className="text-emerald-400">{formatNumber(section.height)}px</span>
                  </button>

                  {/* Детальная информация о секции */}
                  {activeSection === section.id && (
                    <div className="mt-1 pl-2 text-gray-300 text-[10px]">
                      <div className="grid grid-cols-2 gap-x-1">
                        <div>Ширина:</div>
                        <div>{formatNumber(section.width)}px</div>
                        <div>Позиция:</div>
                        <div>{formatNumber(section.top)}px</div>
                        <div>Padding верх:</div>
                        <div>{section.computedStyle.paddingTop}</div>
                        <div>Padding низ:</div>
                        <div>{section.computedStyle.paddingBottom}</div>
                        <div>Margin верх:</div>
                        <div>{section.computedStyle.marginTop}</div>
                        <div>Margin низ:</div>
                        <div>{section.computedStyle.marginBottom}</div>
                        <div>Position:</div>
                        <div>{section.computedStyle.position}</div>
                        <div>Display:</div>
                        <div>{section.computedStyle.display}</div>
                        <div>Overflow:</div>
                        <div>{section.computedStyle.overflow}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
