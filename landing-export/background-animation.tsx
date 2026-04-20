"use client"

import { useEffect, useRef, useState } from "react"

interface BackgroundAnimationProps {
  count?: number
  color?: string
}

export default function BackgroundAnimation({
  count = 15,
  color = "rgba(255, 255, 255, 0.2)",
}: BackgroundAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    // Проверяем, является ли устройство сенсорным
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0
    setIsTouch(isTouchDevice)

    if (!containerRef.current) return

    const container = containerRef.current

    // Очищаем контейнер перед добавлением новых пузырей
    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    // Создаем пузыри
    for (let i = 0; i < count; i++) {
      const bubble = document.createElement("div")
      bubble.classList.add("bubble")

      const size = Math.random() * 100 + 50
      const left = Math.random() * 100
      const top = Math.random() * 100
      const delay = Math.random() * 8
      const duration = Math.random() * 4 + 6

      bubble.style.width = `${size}px`
      bubble.style.height = `${size}px`
      bubble.style.left = `${left}%`
      bubble.style.top = `${top}%`
      bubble.style.animationDelay = `${delay}s`
      bubble.style.animationDuration = `${duration}s`
      bubble.style.backgroundColor = color

      container.appendChild(bubble)
    }

    return () => {
      // Очищаем контейнер при размонтировании
      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }
    }
  }, [count, color])

  return (
    <div 
      ref={containerRef} 
      className="background-animation" 
      style={{ pointerEvents: isTouch ? 'none' : 'auto' }}
    />
  )
}
