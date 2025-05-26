"use client"

import { useEffect, useState } from "react"

export default function ArtistsSectionDebug() {
  const [isVisible, setIsVisible] = useState(false)
  const [debugInfo, setDebugInfo] = useState({
    height: 0,
    innerHeight: 0,
    vh100: 0,
    ratio: 0,
    mobileSliderHeight: 0,
    mobileSliderStyle: {
      position: "",
      display: "",
      overflow: "",
      height: "",
      minHeight: "",
    },
    childrenHeights: [] as number[],
  })

  useEffect(() => {
    const updateDebugInfo = () => {
      // Получаем секцию артистов
      const artistsSection = document.getElementById("artists")
      if (!artistsSection) return

      // Получаем мобильный слайдер
      const mobileSlider = document.querySelector(".mobile-artists-slider") as HTMLElement

      // Создаем тестовый элемент для измерения 100vh и 100vw
      const testElement = document.createElement("div")
      testElement.style.height = "100vh"
      testElement.style.width = "100vw"
      testElement.style.position = "fixed"
      testElement.style.visibility = "hidden"
      document.body.appendChild(testElement)
      const vh100 = testElement.offsetHeight
      const vw100 = testElement.offsetWidth
      document.body.removeChild(testElement)

      // Собираем высоты дочерних элементов
      const childrenHeights: number[] = []
      if (mobileSlider) {
        Array.from(mobileSlider.children).forEach((child) => {
          childrenHeights.push((child as HTMLElement).offsetHeight)
        })
      }

      // Обновляем информацию
      setDebugInfo({
        height: artistsSection.offsetHeight,
        innerHeight: window.innerHeight,
        vh100,
        ratio: artistsSection.offsetHeight / vh100,
        mobileSliderHeight: mobileSlider ? mobileSlider.offsetHeight : 0,
        mobileSliderStyle: mobileSlider
          ? {
              position: window.getComputedStyle(mobileSlider).position,
              display: window.getComputedStyle(mobileSlider).display,
              overflow: window.getComputedStyle(mobileSlider).overflow,
              height: window.getComputedStyle(mobileSlider).height,
              minHeight: window.getComputedStyle(mobileSlider).minHeight,
            }
          : {
              position: "",
              display: "",
              overflow: "",
              height: "",
              minHeight: "",
            },
        childrenHeights,
      })

      // Проверяем, занимает ли слайдер всю ширину экрана
      if (mobileSlider) {
        const sliderWidth = mobileSlider.offsetWidth
        const isFullWidth = Math.abs(sliderWidth - vw100) < 5 // Допускаем небольшую погрешность

        // Добавляем индикатор полной ширины
        const fullWidthIndicator = document.createElement("div")
        fullWidthIndicator.className =
          "fixed top-20 left-4 z-[9999] bg-black/80 text-white px-2 py-1 rounded-md text-xs"
        fullWidthIndicator.textContent = `Полная ширина: ${isFullWidth ? "Да" : "Нет"} (${sliderWidth}px / ${vw100}px)`

        // Удаляем предыдущий индикатор, если он есть
        const existingIndicator = document.querySelector(".full-width-indicator")
        if (existingIndicator) {
          existingIndicator.remove()
        }

        fullWidthIndicator.classList.add("full-width-indicator")
        document.body.appendChild(fullWidthIndicator)
      }
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
    <div className="fixed top-4 left-4 z-[9999] text-xs">
      <button onClick={() => setIsVisible(!isVisible)} className="bg-black/80 text-white px-3 py-1 rounded-md mb-2">
        {isVisible ? "Скрыть" : "Показать"} отладку артистов
      </button>

      {isVisible && (
        <div className="bg-black/80 text-white p-2 rounded-md max-w-[200px]">
          <div className="font-bold text-emerald-400 mb-1">Секция артистов:</div>
          <div className="grid grid-cols-2 gap-x-1">
            <div>Высота секции:</div>
            <div className="text-emerald-400">{Math.round(debugInfo.height)}px</div>
            <div>innerHeight:</div>
            <div className="text-emerald-400">{Math.round(debugInfo.innerHeight)}px</div>
            <div>100vh:</div>
            <div className="text-emerald-400">{Math.round(debugInfo.vh100)}px</div>
            <div>Соотношение:</div>
            <div className="text-emerald-400">{debugInfo.ratio.toFixed(2)}</div>
          </div>

          {debugInfo.mobileSliderHeight > 0 && (
            <>
              <div className="font-bold text-emerald-400 mt-2 mb-1">Мобильный слайдер:</div>
              <div className="grid grid-cols-2 gap-x-1">
                <div>Высота:</div>
                <div className="text-emerald-400">{Math.round(debugInfo.mobileSliderHeight)}px</div>
                <div>Position:</div>
                <div className="text-emerald-400">{debugInfo.mobileSliderStyle.position}</div>
                <div>Display:</div>
                <div className="text-emerald-400">{debugInfo.mobileSliderStyle.display}</div>
                <div>Overflow:</div>
                <div className="text-emerald-400">{debugInfo.mobileSliderStyle.overflow}</div>
                <div>Height:</div>
                <div className="text-emerald-400">{debugInfo.mobileSliderStyle.height}</div>
                <div>Min-height:</div>
                <div className="text-emerald-400">{debugInfo.mobileSliderStyle.minHeight}</div>
              </div>

              {debugInfo.childrenHeights.length > 0 && (
                <>
                  <div className="font-bold text-emerald-400 mt-2 mb-1">Дочерние элементы:</div>
                  {debugInfo.childrenHeights.map((height, index) => (
                    <div key={index} className="grid grid-cols-2 gap-x-1">
                      <div>Элемент {index}:</div>
                      <div className="text-emerald-400">{Math.round(height)}px</div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
