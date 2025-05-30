"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Hero from "@/components/hero"
import Navbar from "@/components/navbar"
import { SparklesCore } from "@/components/sparkles"
import FactsSection from "@/components/facts-section"
import ServicesSection from "@/components/services-section"
import PartnersSection from "@/components/partners-section"
import ArtistsSection from "@/components/artists-section"
import ContactFormSection from "@/components/contact-form-section"
import FAQSection from "@/components/faq-section"
import Footer from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import SmoothScroll from "@/components/smooth-scroll"
import ScalableContainer from "@/components/ScalableContainer"
// Удаляем импорт MobileServicesSlider
// import MobileServicesSlider from "@/components/mobile-services-slider"
// Удаляем импорт SimpleDebugIndicator
// import SimpleDebugIndicator from "@/components/simple-debug-indicator"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

// Базовое разрешение для масштабирования
const BASE_WIDTH = 1920
const BASE_HEIGHT = 1080

// Базовый отступ при высоте 1080px
// const BASE_PADDING = 40 // Removed unused variable

export default function Home() {
  const [activeSection, setActiveSection] = useState(0)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const mainRef = useRef<HTMLElement>(null)
  const [showBorders, ] = useState(false) // Изменено на false, чтобы убрать зеленые границы
  // const [sectionPaddings, setSectionPaddings] = useState<Record<string, { top: number; bottom: number }>>({}) // Removed unused variable
  // const [sectionContentHeights, setSectionContentHeights] = useState<Record<string, number>>({}) // Removed unused variable
  /* const [paddingAdjustment, setPaddingAdjustment] = useState({
    percentage: 0,
    pixelChange: 0,
    heightRatio: 0,
  }) */ // Removed unused variable
  const isMobile = useMobileDetector()

  // В компоненте Home, добавим новое состояние для хранения коэффициентов уменьшения секций
  // const [sectionScaleFactors, setSectionScaleFactors] = useState<Record<string, number>>({}) // Removed unused variable

  // Мемоизируем обработчик изменения размера окна
  const handleResize = useCallback(() => {
    const width = window.innerWidth
    const height = window.innerHeight

    setWindowSize({ width, height })
  }, [])

  // Мемоизируем обработчик изменения секции
  const handleSectionChange = useCallback((e: CustomEvent) => {
    setActiveSection(e.detail.index)
  }, [])

  // Отслеживаем размер окна
  useEffect(() => {
    // Инициализация при монтировании
    if (typeof window !== "undefined") {
      handleResize() // Вызываем сразу для установки начальных значений
      window.addEventListener("resize", handleResize)
    }

    // Добавляем слушатель события
    document.addEventListener("sectionChange", handleSectionChange as EventListener)

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleResize)
      }
      document.removeEventListener("sectionChange", handleSectionChange as EventListener)
    }
  }, [handleResize, handleSectionChange])

  // Обработчик для адаптации отступов при изменении размера окна
  useEffect(() => {
    const handleSectionSizing = () => {
      const sections = document.querySelectorAll("section");
      const currentWindowHeight = window.innerHeight;
      const currentScaleFactor = parseFloat(document.documentElement.style.getPropertyValue("--content-scale") || "1");

      sections.forEach((section) => {
        const sectionEl = section as HTMLElement;
        const sectionId = sectionEl.id;

        let targetSectionHeight: number;

        if (sectionId === "footer") {
          sectionEl.style.height = "auto";
          sectionEl.style.minHeight = "auto"; // Ensure minHeight is also auto
          sectionEl.style.paddingTop = "0px";
          sectionEl.style.paddingBottom = "0px";
          sectionEl.style.boxSizing = "border-box";
          // Remove fixed margins for content inside footer if any were set by previous logic
          const footerContent = sectionEl.querySelector(".container") || sectionEl.firstElementChild;
          if (footerContent) {
            (footerContent as HTMLElement).style.marginTop = "0px";
            (footerContent as HTMLElement).style.marginBottom = "0px";
          }
          return; 
        } else if (isMobile && (sectionId === "services" || sectionId === "artists")) {
          // Специальная обработка для секций services и artists на мобильных
          targetSectionHeight = currentWindowHeight * 4; // Set target for the section itself to be 4x screen height
          sectionEl.style.height = `${targetSectionHeight}px`; // Section height is 4x screen height
          
          // Убираем изменение ширины - оставляем 100%
          sectionEl.style.width = "100%"; // Возвращаем обратно к 100%
          
          sectionEl.style.paddingTop = "0px";
          sectionEl.style.paddingBottom = "0px";
          sectionEl.style.marginLeft = "0px"; 
          sectionEl.style.marginRight = "0px"; 
          sectionEl.style.boxSizing = "border-box"; 
          sectionEl.style.overflow = "visible"; /* CHANGED FROM hidden to visible */
          
          // sectionEl.style.transform = "none"; /* Commenting out */
          // sectionEl.style.transformOrigin = "initial"; /* Commenting out */
          sectionEl.style.position = "relative"; 
          sectionEl.style.zIndex = "auto"; 

          const contentContainer = sectionEl.querySelector(".container") || sectionEl.firstElementChild;
          if (contentContainer) {
            const ccEl = contentContainer as HTMLElement;
            ccEl.style.marginTop = "0px"; 
            ccEl.style.marginBottom = "0px"; 
            ccEl.style.width = "100%"; 
            ccEl.style.height = "100%"; 
            ccEl.style.display = "flex"; 
            ccEl.style.flexDirection = "column"; 
            ccEl.style.justifyContent = "center";
            ccEl.style.alignItems = "center"; 
            ccEl.style.boxSizing = "border-box"; // Added for ccEl
          }
          // We still need to skip the generic margin calculation logic below for these sections.
          // The existing `if (!(isMobile && (sectionId === "services" || sectionId === "artists")))` block later handles this.
          // BUT, we need to ensure zoom is reset for services/artists if not handled by the above else.
          const sliderContentContainer = sectionEl.querySelector(".container") || sectionEl.firstElementChild;
          if (sliderContentContainer) {
            (sliderContentContainer as HTMLElement).style.zoom = "1"; // Restore zoom logic for sliders
          }

        } else if (isMobile) { 
          targetSectionHeight = currentWindowHeight * 2; // Обычные мобильные секции включая FAQ
        } else {
          // For hero and faq on desktop, also use BASE_HEIGHT, they won't typically scroll
          // For other sections on desktop, they take BASE_HEIGHT and internal content might scroll if larger
          targetSectionHeight = BASE_HEIGHT;
        }

        // Общая логика для всех секций (кроме services/artists на мобильных, которые обработаны выше частично)
        // Если это services/artists на мобильных, targetSectionHeight уже установлен.
        if (!(isMobile && (sectionId === "services" || sectionId === "artists"))) {
            sectionEl.style.height = `${targetSectionHeight}px`;
        }
        // Для services/artists на мобильных paddingTop/Bottom уже 0.
        // sectionEl.style.paddingTop = "0px"; 
        // sectionEl.style.paddingBottom = "0px"; 
        sectionEl.style.boxSizing = "border-box";
        // sectionEl.style.overflow = "hidden"; /* This was the general rule, but services/artists now have visible */

        if (!(isMobile && (sectionId === "services" || sectionId === "artists"))) {
          sectionEl.style.overflow = "hidden"; // Apply hidden for other sections
        }

        if (!showBorders) {
          sectionEl.style.border = "none";
        }

        // --- ВОЗВРАЩАЕМ ОРИГИНАЛЬНУЮ ЛОГИКУ --- 
        const contentContainerForMargins = sectionEl.querySelector(".container") || sectionEl.firstElementChild;
        // const contentContainerForMargins = sectionEl; // УДАЛЯЕМ ДИАГНОСТИЧЕСКИЙ КОД
        // --- КОНЕЦ ВОЗВРАТА --- 

        if (contentContainerForMargins) {
          const ccEl = contentContainerForMargins as HTMLElement;
          // Только если это не services/artists на мобильных, применяем логику отступов
          if (!(isMobile && (sectionId === "services" || sectionId === "artists"))) {
            ccEl.style.marginTop = "0px"; 
            ccEl.style.marginBottom = "0px";

            // Restore zoom logic
            if (isMobile && sectionId !== "footer" && sectionId !== "services" && sectionId !== "artists") {
              ccEl.style.zoom = "1.3";
            } else {
              ccEl.style.zoom = "1"; 
              }

            // ---- РАСКОММЕНТИРУЕМ РАСЧЕТ ОТСТУПОВ ДЛЯ ВСЕХ ----
            requestAnimationFrame(() => {
              const unscaledContentHeight = ccEl.offsetHeight; 
              const visualContentHeight = unscaledContentHeight * currentScaleFactor; 
              const totalVisualPaddingNeeded = Math.max(0, targetSectionHeight - visualContentHeight); 
              const visualPaddingTop = Math.floor(totalVisualPaddingNeeded / 2); 
              const visualPaddingBottom = totalVisualPaddingNeeded - visualPaddingTop; 
              // const finalMarginTop = visualPaddingTop * inverseScaleFactor; // Не используется
              // const finalMarginBottom = visualPaddingBottom * inverseScaleFactor; // Не используется

              // Убираем все отладочные логи
              // if ((sectionId === "hero" || sectionId === "facts" || sectionId === "contact" || sectionId === "faq") && isMobile) {
              //   console.log(...);
              // }

              // Убираем установку margin для ccEl
              // ccEl.style.marginTop = `${finalMarginTop}px`;
              // ccEl.style.marginBottom = `${finalMarginBottom}px`;

              // Применяем padding к самой секции
              // Убедимся, что для sectionEl установлен box-sizing: border-box (это уже сделано выше)
              sectionEl.style.paddingTop = `${visualPaddingTop}px`;
              sectionEl.style.paddingBottom = `${visualPaddingBottom}px`;
              
              // Высота контентного блока ccEl должна быть auto, чтобы он занимал необходимое место
              ccEl.style.height = 'auto';


              // sectionEl.style.setProperty('--section-padding-top', `${finalMarginTop}px`);
              // sectionEl.style.setProperty('--section-padding-bottom', `${finalMarginBottom}px`);
            });
            // ---- КОНЕЦ РАСКОММЕНТИРОВАНИЯ ----
          }
        }
      });
    };

    // Debounce or throttle handleSectionSizing if performance becomes an issue
    const debouncedHandleSectionSizing = () => {
        requestAnimationFrame(handleSectionSizing);
    }

    debouncedHandleSectionSizing(); // Initial call

    window.addEventListener("resize", debouncedHandleSectionSizing);
    // Listen to the custom "scalechange" event dispatched by ScalableContainer
    document.addEventListener("scalechange", debouncedHandleSectionSizing); 

    return () => {
      window.removeEventListener("resize", debouncedHandleSectionSizing);
      document.removeEventListener("scalechange", debouncedHandleSectionSizing);
    };
  }, [isMobile, showBorders]); // Ensure all dependencies are listed

  // Обработчик для кнопки "Отправить заявку" на главной странице
  const scrollToContactForm = useCallback(() => {
    // Создаем и диспатчим событие для перехода к секции контактов
    const event = new CustomEvent("sectionChange", {
      detail: { index: 5 }, // Индекс секции с контактной формой
    })
    document.dispatchEvent(event)
  }, [])

  // Получаем текущий масштаб
  const [currentScale, setCurrentScale] = useState(1)

  // Отслеживаем текущий масштаб с debounce для предотвращения циклов
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const updateScale = () => {
      const scalableContent = document.querySelector(".scalable-content")
      if (scalableContent) {
        const scale = Number.parseFloat(scalableContent.getAttribute("data-scale") || "1")
        // Только обновляем если значение действительно изменилось
        if (Math.abs(scale - currentScale) > 0.001) {
      setCurrentScale(scale)
    }
      }
    }

    const debouncedUpdateScale = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateScale, 100) // Debounce 100ms
    }

    // Инициализация без debounce
    updateScale()

    // Обновляем при изменении масштаба с debounce
    document.addEventListener("scalechange", debouncedUpdateScale)
    window.addEventListener("resize", debouncedUpdateScale)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener("resize", debouncedUpdateScale)
      document.removeEventListener("scalechange", debouncedUpdateScale)
    }
  }, [currentScale]) // Добавляем currentScale в зависимости для корректного сравнения

  // Получаем масштаб для мобильных секций
  const getMobileScale = useCallback(
    (sectionId: string) => {
      if (!isMobile) return currentScale

      // Для секций "services", "artists" и "faq" оставляем стандартный масштаб
      if (sectionId === "services" || sectionId === "artists") {
        return currentScale
      }

      // Для всех остальных секций увеличиваем масштаб в 1.5 раза
      return currentScale / 2
    },
    [isMobile, currentScale],
  )

  useEffect(() => {
    // Убираем отладочный оверлей
  }, [isMobile])

  // Принудительная инициализация высот секций при монтировании (исправляет проблему после FAQ)
  useEffect(() => {
    if (isMobile) {
      const initializeSectionHeights = () => {
        const servicesSection = document.getElementById('services');
        const artistsSection = document.getElementById('artists');
        const windowHeight = window.innerHeight;
        
        if (servicesSection) {
          servicesSection.style.height = `${windowHeight * 4}px`;
          servicesSection.style.overflow = 'visible';
          servicesSection.style.position = 'relative';
          servicesSection.style.width = '100%';
        }
        
        if (artistsSection) {
          artistsSection.style.height = `${windowHeight * 4}px`;
          artistsSection.style.overflow = 'visible';
          artistsSection.style.position = 'relative';
          artistsSection.style.width = '100%';
        }
      };
      
      // Выполняем инициализацию с небольшой задержкой
      const timeoutId = setTimeout(initializeSectionHeights, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isMobile])

  return (
    <main
      ref={mainRef}
      data-page="home"
      className={`h-screen ${isMobile ? 'overflow-visible' : 'overflow-hidden'} bg-black/[0.96] antialiased bg-grid-white/[0.02] relative ${isMobile ? 'snap-container' : ''}`}
      style={{
        pointerEvents: "auto",
        overscrollBehavior: isMobile ? 'auto' : "none", // Разрешаем overscroll для snap на мобильных
        WebkitOverflowScrolling: "touch",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Компонент для плавной прокрутки */}
      <SmoothScroll />

      {/* Custom cursor */}
      <CustomCursor />

      {/* Ambient background with moving particles */}
      <div
        className="h-full w-full fixed inset-0 z-0"
        // ИСПРАВЛЕНИЕ: Добавляем pointer-events: none
        style={{ pointerEvents: "none" }}
      >
        <SparklesCore
          id="tsparticlesfullpage"
          background="transparent"
          minSize={0.9}
          maxSize={2.1}
          particleDensity={windowSize.width < 768 ? 120 : 195}
          className="w-full h-full"
          particleColor="#FFFFFF"
          emeraldParticles={activeSection === 1}
        />
      </div>

      {/* Навбар вне масштабируемого контейнера */}
      <div
        className="w-full flex justify-center"
        style={{ zIndex: 20, pointerEvents: "auto" }}
      >
        <Navbar activeSection={activeSection} />
      </div>

      {/* Масштабируемый контейнер для всех секций */}
      <ScalableContainer
        baseWidth={BASE_WIDTH}
        baseHeight={BASE_HEIGHT}
        minScale={0.5}
        maxScale={1.2}
        scaleByHeight={true}
        className="relative z-10"
        isMobileProp={isMobile}
      >
        <div className={`w-full flex flex-col items-center ${isMobile ? 'sections-scroll-host' : ''}`}>
          {/* Hero Section */}
          <section id="hero" className="h-screen w-full flex items-center justify-center relative">
            <Hero onContactClick={scrollToContactForm} />
          </section>

          {/* Facts Section */}
          <section id="facts" className={`w-full flex items-center justify-center relative ${!isMobile ? "min-h-screen" : ""}`}>
            <FactsSection windowSize={windowSize} />
          </section>

          {/* Services Section */}
          <section
            id="services"
            className={`w-full flex items-center justify-center relative overflow-visible ${!isMobile ? "min-h-screen" : ""}`}
            style={{ // Эти стили могут быть не нужны если overflow-visible есть в классах Tailwind или globals.css
              // width: "100%",
              // maxWidth: "100%",
              // overflow: "visible", 
              // position: "relative",
            }}
          >
            <ServicesSection windowSize={windowSize} mobileScale={getMobileScale("services")} />
          </section>

          {/* Partners Section */}
          <section id="partners" className={`w-full flex items-center justify-center relative ${!isMobile ? "min-h-screen" : ""}`}>
            <PartnersSection windowSize={windowSize} />
          </section>

          {/* Artists Section */}
          <section
            id="artists"
            className={`w-full flex items-center justify-center relative overflow-visible ${!isMobile ? "min-h-screen" : ""}`}
            style={{ // Аналогично services, стили могут быть излишни
              // width: "100%",
              // maxWidth: "100%",
              // overflow: "visible",
              // position: "relative",
            }}
          >
            <ArtistsSection windowSize={windowSize} mobileScale={getMobileScale("artists")} />
          </section>

          {/* Contact Form Section */}
          <section id="contact" className={`w-full flex items-center justify-center relative ${!isMobile ? "min-h-screen" : ""}`}>
            <ContactFormSection windowSize={windowSize} />
          </section>

          {/* FAQ Section */}
          <section id="faq" className="h-screen w-full flex items-center justify-center relative"> {/* Изменяем на h-screen для точной высоты экрана */}
            <FAQSection windowSize={windowSize} />
          </section>

          {/* Footer - properly positioned after FAQ section */}
          <section 
            id="footer" 
            className="w-full relative"
            style={{ 
              height: "auto", 
              minHeight: "auto", 
              maxHeight: "none",
              paddingTop: "0px", 
              paddingBottom: "0px",
              overflow: "visible",
              position: "relative",
              zIndex: 50,
              scrollSnapAlign: "end",
              boxSizing: "border-box",
              display: "block"
            }}
          >
            <Footer />
          </section>
        </div>
      </ScalableContainer>
    </main>
  )
}
