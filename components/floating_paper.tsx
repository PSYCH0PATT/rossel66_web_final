"use client"

import { useEffect, useState, useRef } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { memo } from "react"

interface FloatingPaperProps {
  count?: number
}

const FloatingPaper = memo(function FloatingPaper({ count = 6 }: FloatingPaperProps) {
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

  const generateSafePositions = (width: number, height: number, logoSize: number) => {
    // Увеличиваем границы отбивания в два раза (было logoSize, стало logoSize * 2)
    const margin = logoSize * 2
    const safeWidth = width - margin * 2
    const safeHeight = height - margin * 2
    
    // Генерируем 4-6 точек для траектории движения внутри безопасной зоны
    const pointsCount = 4 + Math.floor(Math.random() * 3) // 4-6 точек
    const xPoints = []
    const yPoints = []
    
    for (let i = 0; i < pointsCount; i++) {
      xPoints.push(margin + Math.random() * safeWidth)
      yPoints.push(margin + Math.random() * safeHeight)
    }
    
    return { x: xPoints, y: yPoints }
  }

  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      dimensionsRef.current = { width, height }

      // Адаптивный размер логотипа
      let newPaperSize
      if (width < 640) {
        newPaperSize = 28
      } else if (width < 1024) {
        newPaperSize = 34
      } else {
        newPaperSize = 39
      }
      setPaperSize(newPaperSize)

      // Генерируем данные для анимации только один раз при первой загрузке
      if (papers.length === 0) {
        const newPapers = Array.from({ length: 6 }).map((_, i) => {
          const positions = generateSafePositions(width, height, newPaperSize)
          return {
            key: i,
            x: positions.x,
            y: positions.y,
            rotate: [0, 180, 360, 540, 720], // Больше точек вращения для плавности
            duration: 25 + Math.random() * 15, // Увеличиваем длительность для более плавного движения
          }
        })
        setPapers(newPapers)
      }
    }

    updateDimensions()

    const handleResize = () => {
      // При изменении размера окна пересчитываем позиции
      const width = window.innerWidth
      const height = window.innerHeight
      dimensionsRef.current = { width, height }
      
      let newPaperSize
      if (width < 640) {
        newPaperSize = 28
      } else if (width < 1024) {
        newPaperSize = 34
      } else {
        newPaperSize = 39
      }
      setPaperSize(newPaperSize)
      
      // Обновляем позиции существующих логотипов с учетом новых границ
      setPapers(prevPapers => 
        prevPapers.map(paper => {
          const positions = generateSafePositions(width, height, newPaperSize)
          return {
            ...paper,
            x: positions.x,
            y: positions.y,
          }
        })
      )
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [papers.length])

  return (
    <div className="relative w-full h-full overflow-hidden">
      {papers.map((paper) => (
        <motion.div
          key={paper.key}
          className="absolute"
          initial={{
            x: paper.x[0],
            y: paper.y[0],
            rotate: 0,
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
            repeatType: "loop",
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
