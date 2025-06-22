"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea" // Keep for potential future use, though not in this form
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" // For multiple_choice
import { SparklesCore } from "@/components/sparkles"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

interface FormDataNotRF {
  nickname: string
  telegramProfile: string
  email: string
  // Citizenship fields
  citizenship: string // Stores choice_id for Pyrus
  otherCitizenship: string
  // Passport fields
  passportFullName: string
  passportShortName: string
  dateOfBirth: string
  passportIdNumber: string // series and number
  passportIssuedBy: string
  passportDepartmentCode: string
  passportIssueDate: string
  placeOfBirth: string
  registrationAddress: string
  taxId: string
  // Bank fields
  bankName: string
  bankAccountNumber: string
  bankCorrespondentAccount: string
  bankBik: string
  bankInn: string
  bankKpp: string
}

// Options for Citizenship based on Pyrus form 1554517, field ID 25
const citizenshipOptions = [
  { choice_id: "1", choice_value: "Азербайджанской Республики" },
  { choice_id: "2", choice_value: "Грузии" },
  { choice_id: "3", choice_value: "Королевства Норвегия" },
  { choice_id: "4", choice_value: "Китайской Народной Республики" },
  { choice_id: "5", choice_value: "Латвийская Республики" },
  { choice_id: "6", choice_value: "Литовской Республики" },
  // choice_id 7 "Республика Абхазия" is deleted
  { choice_id: "8", choice_value: "Республики Беларусь" },
  { choice_id: "9", choice_value: "Республики Казахстан" },
  { choice_id: "10", choice_value: "Республики Польша" },
  // choice_id 11 "Республики Южная Осетия" is deleted
  { choice_id: "12", choice_value: "Финляндской Республики" },
  { choice_id: "13", choice_value: "Эстонской Республики" },
  { choice_id: "14", choice_value: "Украины" },
  { choice_id: "15", choice_value: "Чешской Республики" },
  { choice_id: "16", choice_value: "Другое" },
];


