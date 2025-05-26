"use client"

import { useEffect, useRef } from "react"

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
  // Используем useRef вместо useState для значений, которые не влияют на рендеринг
  const sectionsRef = useRef<HTMLElement[]>([])
  const totalSectionsRef = useRef(0)
  const currentSectionRef = useRef(0)
  const isTransitioningRef = useRef(false)
  const lastInteractionTime = useRef(Date.now())
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastWheelTime = useRef(0)
  const lastWheelDirection = useRef(0)
  const wheelDebounceTimer = useRef<NodeJS.Timeout | null>(null)
  const hasReachedFooter = useRef(false)
  const footerRef = useRef<HTMLElement | null>(null)

  // Инициализация при монтировании
  useEffect(() => {
    // Получаем все секции по ID, как в навигационном меню
    const sectionIds = ["hero", "facts", "services", "partners", "artists", "contact", "faq", "footer"]
    const sectionElements = sectionIds.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]

    sectionsRef.current = sectionElements
    totalSectionsRef.current = sectionElements.length
    
    // Сохраняем ссылку на футер
    footerRef.current = document.getElementById("footer")

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
    currentSectionRef.current = initialSection

    // Функция для проверки, виден ли футер полностью
    const checkFooterVisibility = () => {
      if (footerRef.current) {
        const footerRect = footerRef.current.getBoundingClientRect()
        const windowHeight = window.innerHeight
        
        // Если нижняя граница футера видна в окне просмотра
        if (footerRect.bottom <= windowHeight) {
          hasReachedFooter.current = true
          
          // Фиксируем прокрутку на футере
          const scrollY = window.scrollY
          const maxScrollY = document.documentElement.scrollHeight - windowHeight
          
          // Если мы прокрутили слишком далеко, возвращаемся к правильной позиции
          if (scrollY > maxScrollY) {
            window.scrollTo({
              top: maxScrollY,
              behavior: "auto"
            })
          }
        } else {
          hasReachedFooter.current = false
        }
      }
    }

    // Регистрируем обработчик прокрутки
    window.addEventListener("scroll", checkFooterVisibility, { passive: true })

    return () => {
      window.removeEventListener("scroll", checkFooterVisibility)
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current)
      }
      if (wheelDebounceTimer.current) {
        clearTimeout(wheelDebounceTimer.current)
      }
    }
  }, [])

  // Функция для перехода к секции
  const goToSection = (index: number) => {
    // Проверяем только валидность индекса секции
    if (index < 0 || index >= totalSectionsRef.current) {
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
    isTransitioningRef.current = true

    // Прокручиваем к новой секции
    if (sectionsRef.current[index]) {
      const targetSection = sectionsRef.current[index]
      
      // Если это футер, используем особую логику
      if (index === totalSectionsRef.current - 1) {
        // Прокручиваем до футера
        targetSection.scrollIntoView({ behavior: "smooth", block: "end" })
      } else {
        // Для других секций используем обычную прокрутку
        targetSection.scrollIntoView({ behavior: "smooth" })
      }

      // Обновляем текущую секцию только после завершения анимации прокрутки
      setTimeout(() => {
        currentSectionRef.current = index

        // Отправляем событие об изменении секции для обновления навбара
        const event = new CustomEvent("sectionChange", {
          detail: { index: index },
        })
        document.dispatchEvent(event)

        // Сбрасываем состояние перехода
        setTimeout(() => {
          isTransitioningRef.current = false
        }, 100)
      }, 600) // Задержка для завершения анимации прокрутки
    }
  }

  // Функция для выполнения перехода к секции по колесику мыши
  const performSectionTransition = (direction: number) => {
    // Если уже идет переход, игнорируем
    if (isTransitioningRef.current) {
      return
    }

    // Если мы достигли футера и пытаемся прокрутить вниз, игнорируем
    if (hasReachedFooter.current && direction > 0) {
      return
    }

    const targetSection = currentSectionRef.current + direction

    // Проверяем валидность индекса секции
    if (targetSection < 0 || targetSection >= sectionsRef.current.length) {
      return
    }

    // Устанавливаем состояние перехода
    isTransitioningRef.current = true

    // Прокручиваем к секции
    if (sectionsRef.current[targetSection]) {
      const targetSectionElement = sectionsRef.current[targetSection]
      
      // Если это футер, используем особую логику
      if (targetSection === totalSectionsRef.current - 1) {
        // Прокручиваем до футера
        targetSectionElement.scrollIntoView({ behavior: "smooth", block: "end" })
      } else {
        // Для других секций используем обычную прокрутку
        targetSectionElement.scrollIntoView({ behavior: "smooth" })
      }

      // Отправляем событие об изменении секции ПОСЛЕ завершения прокрутки
      setTimeout(() => {
        // Обновляем текущую секцию только после завершения анимации прокрутки
        currentSectionRef.current = targetSection

        // Отправляем событие об изменении секции для обновления навбара
        const event = new CustomEvent("sectionChange", {
          detail: { index: targetSection },
        })
        document.dispatchEvent(event)

        // Сбрасываем состояние перехода
        setTimeout(() => {
          isTransitioningRef.current = false
        }, 100)
      }, 600) // Стандартная задержка для завершения анимации прокрутки
    }
  }

  // Обработчик колесика мыши
  function wheelHandler(e: WheelEvent) {
    // Если мы уже на футере и пытаемся прокрутить вниз
    if (hasReachedFooter.current && e.deltaY > 0) {
      // Разрешаем небольшую прокрутку внутри футера
      const footer = document.getElementById("footer");
      if (footer) {
        const footerRect = footer.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        
        // Если футер полностью видим, предотвращаем дальнейшую прокрутку
        if (footerRect.bottom <= windowHeight) {
          e.preventDefault();
        }
      } else {
        e.preventDefault();
      }
      return;
    }

    e.preventDefault()

    // Если уже идет переход, игнорируем
    if (isTransitioningRef.current) {
      return
    }

    const { isMac } = getBrowserInfo()
    const direction = e.deltaY > 0 ? 1 : -1

    // Очищаем предыдущий таймер, если он существует
    if (wheelDebounceTimer.current) {
      clearTimeout(wheelDebounceTimer.current)
    }

    // Устанавливаем новый таймер с задержкой
    wheelDebounceTimer.current = setTimeout(() => {
      performSectionTransition(direction)
    }, isMac ? 200 : 100) // Разная задержка для Mac и других платформ

    // Сохраняем время и направление последнего события колесика
    lastWheelTime.current = Date.now()
    lastWheelDirection.current = direction
  }

  // Обработчик клавиатуры
  function keyHandler(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()

      const direction = e.key === "ArrowDown" ? 1 : -1
      
      // Если мы достигли футера и пытаемся прокрутить вниз, игнорируем
      if (hasReachedFooter.current && direction > 0) {
        return
      }
      
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
      
      // Если мы достигли футера и пытаемся прокрутить вниз, игнорируем
      if (hasReachedFooter.current && direction > 0) {
        return
      }
      
      goToSection(currentSectionRef.current + direction)
    }
  }

  // Регистрация обработчиков событий
  useEffect(() => {
    if (sectionsRef.current.length === 0) {
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
  }, [])

  // Обработчик для события sectionChange из других компонентов
  useEffect(() => {
    const handleSectionChange = (e: CustomEvent) => {
      const { index } = e.detail

      // Проверяем, не происходит ли уже переход
      if (isTransitioningRef.current) {
        return
      }

      // Устанавливаем состояние перехода
      isTransitioningRef.current = true

      // Прокручиваем к секции
      if (sectionsRef.current[index]) {
        const targetSection = sectionsRef.current[index]

        // Если это футер, используем особую логику
        if (index === totalSectionsRef.current - 1) {
          // Прокручиваем до футера
          targetSection.scrollIntoView({ behavior: "smooth", block: "end" })
        } else {
          // Для других секций используем обычную прокрутку
          targetSection.scrollIntoView({ behavior: "smooth" })
        }

        // Обновляем текущую секцию только после завершения анимации прокрутки
        setTimeout(() => {
          currentSectionRef.current = index

          // Сбрасываем состояние перехода
          setTimeout(() => {
            isTransitioningRef.current = false
          }, 100)
        }, 600) // Стандартная задержка для завершения анимации прокрутки
      }
    }

    document.addEventListener("sectionChange", handleSectionChange as EventListener)

    return () => {
      document.removeEventListener("sectionChange", handleSectionChange as EventListener)
    }
  }, [])

  return null
}
