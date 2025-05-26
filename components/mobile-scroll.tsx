"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

interface MobileScrollProps {
  children: React.ReactNode
}

export default function MobileScroll({ children }: MobileScrollProps) {
  const isMobile = useMobileDetector()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (isMobile && isMounted) {
      // Отключаем snap-scroll на мобильных устройствах
      document.body.classList.add("disable-snap")

      // Включаем стандартную прокрутку
      document.documentElement.style.overflow = "auto"
      document.body.style.overflow = "auto"
      document.body.style.height = "auto"

      // Убираем фиксированную высоту и масштабирование для всех секций кроме FAQ на мобильных устройствах
      const sections = document.querySelectorAll("section:not(#faq)")
      sections.forEach((section) => {
        const sectionEl = section as HTMLElement

        // Убираем фиксированную высоту 1080px
        sectionEl.style.height = "auto"
        sectionEl.style.minHeight = "100vh"

        // Убираем масштабирование
        sectionEl.style.transform = "none"

        // Убираем JS-установленные отступы
        const paddingSpacers = sectionEl.querySelectorAll(".padding-spacer")
        paddingSpacers.forEach((spacer) => {
          ;(spacer as HTMLElement).style.display = "none"
        })

        // Сбрасываем внутренние отступы
        const contentDivs = sectionEl.querySelectorAll(":scope > div:not(.padding-spacer)")
        contentDivs.forEach((div) => {
          ;(div as HTMLElement).style.marginTop = "0";
          (div as HTMLElement).style.marginBottom = "0"
        })
      })

      // Отключаем все скрипты масштабирования на мобильных устройствах
      const scaleContainer = document.querySelector(".scalable-content") as HTMLElement
      if (scaleContainer) {
        scaleContainer.style.transform = "none"
      }

      // Устанавливаем CSS переменную --content-scale в 1
      document.documentElement.style.setProperty("--content-scale", "1")
    }

    return () => {
      if (isMobile) {
        document.body.classList.remove("disable-snap")
      }
    }
  }, [isMobile, isMounted])

  return <>{children}</>
}
