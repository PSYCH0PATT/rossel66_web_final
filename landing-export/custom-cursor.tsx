"use client"

import { useEffect, useRef, useState } from "react"

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    // Проверяем, является ли устройство сенсорным
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0
    setIsTouch(isTouchDevice)

    // Если это сенсорное устройство, не создаем кастмный курсор
    if (isTouchDevice || !cursorRef.current) return

    // Создаем круги
    const circlesContainer = cursorRef.current
    // Уменьшаем количество кругов для лучшей производительности
    const circleCount = window.innerWidth < 768 ? 12 : 20

    // Create emerald to cyan gradient colors
    const colors = [
      "#10b981", // emerald-500
      "#14b789",
      "#18b590",
      "#1cb298",
      "#20b0a0",
      "#24ada8",
      "#28abb0",
      "#2ca8b8",
      "#30a6c0",
      "#34a3c8",
      "#38a1d0",
      "#3c9ed8",
      "#409ce0",
      "#4499e8",
      "#4897f0",
      "#4c94f8",
      "#5092ff",
      "#548fd7",
      "#588dcf",
      "#06b6d4", // cyan-500
    ]

    // Remove any existing circles
    while (circlesContainer.firstChild) {
      circlesContainer.removeChild(circlesContainer.firstChild)
    }

    // Create circle elements
    for (let i = 0; i < circleCount; i++) {
      const circle = document.createElement("div")
      circle.className = "cursor-circle"
      circle.style.backgroundColor = colors[i % colors.length]
      circle.style.zIndex = `${99999999 - i}`
      circlesContainer.appendChild(circle)
    }

    const circles = document.querySelectorAll(".cursor-circle") as NodeListOf<HTMLDivElement>

    // Store circle positions separately
    const circlePositions = Array.from(circles).map(() => ({ x: 0, y: 0 }))

    // Track mouse position
    const coords = { x: 0, y: 0 }

    const handleMouseMove = (e: MouseEvent) => {
      coords.x = e.clientX
      coords.y = e.clientY
    }

    window.addEventListener("mousemove", handleMouseMove)

    // Hide default cursor
    document.body.style.cursor = "none"

    // Add cursor styles to interactive elements
    const style = document.createElement("style")
    style.innerHTML = `
      a, button, [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"]) {
        cursor: none !important;
      }
      
      .cursor-circle {
        height: 24px;
        width: 24px;
        border-radius: 50%;
        position: fixed; 
        top: 0;
        left: 0;
        pointer-events: none;
        z-index: 99999999;
        border: none;
        outline: none;
        box-shadow: none;
      }
      
      @media (max-width: 768px) {
        .cursor-circle {
          height: 18px;
          width: 18px;
        }
      }
    `
    document.head.appendChild(style)

    // Animate circles with requestAnimationFrame for better performance
    let animationId: number

    function animateCircles() {
      let x = coords.x
      let y = coords.y

      circles.forEach((circle, index) => {
        circle.style.left = `${x - 12}px`
        circle.style.top = `${y - 12}px`

        circle.style.scale = `${(circles.length - index) / circles.length}`

        // Store position in our array
        circlePositions[index].x = x
        circlePositions[index].y = y

        // Use the stored position of the next circle
        const nextCircleIndex = (index + 1) % circles.length
        const nextCircleX = circlePositions[nextCircleIndex].x
        const nextCircleY = circlePositions[nextCircleIndex].y
        
        x += (nextCircleX - x) * 0.3
        y += (nextCircleY - y) * 0.3
      })

      animationId = requestAnimationFrame(animateCircles)
    }

    animationId = requestAnimationFrame(animateCircles)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      document.body.style.cursor = ""
      document.head.removeChild(style)
      cancelAnimationFrame(animationId)

      // Clean up circles
      while (circlesContainer.firstChild) {
        circlesContainer.removeChild(circlesContainer.firstChild)
      }
    }
  }, [])

  // Если это сенсорное устройство, не рендерим компонент вообще
  if (isTouch) return null

  return (
    <div
      ref={cursorRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-[99999999]"
      style={{ display: isTouch ? 'none' : 'block' }}
    >
      {/* ... existing code ... */}
    </div>
  )
}
