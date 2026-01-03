"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, FileText, Upload, FileSignature, ExternalLink, Mail } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import Footer from "@/components/footer"
import { SparklesCore } from "@/components/sparkles"

export default function GuidePage() {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })

      const handleResize = () => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      }

      window.addEventListener("resize", handleResize)
      return () => window.removeEventListener("resize", handleResize)
    }
  }, [])

  // Обеспечиваем свободную прокрутку на странице
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow
    const originalHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = "auto"
    document.documentElement.style.overflow = "auto"

    return () => {
      document.body.style.overflow = originalBodyOverflow
      document.documentElement.style.overflow = originalHtmlOverflow
    }
  }, [])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  }

  return (
    <main className="min-h-screen overflow-y-auto overflow-x-hidden bg-black/[0.96] antialiased bg-grid-white/[0.02] relative">
      {/* Ambient background with moving particles */}
      <div className="h-full w-full fixed inset-0 z-0">
        <SparklesCore
          id="tsparticlesguide"
          background="transparent"
          minSize={0.9}
          maxSize={2.1}
          particleDensity={windowSize.width < 768 ? 120 : 195}
          className="w-full h-full"
          particleColor="#FFFFFF"
        />
      </div>

      <div className="relative z-10">
        <div className="container mx-auto px-4 sm:px-6 pb-16" style={{ paddingTop: "3rem" }}>
          {/* Back button */}
          <div className="flex items-center mb-8">
            <Link href="/">
              <Button variant="ghost" className="text-white p-2 hover:bg-white/10">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Вернуться на главную
              </Button>
            </Link>
          </div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
                Гайд для новых артистов
              </span>
            </h1>
            <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto mb-6"></div>
            <p className="text-gray-300 text-lg sm:text-xl max-w-3xl mx-auto">
              Всё, что нужно, чтобы начать наше сотрудничество
            </p>
          </motion.div>

          {/* Welcome section */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-4xl mx-auto mb-16"
          >
            <motion.div
              variants={itemVariants}
              className="glass-card bg-white/5 p-8 sm:p-10 mb-8"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                Добро пожаловать в ROSSEL 66!
              </h2>
              <p className="text-gray-300 text-base sm:text-lg leading-relaxed mb-4">
                Этот гайд — ваш первый шаг к началу сотрудничества с нами. Здесь мы расскажем, какие формы необходимо заполнить и как проходит процесс подписания договоров.
              </p>
            </motion.div>
          </motion.div>

          {/* Forms section */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-4xl mx-auto mb-16"
          >
            <motion.div variants={itemVariants} className="mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-8 text-center">
                Какие формы нужно заполнить?
              </h2>
              <p className="text-gray-300 text-lg text-center mb-12 max-w-2xl mx-auto">
                У нас есть две формы, которые необходимо заполнить, чтобы начать работу:
              </p>
            </motion.div>

            {/* Form cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              {/* Form 1 */}
              <motion.div
                variants={itemVariants}
                className="glass-card bg-white/5 p-8 hover:bg-white/10 transition-all duration-300 group"
              >
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/50 rounded-none mr-4 group-hover:bg-emerald-500/20 transition-colors">
                    <FileText className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Форма №1</h3>
                </div>
                <h4 className="text-lg font-semibold text-emerald-400 mb-3">
                  Форма с вашими данными
                </h4>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  Заполняется один раз — в дальнейшем мы будем использовать эти данные для подготовки договоров на релизы.
                </p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Перед подписанием мы всегда отправляем договор для ознакомления и подробно объясняем каждый пункт, если у артистов возникают вопросы.
                </p>
                <Link href="/forms/dataRF" className="mt-6 inline-block">
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-full transition-all">
                    Заполнить форму
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </motion.div>

              {/* Form 2 */}
              <motion.div
                variants={itemVariants}
                className="glass-card bg-white/5 p-8 hover:bg-white/10 transition-all duration-300 group"
              >
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/50 rounded-none mr-4 group-hover:bg-cyan-500/20 transition-colors">
                    <Upload className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Форма №2</h3>
                </div>
                <h4 className="text-lg font-semibold text-cyan-400 mb-3">
                  Форма для отгрузки релиза
                </h4>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  Если предыдущая форма заполняется один раз, то с этой вы будете работать регулярно.
                </p>
                <p className="text-gray-400 text-sm leading-relaxed italic">
                  Пожалуйста, отнеситесь ответственно к заполнению промо-информации. Старайтесь указывать всё максимально подробно — даже если ради этого придётся чуть-чуть приукрасить факты:)
                </p>
                <Link href="/forms/releaseUPLOAD" className="mt-6 inline-block">
                  <Button className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-2 rounded-full transition-all">
                    Заполнить форму
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </motion.div>
            </div>
          </motion.div>

          {/* Documents section */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-4xl mx-auto mb-16"
          >
            <motion.div
              variants={itemVariants}
              className="glass-card bg-white/5 p-8 sm:p-10"
            >
              <div className="flex items-center mb-6">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/50 rounded-none mr-4">
                  <FileSignature className="w-6 h-6 text-emerald-400" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">
                  Как мы подписываем документы?
                </h2>
              </div>
              <p className="text-gray-300 text-base sm:text-lg leading-relaxed mb-6">
                Мы используем электронный документооборот через систему Контур.Сайн с применением Простой Электронной Подписи (ПЭП). Это удобно, безопасно и соответствует законодательству РФ — вы можете подписывать все документы онлайн, не выходя из дома.
              </p>
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-none">
                <p className="text-emerald-300 text-sm">
                  <strong className="text-emerald-400">Важно:</strong> Для работы с документами вам необходимо получить Простую Электронную Подпись (ПЭП).
                </p>
                <p className="text-emerald-300 text-sm mt-2">
                  Вот подробная инструкция, <a href="https://support.kontur.ru/sign/53303-pep" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">как получить ПЭП</a>
                </p>
              </div>
            </motion.div>
          </motion.div>

          {/* Contact section */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-3xl mx-auto text-center mb-16"
          >
            <motion.div variants={itemVariants}>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-6">
                Остались вопросы?
              </h3>
              <p className="text-gray-300 mb-8 text-lg">
                Свяжитесь с нами, и мы с радостью ответим на все ваши вопросы
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="mailto:label@rossel66.com"
                  className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  <span className="text-lg">label@rossel66.com</span>
                </a>
              </div>
            </motion.div>
          </motion.div>

          {/* Footer branding */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-2xl mx-auto text-center mb-8"
          >
          </motion.div>
        </div>

        <Footer />
      </div>
    </main>
  )
}