export default function DataNotRFFormPage() {
  const [formData, setFormData] = useState<FormDataNotRF>({
    nickname: "",
    telegramProfile: "",
    email: "",
    citizenship: "0", // Default to "Не выбрано" (choice_id 0 from Pyrus, handled by placeholder in Select)
    otherCitizenship: "",
    passportFullName: "",
    passportShortName: "",
    dateOfBirth: "",
    passportIdNumber: "",
    passportIssuedBy: "",
    passportDepartmentCode: "",
    passportIssueDate: "",
    placeOfBirth: "",
    registrationAddress: "",
    taxId: "",
    bankName: "",
    bankAccountNumber: "",
    bankCorrespondentAccount: "",
    bankBik: "",
    bankInn: "",
    bankKpp: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(null)
  const [submitMessage, setSubmitMessage] = useState("")
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    document.title = 'Не РФ | ROSSEL 66 MUSIC';
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: keyof FormDataNotRF, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus(null)
    setSubmitMessage("")

    try {
      const response = await fetch("/api/submit-pyrus-data-not-rf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (response.ok) {
        setSubmitStatus("success")
        setSubmitMessage("Данные успешно отправлены!")
        setFormData({ // Reset form
            nickname: "", telegramProfile: "", email: "", citizenship: "0", otherCitizenship: "",
            passportFullName: "", passportShortName: "", dateOfBirth: "", passportIdNumber: "",
            passportIssuedBy: "", passportDepartmentCode: "", passportIssueDate: "", placeOfBirth: "",
            registrationAddress: "", taxId: "", bankName: "", bankAccountNumber: "",
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
    name: keyof FormDataNotRF,
    label: string,
    placeholder: string = "",
    type: string = "text",
    required: boolean = true,
    className: string = ""
  ) => (
    <div className={`mb-6 ${className}`}>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-300 mb-1"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
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
    </div>
  )
  
  const renderSelectField = (
    name: keyof FormDataNotRF,
    label: string,
    options: { choice_id: string; choice_value: string }[],
    placeholder: string = "Не выбрано",
    required: boolean = true,
    className: string = ""
  ) => (
    <div className={`mb-6 ${className}`}>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Select
        value={formData[name]}
        onValueChange={(value: string) => handleSelectChange(name, value)}
        required={required}
      >
        <SelectTrigger className="w-full bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 border-opacity-50 hover:border-emerald-500 hover:border-opacity-40">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-neutral-800 border-neutral-700 text-gray-200">
          <SelectItem value="0" disabled>{placeholder}</SelectItem>
          {options.map(option => (
            <SelectItem key={option.choice_id} value={option.choice_id} className="hover:bg-neutral-700">
              {option.choice_value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <main 
      className="min-h-screen flex flex-col overflow-y-auto overflow-x-hidden bg-black/[0.96] antialiased bg-grid-white/[0.02] relative"
      style={{ fontFamily: "'Mulish', sans-serif" }}
    >
      <Navbar />
      <div className="flex-grow pt-20 pb-12 md:pt-24 md:pb-16 relative">
        <div className="h-full w-full fixed inset-0 z-0">
          <SparklesCore
            id="tsparticlesfullpage-datanotrf"
            background="transparent"
            minSize={0.9}
            maxSize={2.1}
            particleDensity={windowSize.width < 768 ? 100 : 180}
            className="w-full h-full"
            particleColor="#FFFFFF"
          />
        </div>

        <div className="relative z-10 container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10 md:mb-12"
          >
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Форма сбора данных (не РФ)
            </h1>
            <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto"></div>
          </motion.div>

          <div className="max-w-6xl mx-auto shadow-2xl relative z-10">
            {/* Decorative Flashes - Copied from dataRF form, adjust as needed */}
            {/* Removed flash divs */}

            <form
              onSubmit={handleSubmit}
              className="w-full h-full bg-neutral-990/60 backdrop-blur-sm p-6 sm:p-8 relative z-[1]"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderImageSource: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.5), rgba(20, 184, 166, 0.5), rgba(6, 182, 212, 0.5))',
                borderImageSlice: 1,
              }}
            >
              <h2 className="text-xl font-semibold text-white mb-6 border-b border-white/20 pb-3">
                Основная информация
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                {renderInputField("nickname", "Ваш никнейм", "", "text", true, "md:col-span-1")}
                {renderInputField("telegramProfile", "Ссылка на профиль в Telegram", "https://t.me/username", "text", true, "md:col-span-1")}
              </div>
              {renderInputField("email", "Адрес электронной почты", "name@example.com", "email", true, "md:col-span-2")}

              {/* Pyrus Note field ID 4 - "Паспортные данные" */}
              <h2 className="text-xl font-semibold text-white mt-10 mb-6 border-b border-white/20 pb-3 md:col-span-2">
                Паспортные данные
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                {renderSelectField("citizenship", "Гражданство", citizenshipOptions, "Не выбрано", true, "md:col-span-1")}
                {formData.citizenship === "16" && // Pyrus Field ID 26 (Other Citizenship) visible if ID 25 is "16"
                  renderInputField("otherCitizenship", "Укажите гражданство", "", "text", true, "md:col-span-1")}
                {renderInputField("passportFullName", "ФИО (как в паспорте)", "Ivan Ivanov Ivanovich", "text", true, formData.citizenship !== "16" ? "md:col-span-1" : "md:col-span-2")}
                {renderInputField("passportShortName", "Кратко ФИО", "Ivanov I. I.", "text", true, "md:col-span-1")}
                {renderInputField("dateOfBirth", "Дата рождения", "", "date", true, "md:col-span-1")}
                {renderInputField("passportIdNumber", "Серия и номер паспорта / ID документа", "", "text", true, "md:col-span-1")}
                {renderInputField("passportIssuedBy", "Кем выдан документ", "", "text", false, "md:col-span-1")}
                 {renderInputField("passportIssueDate", "Дата выдачи документа", "", "date", false, "md:col-span-1")}
                {renderInputField("passportDepartmentCode", "Код подразделения (если применимо)", "", "text", false, "md:col-span-1")}
              </div>
               {renderInputField("placeOfBirth", "Место рождения (как в паспорте)", "", "text", true, "md:col-span-2")}
               {renderInputField("registrationAddress", "Адрес регистрации (как в паспорте)", "", "text", true, "md:col-span-2" )}
               {renderInputField("taxId", "Налоговый идентификатор Вашей страны", "", "text", false, "md:col-span-2")}


              {/* Pyrus Note field ID 16 - "Банковские реквизиты" */}
              <h2 className="text-xl font-semibold text-white mt-10 mb-6 border-b border-white/20 pb-3 md:col-span-2">
                Банковские реквизиты
              </h2>
              <p className="text-sm text-gray-400 mb-6 md:col-span-2">
                Чтобы найти банковские реквизиты в онлайн банке, войдите в свой аккаунт и перейдите в раздел "Счета" или "Карты", снизу раздела находится кнопка "Реквизиты".
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                {renderInputField("bankName", "Наименование банка", "", "text", true, "md:col-span-2")}
                {renderInputField("bankAccountNumber", "Номер счёта (IBAN)", "Не номер карты", "text", true, "md:col-span-1")}
                {renderInputField("bankCorrespondentAccount", "Корреспондентский счёт (если есть)", "", "text", false, "md:col-span-1")}
                {renderInputField("bankBik", "SWIFT/BIC", "", "text", false, "md:col-span-1")}
                {renderInputField("bankInn", "ИНН/Tax ID банка (если есть)", "", "text", false, "md:col-span-1")}
              </div>
              {renderInputField("bankKpp", "КПП банка (если есть)", "", "text", false, "md:col-span-2")}
              

              {submitStatus && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
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