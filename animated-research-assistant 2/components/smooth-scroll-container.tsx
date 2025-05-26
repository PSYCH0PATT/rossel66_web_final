"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

interface SmoothScrollContainerProps {
  children: ReactNode
}

export default function SmoothScrollContainer({ children }: SmoothScrollContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentSection, setCurrentSection] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [sections, setSections] = useState<HTMLElement[]>([])
  const [navDots, setNavDots] = useState<HTMLElement[]>([])
  const animationFrameIdRef = useRef<number | null>(null)
  const currentPositionRef = useRef(0)
  const targetPositionRef = useRef(0)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Функция обновления активного раздела
  const updateActiveSection = (index: number) => {
    sections.forEach((section, i) => {
      if (i === index) {
        section.classList.add("active")
      } else {
        section.classList.remove("active")
      }
    })

    // Обновляем навигационные точки
    navDots.forEach((dot, i) => {
      if (i === index) {
        dot.classList.add("active")
      } else {
        dot.classList.remove("active")
      }
    })

    // Отправляем событие об изменении секции
    const event = new CustomEvent("sectionChange", {
      detail: { index: index },
    })
    document.dispatchEvent(event)
  }

  // Функция анимации прокрутки
  const animateScroll = () => {
    // Вычисляем разницу между текущим и целевым положением
    const diff = targetPositionRef.current - currentPositionRef.current

    // Если мы почти достигли цели, просто установим точное значение
    if (Math.abs(diff) < 0.5) {
      currentPositionRef.current = targetPositionRef.current
      window.scrollTo(0, currentPositionRef.current)

      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
        animationFrameIdRef.current = null
      }

      // Важно: вызываем после завершения анимации
      updateActiveSection(currentSection)

      // Устанавливаем таймаут для разблокировки прокрутки
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      scrollTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false) // Анимация завершена
      }, 400)

      return
    }

    // Очень плавное движение (меньше значение - плавнее)
    currentPositionRef.current += diff * 0.05 // Немного увеличил скорость

    // Применяем текущую позицию к скроллу
    window.scrollTo(0, currentPositionRef.current)

    // Продолжаем анимацию
    animationFrameIdRef.current = requestAnimationFrame(animateScroll)
  }

  // Функция для перехода к секции
  const goToSection = (index: number) => {
    if (isAnimating || index === currentSection || index < 0 || index >= sections.length) return

    setCurrentSection(index)
    targetPositionRef.current = index * window.innerHeight

    // Если анимация уже запущена, отменим её и начнем новую
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current)
    }

    setIsAnimating(true)
    animationFrameIdRef.current = requestAnimationFrame(animateScroll)
  }

  useEffect(() => {
    if (!containerRef.current) return

    // Находим все секции
    const sectionElements = Array.from(document.querySelectorAll("section")) as HTMLElement[]
    setSections(sectionElements)

    // Задаем высоту секций равной высоте экрана
    sectionElements.forEach((section) => {
      section.style.minHeight = `${window.innerHeight}px`
    })

    // Создаем навигационные точки
    const navigation = document.createElement("div")
    navigation.className = "fixed right-6 top-1/2 transform -translate-y-1/2 z-50 flex flex-col space-y-3"

    sectionElements.forEach((_, index) => {
      const dot = document.createElement("div")
      dot.className = `w-3 h-3 rounded-full transition-all duration-300 ${
        index === 0 ? "bg-emerald-500 scale-125 active" : "bg-white/50 hover:bg-white/80"
      }`
      dot.dataset.section = `section${index + 1}`
      dot.addEventListener("click", () => goToSection(index))
      navigation.appendChild(dot)
    })

    document.body.appendChild(navigation)
    setNavDots(Array.from(navigation.querySelectorAll(".nav-dot, div[data-section]")))

    // Инициализация активного раздела
    setCurrentSection(0)
    sectionElements[0]?.classList.add("active")

    // Установка начальной позиции
    currentPositionRef.current = 0
    targetPositionRef.current = 0
    window.scrollTo(0, 0)

    // Запретить стандартную прокрутку
    document.body.style.overflow = "hidden"

    // Обработчик события колесика мыши - ключ к решению проблемы
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault() // Отменяем стандартную прокрутку

      if (isAnimating) return

      // Определяем направление
      const direction = Math.sign(e.deltaY)

      // Определяем следующую секцию
      const nextSection = Math.min(Math.max(currentSection + direction, 0), sectionElements.length - 1)

      if (nextSection !== currentSection) {
        goToSection(nextSection)
      }
    }

    // Обработка событий клавиатуры (стрелки вверх/вниз)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()

        if (isAnimating) return

        const direction = e.key === "ArrowDown" ? 1 : -1
        const nextSection = Math.min(Math.max(currentSection + direction, 0), sectionElements.length - 1)

        if (nextSection !== currentSection) {
          goToSection(nextSection)
        }
      }
    }

    // Обработка свайпов для мобильных устройств
    let touchStartY = 0

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (isAnimating) return

      const touchEndY = e.changedTouches[0].clientY
      const diff = touchStartY - touchEndY

      if (Math.abs(diff) > 50) {
        // Минимальное расстояние для определения свайпа
        const direction = Math.sign(diff)
        const nextSection = Math.min(Math.max(currentSection + direction, 0), sectionElements.length - 1)

        if (nextSection !== currentSection) {
          goToSection(nextSection)
        }
      }
    }

    // Обработчик для кастомного события перехода к секции
    const handleGoToSection = (e: CustomEvent) => {
      const { index } = e.detail
      goToSection(index)
    }

    // Адаптируем при изменении размера окна
    const handleResize = () => {
      // Обновляем высоту секций
      sectionElements.forEach((section) => {
        section.style.minHeight = `${window.innerHeight}px`
      })

      targetPositionRef.current = currentSection * window.innerHeight
      currentPositionRef.current = targetPositionRef.current
      window.scrollTo(0, currentPositionRef.current)
    }

    // Добавляем обработчики событий
    document.addEventListener("wheel", handleWheel, { passive: false })
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("touchstart", handleTouchStart, { passive: true })
    document.addEventListener("touchend", handleTouchEnd, { passive: true })
    document.addEventListener("goToSection", handleGoToSection as EventListener)
    window.addEventListener("resize", handleResize)

    // Запрещаем стандартную прокрутку с помощью touchmove для мобильных устройств
    const preventTouchMove = (e: TouchEvent) => {
      e.preventDefault()
    }
    document.addEventListener("touchmove", preventTouchMove, { passive: false })

    // Обработчики для стрелок навигации
    const arrows = document.querySelectorAll(".scroll-arrow")
    arrows.forEach((arrow) => {
      arrow.addEventListener("click", (e) => {
        const direction = (arrow as HTMLElement).dataset.direction === "up" ? -1 : 1
        const nextSection = Math.min(Math.max(currentSection + direction, 0), sectionElements.length - 1)

        if (nextSection !== currentSection) {
          goToSection(nextSection)
        }
      })
    })

    // Очистка при размонтировании
    return () => {
      document.removeEventListener("wheel", handleWheel)
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchend", handleTouchEnd)
      document.removeEventListener("touchmove", preventTouchMove)
      document.removeEventListener("goToSection", handleGoToSection as EventListener)
      window.removeEventListener("resize", handleResize)

      // Восстановление прокрутки страницы
      document.body.style.overflow = ""

      if (navigation.parentNode) {
        navigation.parentNode.removeChild(navigation)
      }

      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [currentSection, isAnimating])

  return (
    <div ref={containerRef} className="smooth-scroll-container">
      {children}
      {/* Отладочная информация */}
      <div className="fixed bottom-4 left-4 z-50 bg-black/80 text-white text-xs p-2 rounded">
        Секция: {currentSection + 1} / {sections.length}
      </div>
    </div>
  )
}
