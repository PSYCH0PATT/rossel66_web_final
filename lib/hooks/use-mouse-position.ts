"use client"

import { useState, useEffect } from "react"

export function useMousePosition() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (typeof window === "undefined") return

    // Используем переменную для отслеживания, смонтирован ли компонент
    let isMounted = true

    const updateMousePosition = (ev: MouseEvent) => {
      if (isMounted) {
        setMousePosition({ x: ev.clientX, y: ev.clientY })
      }
    }

    window.addEventListener("mousemove", updateMousePosition)

    return () => {
      isMounted = false
      window.removeEventListener("mousemove", updateMousePosition)
    }
  }, []) // Пустой массив зависимостей, чтобы эффект запускался только при монтировании

  return mousePosition
}
