// @ts-nocheck
"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"

export function FloatingPaper({ count = 6 }) {
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 })
  const [paperSize, setPaperSize] = useState(39)

  useEffect(() => {
    // Update dimensions only on client side
    const updateDimensions = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      setDimensions({ width, height })

      // Адаптивный размер логотипа
      if (width < 640) {
        setPaperSize(28)
      } else if (width < 1024) {
        setPaperSize(34)
      } else {
        setPaperSize(39)
      }
    }

    updateDimensions()

    const handleResize = () => {
      updateDimensions()
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Уменьшаем количество бумажек на маленьких экранах
  const actualCount = dimensions.width < 640 ? Math.min(4, count) : count

  return (
    <div className="relative w-full h-full">
      {Array.from({ length: actualCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          initial={{
            x: Math.random() * dimensions.width,
            y: Math.random() * dimensions.height,
          }}
          animate={{
            x: [Math.random() * dimensions.width, Math.random() * dimensions.width, Math.random() * dimensions.width],
            y: [
              Math.random() * dimensions.height,
              Math.random() * dimensions.height,
              Math.random() * dimensions.height,
            ],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 20 + Math.random() * 10,
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
}
