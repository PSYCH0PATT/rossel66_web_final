"use client"

import { useEffect, useState } from "react"

export default function SectionOverlay() {
  const [sections, setSections] = useState<{ id: string; rect: DOMRect }[]>([])

  useEffect(() => {
    const updateSectionsInfo = () => {
      const sectionElements = document.querySelectorAll("section")
      const sectionsData = []

      sectionElements.forEach((section) => {
        const rect = section.getBoundingClientRect()
        sectionsData.push({
          id: section.id || "unknown",
          rect,
        })
      })

      setSections(sectionsData)
    }

    // Инициализация
    updateSectionsInfo()

    // Обновляем при изменении размера окна и прокрутке
    window.addEventListener("resize", updateSectionsInfo)
    window.addEventListener("scroll", updateSectionsInfo)

    // Обновляем каждые 200мс для отслеживания динамических изменений
    const interval = setInterval(updateSectionsInfo, 200)

    return () => {
      window.removeEventListener("resize", updateSectionsInfo)
      window.removeEventListener("scroll", updateSectionsInfo)
      clearInterval(interval)
    }
  }, [])

  return (
    <>
      {sections.map((section, index) => (
        <div
          key={index}
          className="pointer-events-none fixed z-[9998]"
          style={{
            top: `${section.rect.top}px`,
            left: `${section.rect.left}px`,
            width: `${section.rect.width}px`,
            height: `${section.rect.height}px`,
            border: "2px solid rgba(16, 185, 129, 0.7)",
            boxSizing: "border-box",
          }}
        >
          <div className="absolute top-0 left-0 bg-black/80 text-white px-1 text-xs rounded-br">{section.id}</div>
          <div className="absolute top-0 right-0 bg-black/80 text-white px-1 text-xs rounded-bl">
            {Math.round(section.rect.height)}px
          </div>
          <div className="absolute bottom-0 left-0 bg-black/80 text-white px-1 text-xs rounded-tr">
            {Math.round(section.rect.top)}px
          </div>
          <div className="absolute bottom-0 right-0 bg-black/80 text-white px-1 text-xs rounded-tl">
            {Math.round(section.rect.width)}px
          </div>
        </div>
      ))}
    </>
  )
}
