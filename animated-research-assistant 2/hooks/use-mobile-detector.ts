"use client"

import { useState, useEffect } from "react"

export function useMobileDetector() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Функция для определения мобильного устройства
    const checkMobile = () => {
      // Проверка по User Agent
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i

      // Проверка по ширине экрана (менее 768px считаем мобильным)
      const isMobileWidth = window.innerWidth < 768

      // Проверка на наличие сенсорного экрана
      const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0

      // Устройство считается мобильным, если выполняется хотя бы одно из условий
      return mobileRegex.test(userAgent) || (isMobileWidth && isTouchDevice)
    }

    // Устанавливаем начальное значение
    setIsMobile(checkMobile())

    // Добавляем слушатель изменения размера окна
    const handleResize = () => {
      setIsMobile(checkMobile())
    }

    window.addEventListener("resize", handleResize)

    // Очистка слушателя при размонтировании
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return isMobile
}
