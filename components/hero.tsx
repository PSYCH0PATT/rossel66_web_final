"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { FloatingPaper } from "@/components/floating_paper"
import { useMobileDetector } from "@/hooks/use-mobile-detector"
import { useMemo } from "react"

interface HeroProps {
  onContactClick?: () => void
}

export default function Hero({ onContactClick }: HeroProps) {
  const isMobile = useMobileDetector()

  const containerStyle = useMemo(() => {
    if (isMobile) {
      const widthMultiplier = 1.9;
      const marginOffset = `${(widthMultiplier - 1) * 50}%`;
      return {
        width: `${widthMultiplier * 100}%`,
        maxWidth: `${widthMultiplier * 100}%`,
        marginLeft: `-${marginOffset}`,
        marginRight: `-${marginOffset}`,
      };
    }
    return {};
  }, [isMobile]);

  const titleClass = isMobile
    ? "text-5xl font-bold text-white mb-4"
    : "text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 sm:mb-6";

  const subtitleClass = isMobile
    ? "text-xl text-gray-400 mb-6 max-w-3xl mx-auto"
    : "text-base sm:text-lg md:text-xl text-gray-400 mb-6 sm:mb-8 max-w-2xl mx-auto";

  const buttonClass = isMobile
    ? "bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-5 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.31)] transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.44)] text-base"
    : "bg-emerald-500 hover:bg-emerald-600 text-white px-6 sm:px-8 md:px-10 py-4 sm:py-5 md:py-6 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.31)] transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.44)] text-sm sm:text-base";

  const outerContainerClass = isMobile
    ? "relative h-screen flex flex-col justify-center" 
    : "container relative h-screen flex items-center justify-center";

  const innerContainerClass = isMobile
    ? "relative z-10 container mx-auto px-2 sm:px-4 md:px-6 flex flex-col items-center justify-center w-full max-w-[95%] sm:max-w-[90%] md:max-w-[85%] min-h-[70vh]"
    : "relative z-10 flex flex-col items-center justify-center w-full max-w-screen-lg min-h-[75vh] p-8";

  return (
    <div className={outerContainerClass} style={containerStyle}>
      <div className="absolute inset-0 overflow-hidden">
        <FloatingPaper /> 
      </div>

      <div className={innerContainerClass}>
        <div className="text-center w-full">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className={titleClass}>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
                ROSSEL 66 MUSIC
              </span>
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={subtitleClass}
          >
            Деловые отношения, дружеская атмосфера
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col items-center justify-center gap-4 mt-8"
          >
            <motion.div
              whileHover={{
                y: -5,
                transition: { duration: 0.2 },
              }}
            >
              <Button size="lg" className={buttonClass} onClick={onContactClick}>
                Отправить заявку
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
