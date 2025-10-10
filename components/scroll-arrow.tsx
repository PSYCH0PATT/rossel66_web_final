// @ts-nocheck
"use client"

import { motion } from "framer-motion"

interface ScrollArrowProps {
  direction?: "down" | "up"
  onClick?: () => void
}

export default function ScrollArrow({ direction = "down", onClick }: ScrollArrowProps) {
  const handleClick = () => {
    if (onClick) {
      onClick()
      return
    }

    // Если onClick не передан, используем стандартное поведение
    const currentSection = document.querySelector("section.active")
    if (!currentSection) return

    const allSections = Array.from(document.querySelectorAll("section"))
    const currentIndex = allSections.indexOf(currentSection as HTMLElement)

    let targetIndex = currentIndex
    if (direction === "down") {
      targetIndex = Math.min(currentIndex + 1, allSections.length - 1)
    } else {
      targetIndex = Math.max(currentIndex - 1, 0)
    }

    if (targetIndex !== currentIndex) {
      // Создаем и диспатчим кастомное событие для перехода к секции
      const event = new CustomEvent("goToSection", {
        detail: { index: targetIndex },
      })
      document.dispatchEvent(event)
    }
  }

  return (
    <motion.div
      className={`scroll-arrow ${direction}`}
      data-direction={direction}
      onClick={handleClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      whileHover={{ scale: 1.2 }}
    />
  )
}
