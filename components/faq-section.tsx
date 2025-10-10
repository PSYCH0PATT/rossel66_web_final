// @ts-nocheck
"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

// Update the FAQSectionProps interface to include mobileScale
interface FAQSectionProps {
  windowSize: {
    width: number
    height: number
  }
}

// Данные FAQ
const faqItems = [
  {
    id: 1,
    question: "Как начать сотрудничество с ROSSEL 66 MUSIC?",
    answer:
      "Для начала сотрудничества заполните форму обратной связи на нашем сайте. Наша команда рассмотрит вашу заявку и свяжется с вами для обсуждения деталей сотрудничества. Мы всегда открыты для новых талантов и интересных проектов.",
  },
  {
    id: 2,
    question: "Какие услуги предоставляет ваш лейбл?",
    answer:
      "ROSSEL 66 MUSIC предоставляет полный спектр услуг для музыкантов: дистрибуцию музыки на все цифровые площадки, продвижение релизов, таргетированную рекламу, организацию выступлений, SMM-сопровождение, продакшн (съемки клипов, фотосессии) и менеджмент. Мы помогаем артистам на всех этапах развития их карьеры.",
  },
  {
    id: 3,
    question: "Сколько стоят ваши услуги?",
    answer:
      "Стоимость услуг зависит от выбранного пакета и индивидуальных потребностей артиста. Мы предлагаем различные варианты сотрудничества, от базовой дистрибуции до полного продюсирования. Для получения детальной информации о ценах, пожалуйста, свяжитесь с нами через форму обратной связи.",
  },
  {
    id: 4,
    question: "Как происходит распределение доходов от стриминга?",
    answer:
      "Мы предлагаем прозрачную систему распределения доходов. Процент отчислений зависит от типа контракта и объема предоставляемых услуг. Все детали фиксируются в договоре, и вы всегда будете получать регулярные отчеты о прослушиваниях и доходах. Наша цель — построить долгосрочные и взаимовыгодные отношения с артистами.",
  },
  {
    id: 5,
    question: "Работаете ли вы с начинающими артистами?",
    answer:
      "Да, мы открыты для сотрудничества с талантливыми начинающими артистами. Мы верим в развитие новых имен в музыкальной индустрии и готовы поддержать перспективных музыкантов на старте их карьеры. Главное — это качество материала и уникальность звучания.",
  },
]

