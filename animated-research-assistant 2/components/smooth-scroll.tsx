"use client"

import { useEffect, useState, useRef } from "react"

// Добавим функцию для определения браузера и платформы
function getBrowserInfo() {
  const userAgent = navigator.userAgent
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent)
  const isFirefox = userAgent.toLowerCase().indexOf("firefox") > -1
  const isChrome = userAgent.toLowerCase().indexOf("chrome") > -1 && !isSafari
  const isEdge = userAgent.toLowerCase().indexOf("edg") > -1
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
  const isWindows = navigator.platform.toUpperCase().indexOf("WIN") >= 0
  const isLinux = navigator.platform.toUpperCase().indexOf("LINUX") >= 0

  return {
    browser: isSafari ? "Safari" : isFirefox ? "Firefox" : isChrome ? "Chrome" : isEdge ? "Edge" : "Other",
    platform: isMac ? "Mac" : isWindows ? "Windows" : isLinux ? "Linux" : "Other",
    isSafari,
    isMac,
  }
}

export default function SmoothScroll() {
  const [currentSection, setCurrentSection] = useState(0)
  const [sections, setSections] = useState<HTMLElement[]>([])
  const [totalSections, setTotalSections] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const lastInteractionTime = useRef(Date.now())
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isTransitioningRef = useRef(false)
  const currentSectionRef = useRef(0)
  const lastWheelTime = useRef(0)
  const lastWheelDirection = useRef(0)
  const wheelDebounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Инициализация при монтировании
  useEffect(() => {
    // Получаем все секции по ID, как в навигационном меню
    const sectionIds = ["hero", "facts", "services", "partners", "artists", "contact", "faq", "footer"]
    const sectionElements = sectionIds.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]

    setSections(sectionElements)
    setTotalSections(sectionElements.length)

    // Определяем текущую секцию на основе положения прокрутки
    const determineCurrentSection = () => {
      const scrollPosition = window.scrollY
      const windowHeight = window.innerHeight

      for (let i = 0; i < sectionElements.length; i++) {
        const section = sectionElements[i]
        const sectionTop = section.offsetTop
        const sectionBottom = sectionTop + section.offsetHeight

        if (scrollPosition >= sectionTop - windowHeight / 3 && scrollPosition < sectionBottom - windowHeight / 3) {
          return i
        }
      }

      return 0
    }

    const initialSection = determineCurrentSection()
    setCurrentSection(initialSection)
    currentSectionRef.current = initialSection

    // Отключаем стандартную прокрутку
    document.body.style.overflow = "hidden"

    return () => {
      // Восстанавливаем стандартную прокрутку при размонтировании
      document.body.style.overflow = ""
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current)
      }
      if (wheelDebounceTimer.current) {
        clearTimeout(wheelDebounceTimer.current)
      }
    }
  }, [])

  // Также обновим функцию goToSection для использования той же логики
  const goToSection = (index: number) => {
    // Проверяем только валидность индекса секции
    if (index < 0 || index >= totalSections) {
      return
    }

    // Проверяем, прошло ли достаточно времени с последнего взаимодействия
    const now = Date.now()
    if (now - lastInteractionTime.current < 300) {
      return
    }

    // Проверяем, не происходит ли уже переход
    if (isTransitioningRef.current) {
      return
    }

    lastInteractionTime.current = now

    // Обновляем состояние перехода
    setIsTransitioning(true)
    isTransitioningRef.current = true

    // Прокручиваем к новой секции
    if (sections[index]) {
      const targetSection = sections[index]
      targetSection.scrollIntoView({ behavior: "smooth" })

      // Обновляем текущую секцию только после завершения анимации прокрутки
      setTimeout(() => {
        setCurrentSection(index)
        currentSectionRef.current = index

        // Отправляем событие об изменении секции для обновления навбара
        const event = new CustomEvent("sectionChange", {
          detail: { index: index },
        })
        document.dispatchEvent(event)

        // Сбрасываем состояние перехода
        setTimeout(() => {
          setIsTransitioning(false)
          isTransitioningRef.current = false
        }, 100)
      }, 600) // Задержка для завершения анимации прокрутки
    }
  }

  // Функция для выполнения перехода к секции
  const performSectionTransition = (direction: number) => {
    // Если уже идет переход, игнорируем
    if (isTransitioningRef.current) {
      console.log(`[Wheel Transition] Ignoring - transition already in progress`)
      return
    }

    const targetSection = currentSectionRef.current + direction

    console.log(`[Wheel Transition] Direction: ${direction}, Target section: ${targetSection}`)

    // Проверяем валидность индекса секции
    if (targetSection < 0 || targetSection >= sections.length) {
      console.log(`[Wheel Transition] Invalid target section: ${targetSection}, max: ${sections.length - 1}`)
      return
    }

    // Устанавливаем состояние перехода
    console.log(`[Wheel Transition] Starting transition to section ${targetSection}`)
    setIsTransitioning(true)
    isTransitioningRef.current = true

    // Прокручиваем к секции точно так же, как это делается при клике на меню
    if (sections[targetSection]) {
      const targetSectionElement = sections[targetSection]

      // Всегда используем плавную прокрутку
      console.log(`[Wheel Transition] Scrolling to section ${targetSection} (smooth)`)
      targetSectionElement.scrollIntoView({ behavior: "smooth" })

      // Отправляем событие об изменении секции ПОСЛЕ завершения прокрутки
      setTimeout(() => {
        // Обновляем текущую секцию только после завершения анимации прокрутки
        console.log(`[Transition] Animation completed, updating current section to ${targetSection}`)
        setCurrentSection(targetSection)
        currentSectionRef.current = targetSection

        // Отправляем событие об изменении секции для обновления навбара
        const event = new CustomEvent("sectionChange", {
          detail: { index: targetSection },
        })
        document.dispatchEvent(event)

        // Сбрасываем состояние перехода
        setTimeout(() => {
          console.log(`[Transition] Resetting transition state`)
          setIsTransitioning(false)
          isTransitioningRef.current = false
        }, 100)
      }, 600) // Стандартная задержка для завершения анимации прокрутки
    }
  }

  // Изменим обработчик колесика мыши, чтобы не обновлять активную секцию до завершения прокрутки
  function wheelHandler(e: WheelEvent) {
    // Не предотвращаем стандартное поведение прокрутки, если мы находимся в нижней части страницы
    // ИСПРАВЛЕНИЕ: Проверяем, находимся ли мы в нижней части страницы
    const isAtBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100

    if (!isAtBottom) {
      e.preventDefault()
    }

    // Если уже идет переход, игнорируем
    if (isTransitioningRef.current) {
      console.log(`[Wheel Event] Ignoring wheel event - transition in progress`)
      return
    }

    const { isMac } = getBrowserInfo()
    const now = Date.now()
    const direction = e.deltaY > 0 ? 1 : -1

    console.log(`[Wheel Event] Exact deltaY value: ${e.deltaY.toFixed(6)}`)
    console.log(
      `[Wheel Event] Current section: ${currentSectionRef.current}, isTransitioning: ${isTransitioningRef.current}`,
    )

    // === ОБРАБОТКА ДЛЯ MAC ===
    if (isMac) {
      // Очищаем предыдущий таймер, если он существует
      if (wheelDebounceTimer.current) {
        clearTimeout(wheelDebounceTimer.current)
      }

      // Более простая логика для Mac - просто увеличиваем задержку
      wheelDebounceTimer.current = setTimeout(() => {
        // Проверим, что за это время не было начато другого перехода
        if (!isTransitioningRef.current) {
          console.log(`[Mac] Processing wheel event, direction: ${direction}`)
          performSectionTransition(direction)
        }
      }, 200) // Чуть большая задержка для Mac, но не слишком большая
    }
    // === ОБРАБОТКА ДЛЯ WINDOWS (БЕЗ ИЗМЕНЕНИЙ) ===
    else {
      // Стандартная обработка для других платформ с дебаунсом
      if (wheelDebounceTimer.current) {
        console.log(`[Wheel Event] Clearing previous debounce timer`)
        clearTimeout(wheelDebounceTimer.current)
      }

      // Устанавливаем новый таймер с задержкой
      console.log(`[Wheel Event] Setting new debounce timer (100ms)`)
      wheelDebounceTimer.current = setTimeout(() => {
        performSectionTransition(direction)
      }, 100) // Задержка дебаунсинга 100 мс
    }

    // Сохраняем время и направление последнего события колесика
    lastWheelTime.current = now
    lastWheelDirection.current = direction
  }

  // Обработчик клавиатуры
  function keyHandler(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()

      const direction = e.key === "ArrowDown" ? 1 : -1
      goToSection(currentSectionRef.current + direction)
    }
  }

  // Обработчик свайпов для мобильных устройств
  let touchStartY = 0

  function touchStartHandler(e: TouchEvent) {
    touchStartY = e.touches[0].clientY
  }

  function touchEndHandler(e: TouchEvent) {
    const touchEndY = e.changedTouches[0].clientY
    const diff = touchStartY - touchEndY

    if (Math.abs(diff) > 50) {
      const direction = diff > 0 ? 1 : -1
      goToSection(currentSectionRef.current + direction)
    }
  }

  // Регистрация обработчиков событий
  useEffect(() => {
    if (sections.length === 0) {
      return
    }

    // Удаляем предыдущие обработчики перед регистрацией новых
    window.removeEventListener("wheel", wheelHandler)
    document.removeEventListener("keydown", keyHandler)
    document.removeEventListener("touchstart", touchStartHandler)
    document.removeEventListener("touchend", touchEndHandler)

    // Добавляем обработчики событий
    window.addEventListener("wheel", wheelHandler, { passive: false })
    document.addEventListener("keydown", keyHandler)
    document.addEventListener("touchstart", touchStartHandler, { passive: true })
    document.addEventListener("touchend", touchEndHandler, { passive: true })

    // Также принудительно отключим стандартную прокрутку еще раз
    document.body.style.overflow = "hidden"

    return () => {
      // Удаляем обработчики при размонтировании или обновлении useEffect
      window.removeEventListener("wheel", wheelHandler)
      document.removeEventListener("keydown", keyHandler)
      document.removeEventListener("touchstart", touchStartHandler)
      document.removeEventListener("touchend", touchEndHandler)

      // Очищаем таймер дебаунсинга при размонтировании
      if (wheelDebounceTimer.current) {
        clearTimeout(wheelDebounceTimer.current)
      }

      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current)
      }
    }
  }, [sections, totalSections])

  // Также изменим обработчик события sectionChange, чтобы использовать ту же логики
  const handleSectionChange = (e: CustomEvent) => {
    const { index } = e.detail

    console.log(
      `[Section Change] Target index: ${index}, Current: ${currentSectionRef.current}, isTransitioning: ${isTransitioningRef.current}`,
    )

    // Проверяем, не происходит ли уже переход
    if (isTransitioningRef.current) {
      console.log(`[Section Change] Ignoring - transition already in progress`)
      return
    }

    // Устанавливаем состояние перехода
    console.log(`[Section Change] Starting transition to section ${index}`)
    setIsTransitioning(true)
    isTransitioningRef.current = true

    // Прокручиваем к секции
    if (sections[index]) {
      const targetSection = sections[index]

      // Всегда используем плавную прокрутку
      console.log(`[Section Change] Scrolling to section ${index} (smooth)`)
      targetSection.scrollIntoView({ behavior: "smooth" })

      // Обновляем текущую секцию только после завершения анимации прокрутки
      setTimeout(() => {
        console.log(`[Section Change] Animation completed, updating current section to ${index}`)
        setCurrentSection(index)
        currentSectionRef.current = index

        // Сбрасываем состояние перехода
        setTimeout(() => {
          console.log(`[Section Change] Resetting transition state`)
          setIsTransitioning(false)
          isTransitioningRef.current = false
        }, 100)
      }, 600) // Стандартная задержка для завершения анимации прокрутки
    }
  }

  // Обработчик для события sectionChange из других компонентов
  useEffect(() => {
    document.addEventListener("sectionChange", handleSectionChange as EventListener)

    return () => {
      document.removeEventListener("sectionChange", handleSectionChange as EventListener)
    }
  }, [sections])

  return <>{/* Навигационные кнопки и отладочная информация удалены */}</>
}
