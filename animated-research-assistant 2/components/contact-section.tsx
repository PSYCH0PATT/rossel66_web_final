"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Send, User, MessageSquare } from "lucide-react"

interface ContactSectionProps {
  windowSize: {
    width: number
    height: number
  }
}

// Данные артистов
const artists = [
  {
    id: 1,
    name: "WIDE PIE",
    description: 'Релиз "blurred", выпущенный через ROSSEL 66, собрал более 200к прослушиваний в первую неделю',
    image: "/images/artists/artist.png",
  },
  {
    id: 2,
    name: "PLVT",
    description:
      'Более 1500000 прослушиваний на треке "like you" и свыше 100000 ежемесячных слушателей на Яндекс Музыке',
    image: "/images/artists/artist.png",
  },
  {
    id: 3,
    name: "Sour Diesel",
    description: 'Более 1000000 прослушиваний на треке "Воспоминания"',
    image: "/images/artists/artist.png",
  },
  {
    id: 4,
    name: "Здесь можешь быть ты!",
    description: "Заполни форму ниже и стань частью нашей команды",
    image: "/images/artists/artist.png",
    isSpecial: true,
  },
]

export default function ContactSection({ windowSize }: ContactSectionProps) {
  const [formData, setFormData] = useState({
    nickname: "",
    telegram: "",
    about: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  // Адаптивные размеры в зависимости от размера экрана
  const titleSize = windowSize.width < 640 ? "text-3xl" : windowSize.width < 1024 ? "text-4xl" : "text-5xl"

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  // Изменяем функцию handleSubmit, чтобы отправлять данные на Google Apps Script
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // URL Google Apps Script
    const scriptURL =
      "https://script.google.com/macros/s/AKfycbw3nUVeT_xqlK97hrqxQmb6KTN99AKig2B0RiyRWICbT-bUREDO7bhUTPHSaxbalud6/exec"

    // Отправляем данные на сервер
    fetch(scriptURL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nickname: formData.nickname,
        telegram: formData.telegram,
        about: formData.about,
      }),
    })
      .then(() => {
        // Успешная отправка
        setIsSubmitting(false)
        setIsSubmitted(true)
        setFormData({
          nickname: "",
          telegram: "",
          about: "",
        })

        // Сбрасываем сообщение об успешной отправке через 5 секунд
        setTimeout(() => {
          setIsSubmitted(false)
        }, 5000)
      })
      .catch((error) => {
        // Обработка ошибки
        console.error("Error:", error)
        setIsSubmitting(false)
        // Можно добавить состояние для отображения ошибки
        // setSubmitError(true)
      })
  }

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-start py-12 sm:py-16">
      {/* Диагональные линии на фоне */}
      <div className="absolute inset-0 z-0">
        <div className="diagonal-lines"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-12"
        >
          <h2 className={`${titleSize} font-bold text-white mb-4`}>Наши артисты</h2>
          <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto mb-4 sm:mb-8"></div>
        </motion.div>

        {/* Карточки артистов */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {artists.map((artist, index) => (
            <motion.div
              key={artist.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{
                scale: 1.05,
                transition: { duration: 0.3 },
              }}
              className={`glass-card overflow-hidden ${
                index % 2 === 0
                  ? "bg-emerald-500/20 hover:bg-gradient-to-br from-emerald-500/40 to-emerald-600/20"
                  : "bg-cyan-500/20 hover:bg-gradient-to-br from-cyan-500/40 to-cyan-600/20"
              } ${artist.isSpecial ? "border-emerald-500/50" : ""}`}
              style={
                {
                  "--mouse-x": "0px",
                  "--mouse-y": "0px",
                } as React.CSSProperties
              }
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                const y = e.clientY - rect.top
                e.currentTarget.style.setProperty("--mouse-x", `${x}px`)
                e.currentTarget.style.setProperty("--mouse-y", `${y}px`)
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: `radial-gradient(circle 200px at var(--mouse-x) var(--mouse-y), 
                    ${index % 2 === 0 ? "rgba(16, 185, 129, 0.4)" : "rgba(6, 182, 212, 0.4)"} 0%, 
                    transparent 80%)`,
                }}
              />

              <div className="relative h-48 sm:h-56 overflow-hidden">
                <Image
                  src={artist.image || "/placeholder.svg"}
                  alt={artist.name}
                  fill
                  className="object-cover transition-transform duration-500 hover:scale-115"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-4">
                  <h3 className="text-xl font-bold text-white">{artist.name}</h3>
                </div>
              </div>
              <div className="p-4 relative z-10">
                <p className="text-gray-300 text-sm">{artist.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Форма обратной связи */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          id="contact-form"
          className="max-w-2xl mx-auto w-full"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Отправить заявку</h2>
            <p className="text-gray-300">Заполните форму ниже, и мы свяжемся с вами</p>
          </div>

          {isSubmitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg p-6 text-center"
            >
              <h3 className="text-xl font-bold text-white mb-2">Спасибо за заявку!</h3>
              <p className="text-gray-300">Мы рассмотрим вашу заявку и свяжемся с вами в ближайшее время.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="nickname" className="flex items-center text-white">
                  <User className="w-4 h-4 mr-2" />
                  Никнейм
                </label>
                <Input
                  id="nickname"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  placeholder="Ваш творческий псевдоним"
                  required
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="telegram" className="flex items-center text-white">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Телеграм для связи
                </label>
                <Input
                  id="telegram"
                  name="telegram"
                  value={formData.telegram}
                  onChange={handleChange}
                  placeholder="@username"
                  required
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="about" className="flex items-center text-white">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Немного о себе, ваши успехи
                </label>
                <Textarea
                  id="about"
                  name="about"
                  value={formData.about}
                  onChange={handleChange}
                  placeholder="Расскажите о своем творчестве, достижениях и целях"
                  required
                  className="bg-white/5 border-white/10 text-white min-h-[120px]"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.31)] transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.44)]"
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Отправка...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Send className="mr-2 h-4 w-4" />
                    Отправить заявку
                  </span>
                )}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  )
}
