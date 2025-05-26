"use client"

import { useEffect, useRef, useState, memo } from "react"
import { useMousePosition } from "@/lib/hooks/use-mouse-position"

interface SparklesProps {
  id?: string
  background?: string
  minSize?: number
  maxSize?: number
  particleDensity?: number
  className?: string
  particleColor?: string
  emeraldParticles?: boolean
}

interface Particle {
  x: number
  y: number
  originalX: number // Исходная позиция X
  originalY: number // Исходная позиция Y
  size: number
  color: string
  speedX: number
  speedY: number
  opacity: number
  repelFactor: number // Фактор отталкивания
  returnSpeed: number // Скорость возврата
}

export const SparklesCore = memo(function SparklesCore({
  id = "tsparticles",
  background = "transparent",
  minSize = 0.9,
  maxSize = 2.1,
  particleDensity = 130,
  className = "h-full w-full",
  particleColor = "#FFFFFF",
  emeraldParticles = false,
}: SparklesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mousePosition = useMousePosition()
  const prevMousePosition = useRef({ x: 0, y: 0 })
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 })
  const particlesRef = useRef<Particle[]>([])
  const animationFrameIdRef = useRef<number>()
  const mouseDeltaRef = useRef({ x: 0, y: 0 })
  const timeRef = useRef(0)
  const isInitializedRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    })

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Создаем начальные частицы
    const createParticle = (direction?: { x: number; y: number }) => {
      // Расширенная область для генерации частиц (в 3 раза больше видимой области)
      const extendedWidth = canvas.width * 3
      const extendedHeight = canvas.height * 3

      // Случайная позиция в расширенной области
      let x = Math.random() * extendedWidth - extendedWidth / 3
      let y = Math.random() * extendedHeight - extendedHeight / 3

      // Если указано направление движения мыши, создаем частицы с соответствующей стороны
      if (direction && (Math.abs(direction.x) > 1 || Math.abs(direction.y) > 1)) {
        const margin = 200 // Запас за пределами экрана

        if (Math.abs(direction.x) > Math.abs(direction.y)) {
          // Горизонтальное движение преобладает
          if (direction.x > 0) {
            // Мышь движется вправо, частицы появляются слева
            x = -margin + Math.random() * margin * 2
            y = Math.random() * (canvas.height + margin * 2) - margin
          } else {
            // Мышь движется влево, частицы появляются справа
            x = canvas.width + Math.random() * margin * 2 - margin
            y = Math.random() * (canvas.height + margin * 2) - margin
          }
        } else {
          // Вертикальное движение преобладает
          if (direction.y > 0) {
            // Мышь движется вниз, частицы появляются сверху
            x = Math.random() * (canvas.width + margin * 2) - margin
            y = -margin + Math.random() * margin * 2
          } else {
            // Мышь движется вверх, частицы появляются снизу
            x = Math.random() * (canvas.width + margin * 2) - margin
            y = canvas.height + Math.random() * margin * 2 - margin
          }
        }
      }

      // Базовая скорость для пассивного движения
      const baseSpeedX = (Math.random() - 0.5) * 0.345
      const baseSpeedY = (Math.random() - 0.5) * 0.345

      return {
        x,
        y,
        originalX: x, // Запоминаем исходную позицию
        originalY: y, // Запоминаем исходную позицию
        size: Math.random() * (maxSize - minSize) + minSize,
        color: emeraldParticles ? `rgba(16, 185, 129, ${(Math.random() * 0.5 + 0.2).toFixed(2)})` : particleColor,
        speedX: baseSpeedX,
        speedY: baseSpeedY,
        opacity: Math.random() * 0.5 + 0.3,
        repelFactor: Math.random() * 0.3 + 0.7, // Случайный фактор отталкивания
        returnSpeed: Math.random() * 0.03 + 0.02, // Случайная скорость возврата
      }
    }

    // Инициализация частиц только при первой инициализации
    if (!isInitializedRef.current) {
      // Инициализация частиц
      for (let i = 0; i < particleDensity * 2.6; i++) {
        particlesRef.current.push(createParticle())
      }

      isInitializedRef.current = true
    }

    // Обновление дельты движения мыши
    const updateMouseDelta = () => {
      if (prevMousePosition.current.x !== 0 && prevMousePosition.current.y !== 0) {
        // Вычисляем разницу между текущей и предыдущей позицией
        const deltaX = mousePosition.x - prevMousePosition.current.x
        const deltaY = mousePosition.y - prevMousePosition.current.y

        // Сглаживаем движение
        mouseDeltaRef.current.x = mouseDeltaRef.current.x * 0.8 + deltaX * 0.2
        mouseDeltaRef.current.y = mouseDeltaRef.current.y * 0.8 + deltaY * 0.2
      }

      // Сохраняем текущую позицию для следующего кадра
      prevMousePosition.current = { x: mousePosition.x, y: mousePosition.y }
    }

    const animate = () => {
      if (!ctx || !canvas) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      updateMouseDelta()

      // Увеличиваем время для пассивного движения
      timeRef.current += 0.01

      // Коэффициент влияния движения мыши
      const moveFactorX = -mouseDeltaRef.current.x * 0.1
      const moveFactorY = -mouseDeltaRef.current.y * 0.1

      // Обновляем позиции всех частиц
      for (let i = 0; i < particlesRef.current.length; i++) {
        const particle = particlesRef.current[i]

        // Добавляем базовое движение
        particle.x += particle.speedX
        particle.y += particle.speedY

        // Добавляем движение от мыши (противоположное направление)
        particle.x += moveFactorX
        particle.y += moveFactorY

        // Обновляем исходную позицию с учетом базового движения
        particle.originalX += particle.speedX
        particle.originalY += particle.speedY

        // Добавляем эффект отталкивания от курсора
        const distX = particle.x - mousePosition.x
        const distY = particle.y - mousePosition.y
        const distance = Math.sqrt(distX * distX + distY * distY)

        // Если частица находится в пределах 100 пикселей от курсора
        if (distance < 100) {
          // Нормализуем вектор направления
          const normX = distX / distance
          const normY = distY / distance

          // Сила отталкивания обратно пропорциональна расстоянию
          const repelStrength = (1 - distance / 100) * 5 * particle.repelFactor

          // Отталкиваем частицу
          particle.x += normX * repelStrength
          particle.y += normY * repelStrength
        } else {
          // Возвращаем частицу к исходной позиции
          const returnX = particle.originalX - particle.x
          const returnY = particle.originalY - particle.y
          const returnDist = Math.sqrt(returnX * returnX + returnY * returnY)

          if (returnDist > 0.1) {
            particle.x += returnX * particle.returnSpeed
            particle.y += returnY * particle.returnSpeed
          }
        }

        // Проверяем, вышла ли частица за пределы расширенной области
        const margin = 300
        if (
          particle.x < -margin ||
          particle.x > canvas.width + margin ||
          particle.y < -margin ||
          particle.y > canvas.height + margin
        ) {
          // Если частица вышла за пределы, создаем новую
          particlesRef.current[i] = createParticle({
            x: mouseDeltaRef.current.x,
            y: mouseDeltaRef.current.y,
          })
        }

        // Рисуем частицу, если она в видимой области или рядом с ней
        if (particle.x > -50 && particle.x < canvas.width + 50 && particle.y > -50 && particle.y < canvas.height + 50) {
          ctx.globalAlpha = particle.opacity
          ctx.fillStyle = particle.color
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }

      // Добавляем новые частицы при активном движении мыши
      if ((Math.abs(mouseDeltaRef.current.x) > 1 || Math.abs(mouseDeltaRef.current.y) > 1) && Math.random() < 0.2) {
        const newParticlesCount = Math.floor(Math.random() * 3) + 1
        for (let i = 0; i < newParticlesCount; i++) {
          particlesRef.current.push(
            createParticle({
              x: mouseDeltaRef.current.x,
              y: mouseDeltaRef.current.y,
            }),
          )
        }

        // Ограничиваем максимальное количество частиц
        if (particlesRef.current.length > particleDensity * 3.9) {
          particlesRef.current = particlesRef.current.slice(0, particleDensity * 3.9)
        }
      }

      // Постепенно уменьшаем дельту, если мышь не двигается
      mouseDeltaRef.current.x *= 0.98
      mouseDeltaRef.current.y *= 0.98

      animationFrameIdRef.current = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      if (typeof window === "undefined") return

      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [maxSize, minSize, particleColor, mousePosition.x, mousePosition.y, particleDensity, emeraldParticles])

  return (
    <canvas
      ref={canvasRef}
      id={id}
      className={className}
      style={{
        background,
        width: dimensions.width,
        height: dimensions.height,
      }}
    />
  )
})
