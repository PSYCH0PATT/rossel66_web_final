"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useMousePosition } from "@/lib/hooks/use-mouse-position"

export const CustomCursor = () => {
  const [cursorVariant, setCursorVariant] = useState("default")
  const mousePosition = useMousePosition()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleMouseEnter = () => setIsVisible(true)
    const handleMouseLeave = () => setIsVisible(false)

    document.addEventListener("mouseenter", handleMouseEnter)
    document.addEventListener("mouseleave", handleMouseLeave)

    // Обработчики для ссылок и кнопок
    const handleLinkHover = () => setCursorVariant("link")
    const handleLinkLeave = () => setCursorVariant("default")

    // Находим все интерактивные элементы
    const interactiveElements = document.querySelectorAll('a, button, [role="button"], input, select, textarea')

    interactiveElements.forEach((el) => {
      el.addEventListener("mouseenter", handleLinkHover)
      el.addEventListener("mouseleave", handleLinkLeave)
    })

    return () => {
      document.removeEventListener("mouseenter", handleMouseEnter)
      document.removeEventListener("mouseleave", handleMouseLeave)

      interactiveElements.forEach((el) => {
        el.removeEventListener("mouseenter", handleLinkHover)
        el.removeEventListener("mouseleave", handleLinkLeave)
      })
    }
  }, [])

  // Варианты анимации курсора
  const variants = {
    default: {
      x: mousePosition.x - 16,
      y: mousePosition.y - 16,
      height: 32,
      width: 32,
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      mixBlendMode: "difference" as const,
    },
    link: {
      x: mousePosition.x - 24,
      y: mousePosition.y - 24,
      height: 48,
      width: 48,
      backgroundColor: "rgba(16, 185, 129, 0.2)",
      mixBlendMode: "normal" as const,
    },
  }

  // ИСПРАВЛЕНИЕ: Добавляем pointer-events: none, чтобы курсор не блокировал события
  return (
    <motion.div
      className="custom-cursor"
      variants={variants}
      animate={cursorVariant}
      transition={{ type: "spring", stiffness: 500, damping: 28, mass: 0.5 }}
      style={{
        position: "fixed",
        zIndex: 9999,
        borderRadius: "50%",
        pointerEvents: "none", // Важное исправление!
        opacity: isVisible ? 1 : 0,
      }}
    />
  )
}
