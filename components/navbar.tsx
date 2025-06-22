"use client"

// Теперь обновим основной компонент навбара, чтобы использовать AnimatePresence для анимации появления/исчезновения меню
// и добавим плавную анимацию для фона

import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion" // Добавляем AnimatePresence
import Link from "next/link"
import type React from "react"
import Image from "next/image"
import { useState, useEffect } from "react"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

interface NavbarProps {
  activeSection?: number
}

export default function Navbar({ activeSection = 0 }: NavbarProps) {
  const isMobile = useMobileDetector()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [navbarClass, setNavbarClass] = useState("nav-transparent")

  // Обновляем класс навбара при изменении активной секции или состояния меню
  useEffect(() => {
    if (mobileMenuOpen) {
      setNavbarClass("nav-dark")
    } else {
      // Устанавливаем один постоянный класс для меню, когда оно не открыто на мобильном
      // Выберите класс, который должен быть у меню по умолчанию.
      // Например, "nav-transparent" или, если вы хотите, чтобы оно всегда было темным, как при открытом мобильном меню, то "nav-dark".
      // Или любой другой класс, например, "nav-emerald" если он предпочтителен как основной.
      setNavbarClass("") // Убираем класс nav-transparent, чтобы удалить фон по умолчанию
      
      // Закомментированная или удаленная логика изменения цвета по секциям:
      // if (activeSection === 0) setNavbarClass("nav-transparent")
      // else if (activeSection === 1) setNavbarClass("nav-emerald")
      // else if (activeSection >= 2) setNavbarClass("nav-cyan")
      // else setNavbarClass("nav-transparent")
    }
  }, [mobileMenuOpen]) // Убираем activeSection из зависимостей

  // Обработчик клика по ссылке
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    const targetId = href.replace("#", "")

    // Check if we are on the main page
    const isOnMainPage = window.location.pathname === "/"

    if (isOnMainPage) {
      // If on main page, dispatch event for smooth scrolling
    const sectionIds = ["hero", "facts", "services", "partners", "artists", "contact", "faq", "footer"]
    const sectionIndex = sectionIds.indexOf(targetId)

    if (sectionIndex !== -1) {
      const event = new CustomEvent("sectionChange", {
          detail: { index: sectionIndex, source: "navbar" },
      })
      document.dispatchEvent(event)
      }
    } else {
      // If not on main page, navigate to main page with hash
      window.location.href = `/${href}`
    }

    // Закрываем мобильное меню при клике
    setMobileMenuOpen(false)
  }

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed-navbar fixed w-full z-50 transition-all duration-300 ${navbarClass} ${isMobile ? "" : "backdrop-blur-sm"}`}
      style={{
        backgroundColor: mobileMenuOpen ? "rgba(0, 0, 0, 0.9)" : "",
        backdropFilter: mobileMenuOpen ? "blur(12px)" : "",
        transition: "background-color 0.3s ease, backdrop-filter 0.3s ease", // Синхронизируем время анимации
      }}
    >
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 w-full">
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%D0%BB%D0%BE%D0%B3%D0%BE%20%D1%84%D1%83%D0%BB%D0%BB-1uNYD3zhCnNZ6BTo2MvyRpgjkpAnya.png"
            alt="ROSSEL 66 MUSIC"
            width={32}
            height={32}
            className="w-8 h-8 sm:w-10 sm:h-10"
          />
        </Link>

        {/* Десктопное меню */}
        <div className="hidden md:flex flex-1 justify-center items-center">
          <NavLink href="#hero" active={activeSection === 0} onClick={handleNavClick}>
            Главная
          </NavLink>
          <NavLink href="#facts" active={activeSection === 1} className="ml-6 lg:ml-8" onClick={handleNavClick}>
            Достижения
          </NavLink>
          <NavLink href="#services" active={activeSection === 2} className="ml-6 lg:ml-8" onClick={handleNavClick}>
            Услуги
          </NavLink>
          <NavLink href="#partners" active={activeSection === 3} className="ml-6 lg:ml-8" onClick={handleNavClick}>
            Партнеры
          </NavLink>
          <NavLink href="#artists" active={activeSection === 4} className="ml-6 lg:ml-8" onClick={handleNavClick}>
            Артисты
          </NavLink>
          <NavLink href="#contact" active={activeSection === 5} className="ml-6 lg:ml-8" onClick={handleNavClick}>
            Контакты
          </NavLink>
          <NavLink href="#faq" active={activeSection === 6} className="ml-6 lg:ml-8" onClick={handleNavClick}>
            FAQ
          </NavLink>
        </div>

        <div className="w-8 sm:w-10 md:block">{/* Пустой div для баланса */}</div>

        {/* Мобильное меню кнопка - увеличенная для мобильных устройств */}
        <Button
          variant="ghost"
          size="icon"
          className={`md:hidden text-white ${isMobile ? "w-12 h-12" : ""}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Menu className={`${isMobile ? "w-8 h-8" : "w-6 h-6"}`} />
        </Button>

        {/* Мобильное меню выпадающее с AnimatePresence для правильной анимации */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }} // Синхронизируем с анимацией фона
              className="absolute top-full left-0 right-0 bg-black/90 backdrop-blur-md p-4 flex flex-col space-y-4 md:hidden"
            >
              <NavLink href="#hero" active={activeSection === 0} onClick={handleNavClick}>
                Главная
              </NavLink>
              <NavLink href="#facts" active={activeSection === 1} onClick={handleNavClick}>
                Достижения
              </NavLink>
              <NavLink href="#services" active={activeSection === 2} onClick={handleNavClick}>
                Услуги
              </NavLink>
              <NavLink href="#partners" active={activeSection === 3} onClick={handleNavClick}>
                Партнеры
              </NavLink>
              <NavLink href="#artists" active={activeSection === 4} onClick={handleNavClick}>
                Артисты
              </NavLink>
              <NavLink href="#contact" active={activeSection === 5} onClick={handleNavClick}>
                Контакты
              </NavLink>
              <NavLink href="#faq" active={activeSection === 6} onClick={handleNavClick}>
                FAQ
              </NavLink>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  )
}

interface NavLinkProps {
  href: string
  children: React.ReactNode
  active?: boolean
  className?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void
}

function NavLink({ href, children, active = false, className = "", onClick }: NavLinkProps) {
  return (
    <a
      href={href}
      onClick={(e) => onClick && onClick(e, href)}
      className={`text-gray-300 hover:text-white transition-colors relative group ${active ? "text-white" : ""} ${className} cursor-pointer`}
    >
      {children}
      <motion.span
        className="absolute -bottom-1 left-0 h-0.5 bg-emerald-500"
        initial={false}
        animate={{
          width: active ? "100%" : "0%",
        }}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
        }}
      />
      <span
        className={`absolute -bottom-1 left-0 h-0.5 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity ${!active ? "w-0 group-hover:w-full" : "w-0"}`}
        style={{
          transitionProperty: "width, opacity",
          transitionDuration: "0.3s",
        }}
      />
    </a>
  )
}
