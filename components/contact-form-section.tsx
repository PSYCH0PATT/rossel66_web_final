"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Send, User, MessageSquare, Music } from "lucide-react"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

// Добавим параметр mobileScale в интерфейс ContactFormSectionProps
interface ContactFormSectionProps {
  windowSize: {
    width: number
    height: number
  }
}

// Теперь нужно использовать этот масштаб в компоненте
// Найдем в начале функции ContactFormSection и добавим:
export default function ContactFormSection({ windowSize }: ContactFormSectionProps) {
  const [formData, setFormData] = useState({
    nickname: "",
    telegram: "",
    about: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  // Адаптивные размеры в зависимости от размера экрана
  const titleSize = windowSize.width < 640 ? "text-3xl" : windowSize.width < 1024 ? "text-4xl" : "text-5xl"

  // Применяем масштаб для мобильных устройств
  const isMobile = useMobileDetector()

  // Рассчитываем ширину контейнера с учетом масштаба
  const containerStyle = useMemo(() => {
    if (isMobile) {
      const widthMultiplier = 1.9; // Set to 190%
      const marginOffset = `${(widthMultiplier - 1) * 50}%`; // (1.9 - 1) * 50 = 45%

      return {
        width: `${widthMultiplier * 100}%`,
        maxWidth: `${widthMultiplier * 100}%`,
        marginLeft: `-${marginOffset}`,
        marginRight: `-${marginOffset}`,
      }
    }

    return {}
  }, [isMobile])

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

  // Применяем стили к контейнеру
  return (
    <div
      className="w-full min-h-screen flex flex-col items-center justify-center py-10 sm:py-24"
      style={containerStyle}
    >
      {/* Диагональные линии на фоне */}
      <div className="absolute inset-0 z-0">
        <div className="diagonal-lines"></div>
      </div>

      <div className="relative z-10 container mx-auto px-3 sm:px-4 md:px-6 flex flex-col items-center justify-center w-full max-w-[95%] sm:max-w-[90%] md:max-w-[85%]">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-4 sm:mb-12 w-full"
        >
          <h2 className={`${titleSize} font-bold text-white mb-4`}>Отправить заявку</h2>
          <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto mb-2 sm:mb-8"></div>
          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto">
            Заполните форму ниже, и мы свяжемся с вами для обсуждения сотрудничества
          </p>
        </motion.div>

        {/* Форма обратной связи */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          id="contact-form"
          className="max-w-[95%] sm:max-w-md md:max-w-lg lg:max-w-2xl mx-auto w-full"
        >
          <div className="glass-card p-4 sm:p-6 md:p-8 bg-white/5">
            {isSubmitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-500/20 border border-emerald-500/30 rounded-none p-6 text-center"
              >
                <h3 className="text-xl font-bold text-white mb-2">Спасибо за заявку!</h3>
                <p className="text-gray-300">Мы рассмотрим вашу заявку и свяжемся с вами в ближайшее время.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-3">
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
                    className="bg-white/5 border-white/10 text-white h-12"
                  />
                </div>

                <div className="space-y-3">
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
                    className="bg-white/5 border-white/10 text-white h-12"
                  />
                </div>

                <div className="space-y-3">
                  <label htmlFor="about" className="flex items-center text-white">
                    <Music className="w-4 h-4 mr-2" />
                    Немного о себе, ваши успехи
                  </label>
                  <Textarea
                    id="about"
                    name="about"
                    value={formData.about}
                    onChange={handleChange}
                    placeholder="Расскажите о своем творчестве, достижениях и целях"
                    required
                    className="bg-white/5 border-white/10 text-white min-h-[150px]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-7 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.31)] transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.44)]"
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
          </div>
        </motion.div>
      </div>
    </div>
  )
}
