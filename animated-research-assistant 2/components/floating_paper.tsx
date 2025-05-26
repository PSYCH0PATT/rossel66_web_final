"use client"

import { useEffect, useState, useRef } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { memo } from "react"

const FloatingPaper = memo(function FloatingPaper({ count = 6 }) {
  const dimensionsRef = useRef({ width: 1200, height: 800 })
  const [paperSize, setPaperSize] = useState(39)
  const [papers, setPapers] = useState<
    Array<{
      key: number
      x: number[]
      y: number[]
      rotate: number[]
      duration: number
    }>
  >([])

  useEffect(() => {
    // Update dimensions only on client side
    const updateDimensions = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      dimensionsRef.current = { width, height }

      // Адаптивный размер логотипа
      if (width < 640) {
        setPaperSize(28)
      } else if (width < 1024) {
        setPaperSize(34)
      } else {
        setPaperSize(39)
      }

      // Генерируем данные для анимации только один раз
      if (papers.length === 0) {
        const newPapers = Array.from({ length: count }).map((_, i) => ({
          key: i,
          x: [Math.random() * width, Math.random() * width, Math.random() * width],
          y: [Math.random() * height, Math.random() * height, Math.random() * height],
          rotate: [0, 180, 360],
          duration: 20 + Math.random() * 10,
        }))
        setPapers(newPapers)
      }
    }

    updateDimensions()

    const handleResize = () => {
      updateDimensions()
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [count, papers.length])

  // Всегда используем фиксированное количество картинок (6)
  const fixedCount = 6

  return (
    <div className="relative w-full h-full">
      {papers.slice(0, fixedCount).map((paper) => (
        <motion.div
          key={paper.key}
          className="absolute"
          initial={{
            x: paper.x[0],
            y: paper.y[0],
          }}
          animate={{
            x: paper.x,
            y: paper.y,
            rotate: paper.rotate,
          }}
          transition={{
            duration: paper.duration,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        >
          <div className="opacity-40 filter blur-[0.5px] drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%D0%BB%D0%BE%D0%B3%D0%BE%20%D1%84%D1%83%D0%BB%D0%BB-1uNYD3zhCnNZ6BTo2MvyRpgjkpAnya.png"
              alt="ROSSEL 66 MUSIC"
              width={paperSize}
              height={paperSize}
            />
          </div>
        </motion.div>
      ))}
    </div>
  )
})

export { FloatingPaper }
