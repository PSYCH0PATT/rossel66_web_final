"use client"

import { SparklesCore } from "@/components/sparkles"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"

export function ParticlesBackground() {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [activeSection, setActiveSection] = useState(0)
  const pathname = usePathname()
  
  // Определяем на какой странице показывать particles
  const isLandingPage = pathname === "/"
  const isLoginPage = pathname === "/dashboard/login"
  const showParticles = isLandingPage || isLoginPage

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    
    const handleSectionChange = (e: Event) => {
      const customEvent = e as CustomEvent
      setActiveSection(customEvent.detail.index)
    }
    
    handleResize()
    window.addEventListener("resize", handleResize)
    document.addEventListener("sectionChange", handleSectionChange)
    
    return () => {
      window.removeEventListener("resize", handleResize)
      document.removeEventListener("sectionChange", handleSectionChange)
    }
  }, [])

  if (!showParticles) return null

  return (
    <div
      className="h-full w-full fixed inset-0"
      style={{ pointerEvents: "none", zIndex: 1 }}
    >
      <SparklesCore
        id="tsparticlesfullpage"
        background="transparent"
        minSize={0.9}
        maxSize={2.1}
        particleDensity={windowSize.width < 768 ? 120 : 195}
        className="w-full h-full"
        particleColor="#FFFFFF"
        emeraldParticles={isLandingPage && activeSection === 1}
      />
    </div>
  )
}

