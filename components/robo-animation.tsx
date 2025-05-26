"use client"

import { motion } from "framer-motion"
import Image from "next/image"

export function RoboAnimation() {
  return (
    <div className="relative w-full h-full">
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{
          y: [0, -20, 0],
        }}
        transition={{
          duration: 4,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      >
        <div className="relative">
          <motion.div
            className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 4,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          />
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%D0%BB%D0%BE%D0%B3%D0%BE%20%D1%84%D1%83%D0%BB%D0%BB-1uNYD3zhCnNZ6BTo2MvyRpgjkpAnya.png"
            alt="ROSSEL 66 MUSIC"
            width={117}
            height={117}
          />
        </div>
      </motion.div>
    </div>
  )
}
