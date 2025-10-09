"use client"

import LoginForm from "@/components/login-form"
import Image from "next/image"
import { SparklesCore } from "@/components/sparkles"
import { useState, useEffect } from "react"

export default function LoginPage() {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    
    handleResize()
    window.addEventListener("resize", handleResize)
    
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-white p-4 overflow-hidden">
      {/* Черный overlay с прозрачностью 0.96 */}
      <div className="absolute inset-0 bg-black/96 z-0" />
      
      {/* Particles фон */}
      <div className="absolute inset-0 z-0" style={{ pointerEvents: "none" }}>
        <SparklesCore
          id="login-particles"
          background="transparent"
          minSize={0.9}
          maxSize={2.1}
          particleDensity={windowSize.width < 768 ? 120 : 195}
          className="w-full h-full"
          particleColor="#FFFFFF"
          emeraldParticles={false}
        />
      </div>

      {/* Контент поверх фона */}
      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center">
          <Image src="/images/logo.png" alt="ROSSEL 66 Logo" width={200} height={200} className="mb-6" />
          <h1 className="text-3xl font-bold text-white">ROSSEL 66</h1>
          <p className="mt-2 text-center text-sm text-gray-400">Доступ к личному кабинету только для артистов лейбла</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
