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
// Удаляем импорт SimpleDebugIndicator
// import SimpleDebugIndicator from "@/components/simple-debug-indicator"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

// Базовое разрешение для масштабирования
const BASE_WIDTH = 1920
const BASE_HEIGHT = 1080

// Базовый отступ при высоте 1080px
const BASE_PADDING = 40

export default function Home() {
  const [activeSection, setActiveSection] = useState(0)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const mainRef = useRef<HTMLElement>(null)
  const [showBorders, setShowBorders] = useState(false) // Изменено на false, чтобы убрать зеленые границы
  const [sectionPaddings, setSectionPaddings] = useState<Record<string, { top: number; bottom: number }>>({})
  const [sectionContentHeights, setSectionContentHeights] = useState<Record<string, number>>({})
  const [paddingAdjustment, setPaddingAdjustment] = useState({
    percentage: 0,
    pixelChange: 0,
    heightRatio: 0,
  })
  const isMobile = useMobileDetector()

  // В компоненте Home, добавим новое состояние для хранения коэффициентов уменьшения секций
  const [sectionScaleFactors, setSectionScaleFactors] = useState<Record<string, number>>({})

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
    // Изменяем функцию handleResize в useEffect, чтобы гарантировать, что общая высота секции всегда равна 1080px
    const handleResize = () => {
      const height = window.innerHeight
      const sections = document.querySelectorAll("section")

      // Получаем текущий масштаб из атрибута data-scale
      const scalableContent = document.querySelector(".scalable-content")
      const currentScale = scalableContent ? Number.parseFloat(scalableContent.getAttribute("data-scale") || "1") : 1

      // Временный объект для хранения отступов
      const newPaddings: Record<string, { top: number; bottom: number }> = {}
      // Временный объект для хранения высот контента
      const newContentHeights: Record<string, number> = {}
      // Временный объект для хранения коэффициентов уменьшения
      const newScaleFactors: Record<string, number> = {}

      // Рассчитываем соотношение высот
      const heightRatio = height / BASE_HEIGHT

      // Обновляем состояние с информацией об изменении отступов
      setPaddingAdjustment({
        percentage: 0,
        pixelChange: 0,
        heightRatio,
      })

      // Применяем отступы ко всем секциям кроме footer
      sections.forEach((section, index) => {
        if (index < sections.length - 1) {
          const sectionEl = section as HTMLElement
          const sectionId = sectionEl.id

          // Удаляем существующие отступы и визуализаторы
          sectionEl.style.paddingTop = "0px"
          sectionEl.style.paddingBottom = "0px"
          sectionEl.style.height = `${BASE_HEIGHT}px` // Устанавливаем фиксированную высоту секции
          sectionEl.style.boxSizing = "border-box" // Важно для правильного расчета высоты

          // Удаляем существующие визуализаторы и спейсеры
          const existingElements = sectionEl.querySelectorAll(".padding-visualizer, .padding-spacer")
          existingElements.forEach((el) => el.remove())

          // Убираем границы
          if (!showBorders) {
            sectionEl.style.border = "none"
          }

          // Получаем контейнер контента секции
          const contentContainer = sectionEl.querySelector(".container") || sectionEl.firstElementChild
          if (contentContainer) {
            // Сначала сбрасываем отступы, чтобы получить чистую высоту контента
            ;(contentContainer as HTMLElement).style.marginTop = "0px"
            ;(contentContainer as HTMLElement).style.marginBottom = "0px"

            // Измеряем высоту контента без отступов
            const contentHeight = (contentContainer as HTMLElement).offsetHeight

            // Рассчитываем, сколько места остается для отступов (чтобы общая высота была 1080px)
            const totalPaddingNeeded = BASE_HEIGHT - contentHeight

            // Делим поровну между верхним и нижним отступами
            const paddingTop = Math.floor(totalPaddingNeeded / 2)
            const paddingBottom = totalPaddingNeeded - paddingTop // Гарантируем точную сумму

            // Применяем отступы к контейнеру
            ;(contentContainer as HTMLElement).style.marginTop = `${paddingTop}px`
            ;(contentContainer as HTMLElement).style.marginBottom = `${paddingBottom}px`

            // Проверяем, что общая высота секции равна 1080px
            const totalHeight = contentHeight + paddingTop + paddingBottom

            // Сохраняем значения отступов для отображения
            newPaddings[sectionId] = { top: paddingTop, bottom: paddingBottom }

            // Сохраняем высоту контента
            newContentHeights[sectionId] = contentHeight

            // Рассчитываем коэффициент уменьшения
            newScaleFactors[sectionId] = heightRatio

            // Создаем визуализаторы отступов только если showBorders включен
            if (showBorders) {
              // Создаем верхний спейсер с фиксированной высотой
              if (paddingTop > 0) {
                const topSpacer = document.createElement("div")
                topSpacer.className = "padding-spacer padding-spacer-top"
                topSpacer.style.height = `${paddingTop}px`
                topSpacer.style.width = "100%"
                topSpacer.style.position = "absolute"
                topSpacer.style.top = "0"
                topSpacer.style.left = "0"
                topSpacer.style.zIndex = "1"
                topSpacer.style.backgroundColor = "rgba(16, 185, 129, 0.1)" // Легкая зеленая заливка

                sectionEl.appendChild(topSpacer)
              }

              // Создаем нижний спейсер с фиксированной высотой
              if (paddingBottom > 0) {
                const bottomSpacer = document.createElement("div")
                bottomSpacer.className = "padding-spacer padding-spacer-bottom"
                bottomSpacer.style.height = `${paddingBottom}px`
                bottomSpacer.style.width = "100%"
                bottomSpacer.style.position = "absolute"
                bottomSpacer.style.bottom = "0"
                bottomSpacer.style.left = "0"
                bottomSpacer.style.zIndex = "1"
                bottomSpacer.style.backgroundColor = "rgba(16, 185, 129, 0.1)" // Легкая зеленая заливка

                sectionEl.appendChild(bottomSpacer)
              }
            }
          }
        }
      })

      // Обновляем состояния
      setSectionPaddings(newPaddings)
      setSectionContentHeights(newContentHeights)
      setSectionScaleFactors(newScaleFactors)
    }

    // Вызываем функцию при монтировании и при изменении размера окна
    handleResize()
    window.addEventListener("resize", handleResize)

    // Также вызываем функцию при изменении масштаба
    document.addEventListener("scalechange", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      document.removeEventListener("scalechange", handleResize)
    }
  }, [showBorders])

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

  // Отслеживаем текущий масштаб
  useEffect(() => {
    const updateScale = () => {
      const scalableContent = document.querySelector(".scalable-content")
      const scale = scalableContent ? Number.parseFloat(scalableContent.getAttribute("data-scale") || "1") : 1
      setCurrentScale(scale)
    }

    // Инициализация
    updateScale()

    // Обновляем при изменении масштаба
    const handleScaleChange = () => {
      updateScale()
    }

    window.addEventListener("resize", handleScaleChange)
    document.addEventListener("scalechange", handleScaleChange)

    return () => {
      window.removeEventListener("resize", handleScaleChange)
      document.removeEventListener("scalechange", handleScaleChange)
    }
  }, [])

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

  return (
    <main
      ref={mainRef}
      className="h-screen overflow-hidden bg-black/[0.96] antialiased bg-grid-white/[0.02] relative"
      // ИСПРАВЛЕНИЕ: Добавляем стили для обработки событий
      style={{ pointerEvents: "auto" }}
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
        // ИСПРАВЛЕНИЕ: Добавляем z-index и pointer-events: auto
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
      >
        <div className="w-full flex flex-col items-center">
          {/* Hero Section */}
          <section id="hero" className="h-screen w-full flex items-center justify-center relative">
            <Hero windowSize={windowSize} onContactClick={scrollToContactForm} mobileScale={getMobileScale("hero")} />
          </section>

          {/* Facts Section */}
          <section id="facts" className="min-h-screen w-full flex items-center justify-center relative">
            <FactsSection windowSize={windowSize} mobileScale={getMobileScale("facts")} />
          </section>

          {/* Services Section */}
          <section
            id="services"
            className="min-h-screen w-full flex items-center justify-center relative overflow-visible"
            style={{
              width: "100%",
              maxWidth: "100%",
              overflow: "visible",
              position: "relative",
            }}
          >
            <ServicesSection windowSize={windowSize} mobileScale={getMobileScale("services")} />
          </section>

          {/* Partners Section */}
          <section id="partners" className="min-h-screen w-full flex items-center justify-center relative">
            <PartnersSection windowSize={windowSize} mobileScale={getMobileScale("partners")} />
          </section>

          {/* Artists Section */}
          <section
            id="artists"
            className="min-h-screen w-full flex items-center justify-center relative overflow-visible"
            style={{
              width: "100%",
              maxWidth: "100%",
              overflow: "visible",
              position: "relative",
            }}
          >
            <ArtistsSection windowSize={windowSize} mobileScale={getMobileScale("artists")} />
          </section>

          {/* Contact Form Section */}
          <section id="contact" className="min-h-screen w-full flex items-center justify-center relative">
            <ContactFormSection windowSize={windowSize} mobileScale={getMobileScale("contact")} />
          </section>

          {/* FAQ Section */}
          <section id="faq" className="min-h-screen w-full flex items-center justify-center relative">
            <FAQSection windowSize={windowSize} mobileScale={getMobileScale("faq")} />
          </section>

          {/* Footer */}
          <section id="footer" className="w-full relative">
            <Footer mobileScale={getMobileScale("footer")} />
          </section>
        </div>
      </ScalableContainer>
    </main>
  )
}
