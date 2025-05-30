"use client"

import { useEffect, useRef, useCallback } from "react"
import { useMobileDetector } from "@/hooks/use-mobile-detector" // Предполагаем, что хук здесь

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
  const sectionsRef = useRef<HTMLElement[]>([])
  const totalSectionsRef = useRef(0)
  const currentSectionRef = useRef(0)
  const isTransitioningRef = useRef(false) // Остается для десктопа и для блокировки goToSection
  const footerRef = useRef<HTMLElement | null>(null)
  const isMobile = useMobileDetector()

  // Refs для десктопной логики
  const lastInteractionTime = useRef(Date.now())
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastWheelTime = useRef(0)
  const lastWheelDirection = useRef(0)
  const wheelDebounceTimer = useRef<NodeJS.Timeout | null>(null)
  const hasReachedFooter = useRef(false) // Для десктопа
  const snapTimeoutRef = useRef<NodeJS.Timeout | null>(null) // Ref для таймаута восстановления snap

  const observerRef = useRef<IntersectionObserver | null>(null)

  // Dispatches an event indicating an internal state update of the current section
  const dispatchInternalSectionUpdate = useCallback((index: number) => {
    const event = new CustomEvent("sectionChange", {
      detail: { index: index, source: 'internalUpdate' }, 
    })
    document.dispatchEvent(event)
  }, [])

  useEffect(() => {
    const sectionIds = ["hero", "facts", "services", "partners", "artists", "contact", "faq", "footer"]
    const sectionElements = sectionIds.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]

    sectionsRef.current = sectionElements
    totalSectionsRef.current = sectionElements.length
    footerRef.current = document.getElementById("footer")

    const initializeMobileStyles = () => {
      if (isMobile) {
        // Принудительно устанавливаем мобильные стили overflow при инициализации
        // Это исправляет проблему при возвращении с FAQ страницы
        const scrollHost = document.querySelector('.sections-scroll-host') as HTMLElement | null;
        if (scrollHost) {
          scrollHost.style.height = '400vh';
          scrollHost.style.overflowY = 'scroll';
          scrollHost.style.overflowX = 'hidden';
          scrollHost.style.scrollSnapType = 'y mandatory';
          scrollHost.style.scrollBehavior = 'smooth';
        }
        
        // Принудительно устанавливаем правильные высоты для секций services и artists
        const servicesSection = document.getElementById('services');
        const artistsSection = document.getElementById('artists');
        const windowHeight = window.innerHeight;
        
        if (servicesSection) {
          servicesSection.style.height = `${windowHeight * 2}px`;
          servicesSection.style.overflow = 'visible';
          servicesSection.style.position = 'relative';
        }
        
        if (artistsSection) {
          artistsSection.style.height = `${windowHeight * 2}px`;
          artistsSection.style.overflow = 'visible';
          artistsSection.style.position = 'relative';
        }
      }
    };

    initializeMobileStyles();

    if (isMobile) {
      // Логика для мобильных с IntersectionObserver
      if (observerRef.current) {
        observerRef.current.disconnect()
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const index = sectionsRef.current.findIndex((sec) => sec.id === entry.target.id)
              if (index !== -1 && currentSectionRef.current !== index) {
                currentSectionRef.current = index
                dispatchInternalSectionUpdate(index) // Notify of change from observer
              }
            }
          })
        },
        {
          root: null, // viewport
          threshold: 0.5, // 50% секции должно быть видно
        }
      )

      sectionsRef.current.forEach((section) => {
        if (section) observerRef.current?.observe(section)
      })

    } else {
      // Десктопная логика инициализации (определение начальной секции, hasReachedFooter и т.д.)
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
      currentSectionRef.current = determineCurrentSection()
      dispatchInternalSectionUpdate(currentSectionRef.current) // Notify of initial section

      const checkFooterVisibility = () => {
        if (footerRef.current) {
          const footerRect = footerRef.current.getBoundingClientRect()
          const windowHeight = window.innerHeight
          if (footerRect.bottom <= windowHeight && footerRect.top >=0 && footerRect.bottom > 0) { // Более точная проверка, что футер виден
            hasReachedFooter.current = true
            const scrollY = window.scrollY
            const maxScrollY = document.documentElement.scrollHeight - windowHeight
            if (scrollY > maxScrollY) {
               window.scrollTo({ top: maxScrollY, behavior: "auto" })
            }
          } else {
            hasReachedFooter.current = false
          }
        }
      }
      window.addEventListener("scroll", checkFooterVisibility, { passive: true })
      
      // Для десктопа восстанавливаем overflow hidden если он был изменен мобильной логикой
      document.body.style.overflow = "hidden";

      return () => { // Cleanup для десктопа
        window.removeEventListener("scroll", checkFooterVisibility)
        if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current)
        if (wheelDebounceTimer.current) clearTimeout(wheelDebounceTimer.current)
      }
    }

    // Добавляем обработчик события реинициализации страницы
    const handlePageReinitialization = () => {
      console.log('Page reinitialization triggered - reinitializing mobile styles');
      setTimeout(() => {
        initializeMobileStyles();
      }, 50);
    };

    document.addEventListener('pageReinitialization', handlePageReinitialization);

    return () => { // Общий cleanup
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      document.removeEventListener('pageReinitialization', handlePageReinitialization);
    }
  }, [isMobile, dispatchInternalSectionUpdate])


  const goToSection = useCallback((index: number, source?: string) => {
    if (index < 0 || index >= totalSectionsRef.current || !sectionsRef.current[index]) {
      console.warn(`goToSection: Invalid index ${index} or section not found.`);
      return;
    }

    const targetSection = sectionsRef.current[index];
    const scrollHost = document.querySelector('.sections-scroll-host') as HTMLElement | null;

    if (isMobile && scrollHost) {
      if (source === "navbar") {
        const originalSnapType = scrollHost.style.scrollSnapType;
        const targetPosition = targetSection.offsetTop;

        // If already at/near target, ensure snap is on and internal state is correct
        if (Math.abs(scrollHost.scrollTop - targetPosition) < 10) { // Increased tolerance slightly
          scrollHost.style.scrollSnapType = originalSnapType || 'y mandatory';
          if (currentSectionRef.current !== index) {
            currentSectionRef.current = index;
            dispatchInternalSectionUpdate(index); // Ensure Navbar highlight is correct
          }
          console.log("goToSection (navbar): Already at target, ensuring snap.");
          return;
        }

        console.log(`goToSection (navbar): Scrolling to index ${index}, pos ${targetPosition}`);
        
        // Clear any pending snap re-enablement timeout
        if (snapTimeoutRef.current) {
          clearTimeout(snapTimeoutRef.current);
          snapTimeoutRef.current = null;
        }

        scrollHost.style.scrollSnapType = 'none'; // Disable snap

        const reEnableSnap = () => {
          console.log("goToSection (navbar): Re-enabling snap.");
          if (scrollHost) { // Check if scrollHost still exists
            scrollHost.style.scrollSnapType = originalSnapType || 'y mandatory';
          }
          scrollHost?.removeEventListener('scrollend', scrollEndHandler); // Clean up listener
        };

        const scrollEndHandler = () => {
          console.log("goToSection (navbar): scrollend event fired.");
          reEnableSnap();
          if (snapTimeoutRef.current) {
            clearTimeout(snapTimeoutRef.current);
            snapTimeoutRef.current = null;
          }
        };

        scrollHost.addEventListener('scrollend', scrollEndHandler, { once: true });

        // Initiate smooth scroll via scrollTop (relies on CSS scroll-behavior: smooth)
        scrollHost.scrollTop = targetPosition;

        // Update internal state and notify UI immediately
        currentSectionRef.current = index;
        dispatchInternalSectionUpdate(index);
        
        // Fallback to re-enable snap if scrollend doesn't fire
        snapTimeoutRef.current = setTimeout(() => {
          console.log("goToSection (navbar): Fallback timeout re-enabling snap.");
          reEnableSnap(); 
        }, 1000); // Increased timeout for safety

      } else if (source !== 'internalUpdate') { 
        // For other mobile scrolls not initiated by navbar and not internal updates (e.g., from IntersectionObserver correction IF NEEDED)
        // Typically, IntersectionObserver updates state and doesn't call goToSection unless to correct major discrepancy.
        // If called, it should be an immediate jump as snap is expected to be active.
        console.log(`goToSection (mobile non-navbar): Jumping to index ${index}`);
        targetSection.scrollIntoView({ behavior: "auto", block: (index === totalSectionsRef.current - 1) ? "end" : "start" });
      }
    } else if (!isMobile) {
      // Desktop logic (remains the same)
      const now = Date.now();
      if (source !== "navbar") {
        if (now - lastInteractionTime.current < 300 && index !== currentSectionRef.current) {
          return;
        }
        if (isTransitioningRef.current && index !== currentSectionRef.current) {
          return;
        }
      }
      lastInteractionTime.current = now;
      isTransitioningRef.current = true;

      targetSection.scrollIntoView({ behavior: "smooth", block: (index === totalSectionsRef.current - 1) ? "end" : "start" });

      setTimeout(() => {
        currentSectionRef.current = index;
        dispatchInternalSectionUpdate(index);
        setTimeout(() => {
          isTransitioningRef.current = false;
        }, 100);
      }, 600);
    }
  }, [isMobile, dispatchInternalSectionUpdate]);


  // Обработчики событий (wheel, keydown, touch) будут активны только на десктопе
  useEffect(() => {
    if (isMobile || sectionsRef.current.length === 0) {
      // На мобильных или если секции не загружены, удаляем все старые обработчики и не добавляем новые
      window.removeEventListener("wheel", wheelHandler)
      document.removeEventListener("keydown", keyHandler)
      // Touch обработчики для JS скролла не нужны на мобильных с CSS Snap
      document.removeEventListener("touchstart", touchStartHandler)
      document.removeEventListener("touchend", touchEndHandler)
      return
    }

    // ДЕСКТОПНАЯ ЛОГИКА ОБРАБОТЧИКОВ
    // (wheelHandler, keyHandler, touchStartHandler, touchEndHandler, performSectionTransition)
    // должны быть определены здесь или импортированы, и они будут использоваться только на десктопе

    const performSectionTransition = (direction: number) => {
      if (isTransitioningRef.current) return
      if (hasReachedFooter.current && direction > 0) return

      const targetSectionIndex = currentSectionRef.current + direction
      if (targetSectionIndex < 0 || targetSectionIndex >= totalSectionsRef.current) return
      
      goToSection(targetSectionIndex)
    }

  function wheelHandler(e: WheelEvent) {
    if (isTransitioningRef.current) {
         e.preventDefault(); // Всегда предотвращаем, если идет переход
         return;
      }
      // Проверяем, нужно ли вообще обрабатывать wheel (например, если курсор над элементом с нативной прокруткой)
      // Это сложная логика, пока опустим, но имеем в виду, что e.preventDefault() должен быть условным.
      // Если мы на футере и он полностью видим, и крутим вниз - НЕ предотвращаем, разрешаем скролл внутри футера.
      if (hasReachedFooter.current && e.deltaY > 0) {
        const footer = footerRef.current;
        if (footer) {
            const footerRect = footer.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            // Если футер полностью виден и есть куда скроллить внутри него
            if (footerRect.bottom <= windowHeight + 5 && footer.scrollHeight > footer.clientHeight) { // +5 для погрешности
                return; // Не предотвращаем, позволяем нативный скролл футера
            }
        }
      }
      
      e.preventDefault() // Предотвращаем стандартное поведение для секций

      if (isTransitioningRef.current) return // Повторная проверка

      const { isMac } = getBrowserInfo()
      const direction = e.deltaY > 0 ? 1 : -1

      if (wheelDebounceTimer.current) clearTimeout(wheelDebounceTimer.current)
      
      wheelDebounceTimer.current = setTimeout(() => {
        performSectionTransition(direction)
      }, isMac ? 150 : 80) // Уменьшенные задержки для отзывчивости

      lastWheelTime.current = Date.now()
    lastWheelDirection.current = direction
  }

  function keyHandler(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
        if (isTransitioningRef.current) return
        if (hasReachedFooter.current && e.key === "ArrowDown") return

      const direction = e.key === "ArrowDown" ? 1 : -1
        performSectionTransition(direction)
    }
  }

    // Touch обработчики для десктопа (если есть тачскрин на десктопе/ноутбуке)
    // Для CSS Snap на мобильных они не нужны
  let touchStartY = 0
  function touchStartHandler(e: TouchEvent) {
        if (e.touches.length > 1) return; // Игнорируем мультитач для скролла секций
    touchStartY = e.touches[0].clientY
  }

  function touchEndHandler(e: TouchEvent) {
        if (e.changedTouches.length > 1) return;
        if (isTransitioningRef.current) return

    const touchEndY = e.changedTouches[0].clientY
        const deltaY = touchStartY - touchEndY

        if (Math.abs(deltaY) > 50) { // Threshold
            const direction = deltaY > 0 ? 1 : -1;
            if (hasReachedFooter.current && direction > 0) return;
            performSectionTransition(direction);
        }
    }

    window.addEventListener("wheel", wheelHandler, { passive: false })
    document.addEventListener("keydown", keyHandler)
    // Эти обработчики будут добавлены только на десктопе
    document.addEventListener("touchstart", touchStartHandler, { passive: true })
    document.addEventListener("touchend", touchEndHandler, { passive: true })


    return () => {
      window.removeEventListener("wheel", wheelHandler)
      document.removeEventListener("keydown", keyHandler)
      document.removeEventListener("touchstart", touchStartHandler)
      document.removeEventListener("touchend", touchEndHandler)
      if (wheelDebounceTimer.current) clearTimeout(wheelDebounceTimer.current)
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current)
    }
  }, [isMobile, goToSection]) // Добавляем goToSection в зависимости, т.к. performSectionTransition его использует


  // Listener for external sectionChange events (e.g., from Navbar)
  useEffect(() => {
    const handleExternalSectionChange = (e: CustomEvent) => {
      const { index, source: eventSource } = e.detail;

      if (eventSource === "internalUpdate") {
        // Event dispatched by SmoothScroll itself. Navbar uses this for UI updates.
        // No need to call goToSection again.
        return;
      }

      // For events from Navbar (source: "navbar") or other external sources.
      // goToSection will handle its own logic, including early exit if already at target.
      goToSection(index, eventSource);
    };

    document.addEventListener("sectionChange", handleExternalSectionChange as EventListener);
    return () => {
      document.removeEventListener("sectionChange", handleExternalSectionChange as EventListener);
    };
  // goToSection is a dependency. dispatchInternalSectionUpdate is NOT called by this effect directly.
  }, [goToSection]); 

  return null
}
