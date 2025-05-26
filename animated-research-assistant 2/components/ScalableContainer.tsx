"use client"

import type React from "react"
import { useRef, useEffect } from "react"
import { useScaling } from "@/hooks/useScaling"

interface ScalableContainerProps {
  children: React.ReactNode
  baseWidth?: number
  baseHeight?: number
  minScale?: number
  maxScale?: number
  scaleByHeight?: boolean
  className?: string
}

export default function ScalableContainer({
  children,
  baseWidth = 1920,
  baseHeight = 1080,
  minScale = 0.5,
  maxScale = 1.2,
  scaleByHeight = true,
  className = "",
}: ScalableContainerProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // Используем хук для расчета масштаба
  const { scale } = useScaling({
    baseWidth,
    baseHeight,
    minScale,
    maxScale,
    scaleByHeight,
  })

  // Применяем масштаб к контенту
  useEffect(() => {
    if (contentRef.current) {
      // Добавляем проверку высоты экрана для корректировки позиционирования
      const windowHeight = window.innerHeight

      // Сохраняем текущий масштаб в CSS-переменной для использования в других компонентах
      document.documentElement.style.setProperty("--content-scale", scale.toString())

      // ИСПРАВЛЕНИЕ: Изменяем способ трансформации для правильной обработки событий
      // Используем transform-origin: top center вместо center top
      contentRef.current.style.transformOrigin = "top center"
      contentRef.current.style.transform = `translate(-50%, 0) scale(${scale})`
      contentRef.current.style.top = "0"
      contentRef.current.style.left = "50%"

      // ВАЖНО: Добавляем класс, который отключит трансформацию для дочерних элементов
      contentRef.current.classList.add("scale-applied")

      // Добавляем атрибут data-scale для доступа к масштабу через DOM
      contentRef.current.setAttribute("data-scale", scale.toString())

      // Вызываем событие изменения масштаба
      const scaleEvent = new CustomEvent("scalechange", { detail: { scale } })
      document.dispatchEvent(scaleEvent)

      // Устанавливаем CSS-переменную для отключения трансформации спейсеров
      document.documentElement.style.setProperty("--inverse-scale", `${1 / scale}`)
    }
  }, [scale])

  return (
    <div
      className={`scalable-container ${className}`}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        // ИСПРАВЛЕНИЕ: Добавляем pointer-events: none, чтобы контейнер не блокировал события
        pointerEvents: "none",
      }}
    >
      <div
        ref={contentRef}
        className="scalable-content"
        style={{
          width: "100%",
          maxWidth: baseWidth,
          height: "auto",
          position: "absolute",
          top: 0,
          left: "50%",
          overflow: "visible",
          // ИСПРАВЛЕНИЕ: Добавляем pointer-events: auto, чтобы контент получал события
          pointerEvents: "auto",
        }}
      >
        {children}
      </div>
    </div>
  )
}
