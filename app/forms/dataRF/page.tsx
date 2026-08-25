"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SparklesCore } from "@/components/sparkles"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

interface FormData {
  nickname: string
  telegramProfile: string
  email: string
  passportFullName: string
  passportShortName: string
  dateOfBirth: string
  passportSeriesNumber: string
  passportIssuedBy: string
  passportIssueDate: string
  passportDepartmentCode: string
  placeOfBirth: string
  registrationAddress: string
  snils: string
  inn: string
  bankName: string
  bankAccountNumber: string
  bankCorrespondentAccount: string
  bankBik: string
  bankInn: string
  bankKpp: string
}

export default function DataRFFormPage() {
  const [formData, setFormData] = useState<FormData>({
    nickname: "",
    telegramProfile: "",
    email: "",
    passportFullName: "",
    passportShortName: "",
    dateOfBirth: "",
    passportSeriesNumber: "",
    passportIssuedBy: "",
    passportIssueDate: "",
    passportDepartmentCode: "",
    placeOfBirth: "",
    registrationAddress: "",
    snils: "",
    inn: "",
    bankName: "",
    bankAccountNumber: "",
    bankCorrespondentAccount: "",
    bankBik: "",
    bankInn: "",
    bankKpp: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(
    null
  )
  const [submitMessage, setSubmitMessage] = useState("")
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    document.title = 'Анкета РФ | ROSSEL 66 MUSIC';
  }, []);

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

  // Input mask functions
  const formatPassportSeriesNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    // Limit to 10 digits (4 for series + 6 for number)
    const limited = digits.slice(0, 10)
    // Format as "0000 000000"
    if (limited.length <= 4) {
      return limited
    }
    return `${limited.slice(0, 4)} ${limited.slice(4)}`
  }

  const formatDepartmentCode = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    // Limit to 6 digits
    const limited = digits.slice(0, 6)
    // Format as "000-000"
    if (limited.length <= 3) {
      return limited
    }
    return `${limited.slice(0, 3)}-${limited.slice(3)}`
  }

  const formatSnils = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    // Limit to 11 digits
    const limited = digits.slice(0, 11)
    // Format as "000-000-000 00"
    if (limited.length <= 3) {
      return limited
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`
    } else if (limited.length <= 9) {
      return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`
    }
    return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6, 9)} ${limited.slice(9)}`
  }

  const formatInn = (value: string) => {
    // Remove all non-digits and limit to 12 digits for individuals
    const digits = value.replace(/\D/g, '').slice(0, 12)
    return digits
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    
    let formattedValue = value
    
    // Apply formatting based on field name
    switch (name) {
      case 'passportSeriesNumber':
        formattedValue = formatPassportSeriesNumber(value)
        break
      case 'passportDepartmentCode':
        formattedValue = formatDepartmentCode(value)
        break
      case 'snils':
        formattedValue = formatSnils(value)
        break
      case 'inn':
        formattedValue = formatInn(value)
        break
      default:
        formattedValue = value
    }
    
    setFormData((prev) => ({ ...prev, [name]: formattedValue }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus(null)
    setSubmitMessage("")

    try {
      // Clean formatted values before sending
      const cleanedData = {
        ...formData,
        // Keep passport series/number with space format as Pyrus expects "XXXX XXXXXX"
        passportSeriesNumber: formData.passportSeriesNumber,
        // Clean department code - Pyrus expects "XXX-XXX" format
        passportDepartmentCode: formData.passportDepartmentCode,
        // Clean SNILS - Pyrus expects "XXX-XXX-XXX XX" format  
        snils: formData.snils,
        // Clean INN to only digits
        inn: formData.inn.replace(/\D/g, '')
      }

      const uploadId = self.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)

      const response = await fetch("/api/forms/simple", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formType: "data_rf",
          title: cleanedData.nickname || "Данные РФ",
          contactEmail: cleanedData.email,
          contactTelegram: cleanedData.telegramProfile,
          artistNickname: cleanedData.nickname,
          payload: cleanedData,
          uploadId,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setSubmitStatus("success")
        setSubmitMessage("Данные успешно отправлены!")
        setFormData({
            nickname: "", telegramProfile: "", email: "",
            passportFullName: "", passportShortName: "", dateOfBirth: "",
            passportSeriesNumber: "", passportIssuedBy: "", passportIssueDate: "",
            passportDepartmentCode: "", placeOfBirth: "", registrationAddress: "",
            snils: "", inn: "", bankName: "", bankAccountNumber: "",
            bankCorrespondentAccount: "", bankBik: "", bankInn: "", bankKpp: "",
        })
      } else {
        setSubmitStatus("error")
        setSubmitMessage(result.message || "Ошибка при отправке данных.")
      }
    } catch (error) {
      setSubmitStatus("error")
      setSubmitMessage("Произошла сетевая ошибка. Попробуйте снова.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderInputField = (
    name: keyof FormData,
    label: string,
    placeholder: string = "",
    type: string = "text",
    required: boolean = true,
    isTextarea: boolean = false,
    className: string = ""
  ) => (
    <div className={`mb-6 ${className}`}>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-300 mb-1"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {isTextarea ? (
        <Textarea
          id={name}
          name={name}
          value={formData[name]}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full border-opacity-50 hover:border-emerald-500 hover:border-opacity-40"
          rows={3}
        />
      ) : (
        <Input
          id={name}
          name={name}
          type={type}
          value={formData[name]}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full border-opacity-50 hover:border-emerald-500 hover:border-opacity-40"
        />
      )}
    </div>
  )

  return (
    <main 
      className="min-h-screen flex flex-col overflow-y-auto overflow-x-hidden antialiased bg-grid-white/[0.02] relative"
      style={{ fontFamily: "var(--font-mulish), sans-serif", zIndex: 10 }}
    >
      <Navbar />
      <div className="flex-grow pt-20 pb-12 md:pt-24 md:pb-16 relative">
        <div className="h-full w-full fixed inset-0 z-0">
          <SparklesCore
            id="tsparticlesfullpage-datarf"
            background="transparent"
            minSize={0.9}
            maxSize={2.1}
            particleDensity={windowSize.width < 768 ? 100 : 180}
            className="w-full h-full"
            particleColor="#FFFFFF"
          />
        </div>

        <div className="relative z-20 container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10 md:mb-12"
          >
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Форма сбора данных (РФ)
            </h1>
            <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto"></div>
          </motion.div>

          <div className="max-w-6xl mx-auto shadow-2xl relative overflow-hidden z-10">
            <form
              onSubmit={handleSubmit}
              data-testid="data-rf-form"
              className="w-full h-full bg-neutral-990/60 backdrop-blur-sm p-6 sm:p-8 relative z-[1]"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderImageSource: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.5), rgba(20, 184, 166, 0.5), rgba(6, 182, 212, 0.5))',
                borderImageSlice: 1,
              }}
            >
              <h2 className="text-xl font-semibold text-white mb-6 border-b border-white/20 pb-3">
                Персональные данные
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                {renderInputField("nickname", "Ваш никнейм", "", "text", true, false, "md:col-span-1")}
                {renderInputField(
                  "telegramProfile",
                  "Ссылка на профиль в Telegram",
                  "https://t.me/username",
                  "text",
                  false,
                  false,
                  "md:col-span-1"
                )}
              </div>
              {renderInputField(
                  "email",
                  "Адрес электронной почты",
                  "name@company.com",
                  "email",
                  true,
                  false,
                  "md:col-span-2"
              )}

              <h3 className="text-lg font-medium text-white mt-8 mb-4 md:col-span-2">
                Паспортные данные
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                {renderInputField(
                  "passportFullName",
                  "ФИО",
                  "В формате Иванов Иван Иванович",
                   "text", true, false, "md:col-span-2"
                )}
                {renderInputField(
                  "passportShortName",
                  "Кратко ФИО",
                  "В формате Иванов И. И."
                )}
                {renderInputField("dateOfBirth", "Дата рождения", "", "date")}
                {renderInputField(
                  "passportSeriesNumber",
                  "Серия и номер паспорта",
                  "0000 000000"
                )}
                {renderInputField("passportIssuedBy", "Кем выдан")}
                {renderInputField(
                  "passportDepartmentCode",
                  "Код подразделения",
                  "000-000"
                )}
                {renderInputField("passportIssueDate", "Дата выдачи", "", "date")}
                {renderInputField("placeOfBirth", "Место рождения", "", "text", true, false, "md:col-span-2")}
              </div>
              {renderInputField(
                  "registrationAddress",
                  "Адрес регистрации",
                  "",
                  "text",
                  true,
                  true,
                  "md:col-span-2"
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                {renderInputField("snils", "СНИЛС", "000-000-000 00")}
                {renderInputField("inn", "ИНН (12 цифр)", "000000000000")}
              </div>

              <h2 className="text-xl font-semibold text-white mt-10 mb-6 border-b border-white/20 pb-3 md:col-span-2">
                Банковские реквизиты
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                {renderInputField("bankName", "Наименование банка", "", "text", true, false, "md:col-span-2")}
                {renderInputField(
                  "bankAccountNumber",
                  "Номер счёта (не номер карты)"
                )}
                {renderInputField(
                  "bankCorrespondentAccount",
                  "Корреспондентский счёт"
                )}
                {renderInputField("bankBik", "БИК")}
                {renderInputField("bankInn", "ИНН банка")}
                {renderInputField("bankKpp", "КПП банка", "", "text", true, false, "md:col-span-2")}
              </div>

              {submitStatus && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  data-testid="form-submit-status"
                  data-status={submitStatus}
                  className={`mt-6 p-3 rounded-md text-sm ${
                    submitStatus === "success"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {submitMessage}
                </motion.div>
              )}

              <div className="mt-8 text-center md:col-span-2">
                <Button
                  type="submit"
                  data-testid="form-submit"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-md text-base font-semibold shadow-[0_0_15px_rgba(16,185,129,0.31)] transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.44)]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Отправка..." : "Отправить данные"}
                </Button>
              </div>
            </form>
          </div>

          <div className="pb-12"></div>
        </div>
      </div>
      <Footer forceTransparentBackground={true} />
    </main>
  )
} 