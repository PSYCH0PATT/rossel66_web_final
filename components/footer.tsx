"use client"

import Image from "next/image"
import Link from "next/link"
import { ExternalLink, Mail } from "lucide-react"
import { useEffect, useState, useMemo } from "react"
import { motion } from "framer-motion"

interface FooterProps {
  forceTransparentBackground?: boolean;
}

export default function Footer({ forceTransparentBackground = false }: FooterProps) {
  const currentYear = new Date().getFullYear()
  const [isMobile, setIsMobile] = useState(false)

  // Определяем, является ли устройство мобильным
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
      }

    checkIfMobile()
    window.addEventListener("resize", checkIfMobile)

      return () => {
      window.removeEventListener("resize", checkIfMobile)
    }
  }, [])

  const footerStyle: React.CSSProperties = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      height: "auto",
      maxHeight: "none",
      overflow: "visible",
      position: "relative",
      zIndex: 10,
      transform: "none",
      boxSizing: "border-box"
    };

    if (forceTransparentBackground) {
      baseStyle.backgroundColor = 'transparent';
    }

    if (isMobile) {
      const widthMultiplier = 2.0; // 200%
      const marginOffset = `${(widthMultiplier - 1) * 50}%`; // (2.0 - 1) * 50 = 50%
      return {
        ...baseStyle,
        width: `${widthMultiplier * 100}%`,
        maxWidth: `${widthMultiplier * 100}%`,
        marginLeft: `-${marginOffset}`,
        marginRight: `-${marginOffset}`,
        paddingTop: "40px",
        paddingBottom: "40px",
      };
    }

    return baseStyle;
  }, [isMobile, forceTransparentBackground]);

  return (
    <footer
      id="footer"
      className={`w-full backdrop-blur-sm ${isMobile ? "py-10" : "py-8 sm:pt-12 sm:pb-8"}`}
      style={footerStyle}
    >
      {isMobile && (
        <div 
          className={`w-full mx-auto px-4 sm:px-6 md:px-8`}
          style={{
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
          }}
    >
          <div className="flex flex-col items-center w-full space-y-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center mb-4">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%D0%BB%D0%BE%D0%B3%D0%BE%20%D1%84%D1%83%D0%BB%D0%BB-1uNYD3zhCnNZ6BTo2MvyRpgjkpAnya.png"
                  alt="ROSSEL 66 MUSIC"
                  width={50}
                  height={50}
                  className="mr-3"
                />
                <span className="text-xl font-bold text-white">ROSSEL 66 MUSIC</span>
              </div>
              <p className="text-gray-400">Деловые отношения, дружеская атмосфера</p>
            </div>

            <div className="flex flex-col items-center">
              <h3 className="text-lg font-semibold text-white mb-4">Контакты</h3>
              <div className="flex items-center mb-2">
                <Mail className="w-5 h-5 text-emerald-400 mr-2" />
                <a 
                  href="mailto:label@rossel66.com" 
                  className="text-gray-300 hover:text-emerald-400 transition-colors"
                >
                  label@rossel66.com
                </a>
              </div>
              <div className="flex space-x-4">
                <Link href="https://vk.com/rossel66" target="_blank" rel="noopener noreferrer" className="group">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-emerald-500/20 transition-colors">
                    <svg
                      className="w-5 h-5 text-white group-hover:text-emerald-400 transition-colors"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93V15.07C2 20.67 3.33 22 8.93 22H15.07C20.67 22 22 20.67 22 15.07V8.93C22 3.33 20.67 2 15.07 2ZM18.15 16.27H16.69C16.14 16.27 15.97 15.82 14.86 14.72C13.86 13.77 13.49 13.67 13.27 13.67C12.95 13.67 12.87 13.76 12.87 14.18V15.77C12.87 16.1 12.75 16.27 11.81 16.27C10.21 16.27 8.46 15.32 7.18 13.59C5.36 11.05 4.85 9.13 4.85 8.76C4.85 8.55 4.93 8.36 5.33 8.36H6.8C7.14 8.36 7.27 8.52 7.41 8.92C8.1 10.94 9.97 13.63 10.54 13.63C10.74 13.63 10.83 13.53 10.83 13.05V10.28C10.77 9.25 10.33 9.19 10.33 8.86C10.33 8.7 10.46 8.53 10.68 8.53H12.87C13.15 8.53 13.26 8.7 13.26 9.08V12.43C13.26 12.71 13.4 12.82 13.5 12.82C13.7 12.82 13.88 12.71 14.24 12.35C15.33 11.09 16.11 9.13 16.11 9.13C16.2 8.9 16.36 8.68 16.72 8.68H18.19C18.56 8.68 18.66 8.89 18.56 9.19C18.39 9.93 16.96 12.07 16.96 12.07C16.83 12.29 16.77 12.4 16.96 12.64C17.1 12.83 17.56 13.23 17.85 13.57C18.39 14.17 18.8 14.67 18.94 15.07C19.07 15.47 18.87 15.68 18.52 15.68L18.15 16.27Z" />
                    </svg>
                  </div>
                </Link>
                <Link href="https://t.me/rossel66" target="_blank" rel="noopener noreferrer" className="group">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-cyan-500/20 transition-colors">
                    <svg
                      className="w-5 h-5 text-white group-hover:text-cyan-400 transition-colors"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.64 8.8C16.49 10.38 15.84 14.22 15.51 15.99C15.37 16.74 15.09 16.99 14.83 17.02C14.25 17.07 13.81 16.64 13.25 16.27C12.37 15.69 11.87 15.33 11.02 14.77C10.03 14.12 10.67 13.76 11.24 13.18C11.39 13.03 13.95 10.7 14 10.49C14.0069 10.4582 14.006 10.4252 13.9973 10.3938C13.9886 10.3624 13.9724 10.3337 13.95 10.31C13.89 10.26 13.81 10.28 13.74 10.29C13.65 10.31 12.25 11.24 9.52 13.08C9.1 13.35 8.72 13.49 8.38 13.48C8.01 13.47 7.3 13.28 6.76 13.11C6.1 12.91 5.58 12.8 5.62 12.44C5.64 12.25 5.9 12.06 6.4 11.87C9.32 10.63 11.32 9.79 12.4 9.34C15.57 7.92 16.2 7.69 16.63 7.69C16.72 7.69 16.93 7.72 17.07 7.83C17.19 7.92 17.22 8.05 17.23 8.14C17.22 8.19 17.25 8.42 17.22 8.6L16.64 8.8Z" />
                    </svg>
                  </div>
                </Link>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <h3 className="text-lg font-semibold text-white mb-4">Информация</h3>
              <ul className="space-y-2 text-center">
                <li>
                  <Link
                    href="#"
                    className="text-gray-300 hover:text-emerald-400 transition-colors flex items-center justify-center"
                  >
                    <span>Политика конфиденциальности</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1.5 text-gray-400" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="text-gray-300 hover:text-emerald-400 transition-colors flex items-center justify-center"
                  >
                    <span>Пользовательское соглашение</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1.5 text-gray-400" />
                  </Link>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 text-center w-full">
              <p className="text-gray-400 text-sm">© {currentYear} ROSSEL 66 MUSIC. Все права защищены.</p>
            </div>
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="w-full max-w-screen-xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4 sm:px-14">
          <div className="flex flex-col items-center md:items-start">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center mb-4"
            >
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%D0%BB%D0%BE%D0%B3%D0%BE%20%D1%84%D1%83%D0%BB%D0%BB-1uNYD3zhCnNZ6BTo2MvyRpgjkpAnya.png"
                alt="ROSSEL 66 MUSIC"
                width={50}
                height={50}
                className="mr-3"
              />
              <span className="text-xl font-bold text-white">ROSSEL 66 MUSIC</span>
            </motion.div>
            <p className="text-gray-400 text-center md:text-left">Деловые отношения, дружеская атмосфера</p>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <h3 className="text-lg font-semibold text-white mb-4">Контакты</h3>
            <div className="flex items-center mb-4">
              <Mail className="w-5 h-5 text-emerald-400 mr-2" />
              <a href="mailto:label@rossel66.com" className="text-gray-300 hover:text-emerald-400 transition-colors">
                label@rossel66.com
              </a>
            </div>
            <div className="flex space-x-4">
                <Link href="https://vk.com/rossel66" target="_blank" rel="noopener noreferrer" className="group">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-emerald-500/20 transition-colors">
                  <svg
                    className="w-5 h-5 text-white group-hover:text-emerald-400 transition-colors"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93V15.07C2 20.67 3.33 22 8.93 22H15.07C20.67 22 22 20.67 22 15.07V8.93C22 3.33 20.67 2 15.07 2ZM18.15 16.27H16.69C16.14 16.27 15.97 15.82 14.86 14.72C13.86 13.77 13.49 13.67 13.27 13.67C12.95 13.67 12.87 13.76 12.87 14.18V15.77C12.87 16.1 12.75 16.27 11.81 16.27C10.21 16.27 8.46 15.32 7.18 13.59C5.36 11.05 4.85 9.13 4.85 8.76C4.85 8.55 4.93 8.36 5.33 8.36H6.8C7.14 8.36 7.27 8.52 7.41 8.92C8.1 10.94 9.97 13.63 10.54 13.63C10.74 13.63 10.83 13.53 10.83 13.05V10.28C10.77 9.25 10.33 9.19 10.33 8.86C10.33 8.7 10.46 8.53 10.68 8.53H12.87C13.15 8.53 13.26 8.7 13.26 9.08V12.43C13.26 12.71 13.4 12.82 13.5 12.82C13.7 12.82 13.88 12.71 14.24 12.35C15.33 11.09 16.11 9.13 16.11 9.13C16.2 8.9 16.36 8.68 16.72 8.68H18.19C18.56 8.68 18.66 8.89 18.56 9.19C18.39 9.93 16.96 12.07 16.96 12.07C16.83 12.29 16.77 12.4 16.96 12.64C17.1 12.83 17.56 13.23 17.85 13.57C18.39 14.17 18.8 14.67 18.94 15.07C19.07 15.47 18.87 15.68 18.52 15.68L18.15 16.27Z" />
                  </svg>
                </div>
              </Link>
                <Link href="https://t.me/rossel66" target="_blank" rel="noopener noreferrer" className="group">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-cyan-500/20 transition-colors">
                  <svg
                    className="w-5 h-5 text-white group-hover:text-cyan-400 transition-colors"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.64 8.8C16.49 10.38 15.84 14.22 15.51 15.99C15.37 16.74 15.09 16.99 14.83 17.02C14.25 17.07 13.81 16.64 13.25 16.27C12.37 15.69 11.87 15.33 11.02 14.77C10.03 14.12 10.67 13.76 11.24 13.18C11.39 13.03 13.95 10.7 14 10.49C14.0069 10.4582 14.006 10.4252 13.9973 10.3938C13.9886 10.3624 13.9724 10.3337 13.95 10.31C13.89 10.26 13.81 10.28 13.74 10.29C13.65 10.31 12.25 11.24 9.52 13.08C9.1 13.35 8.72 13.49 8.38 13.48C8.01 13.47 7.3 13.28 6.76 13.11C6.1 12.91 5.58 12.8 5.62 12.44C5.64 12.25 5.9 12.06 6.4 11.87C9.32 10.63 11.32 9.79 12.4 9.34C15.57 7.92 16.2 7.69 16.63 7.69C16.72 7.69 16.93 7.72 17.07 7.83C17.19 7.92 17.22 8.05 17.23 8.14C17.22 8.19 17.25 8.42 17.22 8.6L16.64 8.8Z" />
                  </svg>
                </div>
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <h3 className="text-lg font-semibold text-white mb-4">Информация</h3>
            <ul className="space-y-2 text-center md:text-left">
              <li>
                <Link
                  href="#"
                  className="text-gray-300 hover:text-emerald-400 transition-colors flex items-center justify-center md:justify-start"
                >
                  <span>Политика конфиденциальности</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5 text-gray-400" />
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-300 hover:text-emerald-400 transition-colors flex items-center justify-center md:justify-start"
                >
                  <span>Пользовательское соглашение</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5 text-gray-400" />
                </Link>
              </li>
            </ul>
          </div>
        </div>

          <div className="mt-8 pt-6 border-t border-white/10 text-center px-4 sm:px-14">
          <p className="text-gray-400 text-sm">© {currentYear} ROSSEL 66 MUSIC. Все права защищены.</p>
        </div>
      </div>
      )}
    </footer>
  )
}