export default function FAQSection({ windowSize }: FAQSectionProps) {
  // Адаптивные размеры в зависимости от размера экрана (увеличены на 25% для мобильных)
  const titleSize = windowSize.width < 640 ? "text-4xl" : windowSize.width < 1024 ? "text-4xl" : "text-5xl"

  // Состояние для отслеживания открытых вопросов
  const [openItems, setOpenItems] = useState<number[]>([])

  // Применяем масштаб для мобильных устройств
  const isMobile = useMobileDetector()

  // Изменяем расчет containerStyle для мобильных устройств, чтобы соответствовать ширине формы
  const containerStyle = useMemo(() => {
    if (isMobile) {
      const widthMultiplier = 1.9; // Set to 190%
      const marginOffset = `${(widthMultiplier - 1) * 50}%`; // (1.9 - 1) * 50 = 45%

      return {
        width: `${widthMultiplier * 100}%`,
        maxWidth: `${widthMultiplier * 100}%`,
        marginLeft: `-${marginOffset}`,
        marginRight: `-${marginOffset}`,
      };
    }
    // For desktop, or if not isMobile, containerStyle will be an empty object,
    // so the desktop version's div will not have these inline styles.
    return {}; 
  }, [isMobile]); // Depends only on isMobile now

  // Функция для переключения состояния вопроса
  const toggleItem = (id: number) => {
    if (openItems.includes(id)) {
      setOpenItems(openItems.filter((item) => item !== id))
    } else {
      setOpenItems([...openItems, id])
    }
  }

  // Рендерим разные версии для мобильных и десктопных устройств
  if (isMobile) {
    // Мобильная версия (из версии 42)
    return (
      <div className="w-full h-full flex items-center justify-center py-4 sm:py-12" style={containerStyle}>
        {/* Диагональные линии на фоне */}
        <div className="absolute inset-0 z-0">
          <div className="diagonal-lines"></div>
        </div>

        {/* В мобильной версии меняем класс контейнера, добавляя ограничение ширины */}
        <div className="relative z-10 container mx-auto px-2 sm:px-4 md:px-6 flex flex-col items-center justify-center w-full max-w-[95%] sm:max-w-[90%] md:max-w-[85%]">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-5 sm:mb-8"
          >
            <h2 className={`${titleSize} font-bold text-white mb-3 sm:mb-4`}>Часто задаваемые вопросы</h2>
            <div className="w-12 sm:w-16 md:w-24 h-1 bg-emerald-500 mx-auto mb-3 sm:mb-4"></div>
            <p className="text-gray-300 text-lg sm:text-lg max-w-2xl mx-auto">
              Ответы на самые популярные вопросы о сотрудничестве с нашим лейблом
            </p>
          </motion.div>

          {/* FAQ аккордеон */}
          <div className="grid grid-cols-1 gap-4 sm:gap-3 md:gap-6 w-full mx-auto px-2 sm:px-4">
            {faqItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: item.id * 0.1 }}
                viewport={{ once: true }}
                className="glass-card bg-white/5 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    e.nativeEvent.stopImmediatePropagation()
                    toggleItem(item.id)
                  }}
                  className="w-full flex justify-between items-center p-5 text-left"
                  style={{ touchAction: 'manipulation' }}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    e.nativeEvent.stopImmediatePropagation()
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation()
                    e.nativeEvent.stopImmediatePropagation()
                  }}
                  onTouchMove={(e) => {
                    e.stopPropagation()
                    e.nativeEvent.stopImmediatePropagation()
                  }}
                >
                  <h3 className="text-xl font-semibold text-white">{item.question}</h3>
                  {openItems.includes(item.id) ? (
                    <ChevronUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  )}
                </button>

                <div
                  className={`px-5 overflow-hidden transition-[max-height,padding-bottom] duration-300 ease-in-out ${
                    openItems.includes(item.id) ? "max-h-96 pb-5" : "max-h-0"
                  }`}
                >
                  <p className="text-gray-300 text-base">{item.answer}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Кнопка "Показать все" */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            viewport={{ once: true }}
            className="text-center mt-6 sm:mt-8"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <Link href="/faq">
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.31)] transition-[background-color,box-shadow] duration-300 hover:shadow-[0_0_20px_rgba(16,185,129,0.44)]">
                <span className="flex items-center">
                  Показать все вопросы
                  <ExternalLink className="ml-2 w-4 h-4" />
                </span>
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    )
  }

  // Десктопная версия (из версии 43, оставляем без изменений)
  return (
    <div className="w-full py-12 sm:py-16">
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
          <h2 className={`${titleSize} font-bold text-white mb-4`}>Часто задаваемые вопросы</h2>
          <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto mb-4 sm:mb-8"></div>
          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto">
            Ответы на самые популярные вопросы о сотрудничестве с нашим лейблом
          </p>
        </motion.div>

        {/* FAQ аккордеон */}
        <div className="max-w-3xl mx-auto w-full space-y-4 mb-10">
          {faqItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: item.id * 0.1 }}
              viewport={{ once: true }}
              className="glass-card bg-white/5 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  e.nativeEvent.stopImmediatePropagation()
                  toggleItem(item.id)
                }}
                className="w-full flex justify-between items-center p-5 text-left"
                style={{ touchAction: 'manipulation' }}
                onTouchStart={(e) => {
                  e.stopPropagation()
                  e.nativeEvent.stopImmediatePropagation()
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation()
                  e.nativeEvent.stopImmediatePropagation()
                }}
                onTouchMove={(e) => {
                  e.stopPropagation()
                  e.nativeEvent.stopImmediatePropagation()
                }}
              >
                <h3 className="text-lg font-semibold text-white">{item.question}</h3>
                {openItems.includes(item.id) ? (
                  <ChevronUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                )}
              </button>

              <div
                className={`px-5 overflow-hidden transition-[max-height,padding-bottom] duration-300 ease-in-out ${
                  openItems.includes(item.id) ? "max-h-96 pb-5" : "max-h-0"
                }`}
              >
                <p className="text-gray-300">{item.answer}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Кнопка "Показать все" */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          viewport={{ once: true }}
          className="text-center"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <Link href="/faq">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.31)] transition-[background-color,box-shadow] duration-300 hover:shadow-[0_0_20px_rgba(16,185,129,0.44)]">
              <span className="flex items-center">
                Показать все вопросы
                <ExternalLink className="ml-2 w-4 h-4" />
              </span>
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
