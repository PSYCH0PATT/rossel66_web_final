"use client"

import { useEffect, useRef } from "react"

interface SectionBorderLinesProps {
  sectionId: string
  color?: string
}

export default function SectionBorderLines({ sectionId, color = "rgba(16, 185, 129, 0.5)" }: SectionBorderLinesProps) {
  const leftLineRef = useRef<HTMLDivElement>(null)
  const rightLineRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    const section = document.getElementById(sectionId)
    if (!section || !leftLineRef.current || !rightLineRef.current) return

    // Функция для обновления позиции линий
    const updateLines = () => {
      const rect = section.getBoundingClientRect()
      const sectionLeft = rect.left
      const sectionRight = rect.right
      const sectionWidth = rect.width

      // Обновляем позицию левой линии
      leftLineRef.current!.style.left = `${sectionLeft}px`
      leftLineRef.current!.style.height = `${rect.height}px`
      leftLineRef.current!.style.top = `${rect.top}px`

      // Обновляем позицию правой линии
      rightLineRef.current!.style.left = `${sectionRight - 2}px`
      rightLineRef.current!.style.height = `${rect.height}px`
      rightLineRef.current!.style.top = `${rect.top}px`

      // Добавляем текст с шириной секции
      const widthText = document.createElement("div")
      widthText.className = "width-text"
      widthText.textContent = `${Math.round(sectionWidth)}px`
      widthText.style.position = "absolute"
      widthText.style.top = `${rect.top - 20}px`
      widthText.style.left = `${sectionLeft + (sectionWidth / 2) - 25}px`
      widthText.style.color = color
      widthText.style.fontSize = "12px"
      widthText.style.fontWeight = "bold"

      // Удаляем предыдущий текст, если он есть
      const existingText = document.querySelector(`.width-text-${sectionId}`)
      if (existingText) {
        existingText.remove()
      }

      widthText.classList.add(`width-text-${sectionId}`)
      document.body.appendChild(widthText)
    }

    // Инициализация
    updateLines()

    // Создаем ResizeObserver для отслеживания изменений размера секции
    observerRef.current = new ResizeObserver(updateLines)
    observerRef.current.observe(section)

    // Также отслеживаем изменение размера окна и прокрутку
    window.addEventListener("resize", updateLines)
    window.addEventListener("scroll", updateLines)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      window.removeEventListener("resize", updateLines)
      window.removeEventListener("scroll", updateLines)

      // Удаляем текст при размонтировании
      const existingText = document.querySelector(`.width-text-${sectionId}`)
      if (existingText) {
        existingText.remove()
      }
    }
  }, [sectionId, color])

  return (
    <>
      <div ref={leftLineRef} className="fixed z-40 w-0.5 pointer-events-none" style={{ backgroundColor: color }} />
      <div ref={rightLineRef} className="fixed z-40 w-0.5 pointer-events-none" style={{ backgroundColor: color }} />
    </>
  )
}
