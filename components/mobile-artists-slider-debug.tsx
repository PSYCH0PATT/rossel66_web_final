"use client"

import { useEffect, useRef } from "react"

export default function MobileArtistsSliderDebug() {
  const debugRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateDebugInfo = () => {
      if (!debugRef.current) return

      const slider = document.querySelector(".mobile-artists-slider") as HTMLElement
      if (!slider) {
        debugRef.current.innerHTML = "Слайдер не найден"
        return
      }

      const rect = slider.getBoundingClientRect()
      const computedStyle = window.getComputedStyle(slider)

      // Получаем информацию о вложенных элементах
      const childrenInfo = []
      for (let i = 0; i < slider.children.length; i++) {
        const child = slider.children[i] as HTMLElement
        const childRect = child.getBoundingClientRect()
        const childStyle = window.getComputedStyle(child)

        childrenInfo.push({
          index: i,
          height: childRect.height,
          display: childStyle.display,
          position: childStyle.position,
          overflow: childStyle.overflow,
        })
      }

      // Формируем HTML для отображения
      let html = `
        <div class="font-bold text-emerald-400">Слайдер артистов:</div>
        <div class="grid grid-cols-2 gap-x-2 mt-1">
          <div>Высота:</div>
          <div class="text-emerald-400">${Math.round(rect.height)}px</div>
          <div>Ширина:</div>
          <div class="text-emerald-400">${Math.round(rect.width)}px</div>
          <div>Верх:</div>
          <div class="text-emerald-400">${Math.round(rect.top)}px</div>
          <div>Низ:</div>
          <div class="text-emerald-400">${Math.round(rect.bottom)}px</div>
          <div>Position:</div>
          <div class="text-emerald-400">${computedStyle.position}</div>
          <div>Display:</div>
          <div class="text-emerald-400">${computedStyle.display}</div>
          <div>Overflow:</div>
          <div class="text-emerald-400">${computedStyle.overflow}</div>
          <div>z-index:</div>
          <div class="text-emerald-400">${computedStyle.zIndex}</div>
        </div>
      `

      // Добавляем информацию о дочерних элементах
      if (childrenInfo.length > 0) {
        html += `<div class="font-bold text-emerald-400 mt-2">Дочерние элементы:</div>`

        childrenInfo.forEach((child, index) => {
          html += `
            <div class="border-t border-gray-700 mt-1 pt-1">
              <div>Элемент ${index}:</div>
              <div class="grid grid-cols-2 gap-x-2">
                <div>Высота:</div>
                <div class="text-emerald-400">${Math.round(child.height)}px</div>
                <div>Display:</div>
                <div class="text-emerald-400">${child.display}</div>
                <div>Position:</div>
                <div class="text-emerald-400">${child.position}</div>
                <div>Overflow:</div>
                <div class="text-emerald-400">${child.overflow}</div>
              </div>
            </div>
          `
        })
      }

      debugRef.current.innerHTML = html
    }

    // Инициализация
    updateDebugInfo()

    // Обновляем при изменении размера окна
    window.addEventListener("resize", updateDebugInfo)

    // Обновляем каждые 500мс
    const interval = setInterval(updateDebugInfo, 500)

    return () => {
      window.removeEventListener("resize", updateDebugInfo)
      clearInterval(interval)
    }
  }, [])

  return (
    <div
      ref={debugRef}
      className="fixed right-4 bottom-20 z-[9999] bg-black/80 text-white p-2 rounded-md text-xs max-w-[250px]"
    >
      Загрузка информации...
    </div>
  )
}
