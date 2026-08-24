"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { DashboardFooter } from "@/components/dashboard-footer"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { FileInput } from "@/components/ui/file-input"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"

export type ArtistSettingsInitial = {
  id: string
  name: string
  email: string
  username: string
  avatarUrl: string | null
}

export default function ArtistSettingsClient({
  initialArtist,
}: {
  initialArtist: ArtistSettingsInitial
}) {
  const [artist, setArtist] = useState(initialArtist)
  const { username } = artist

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialArtist.avatarUrl)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const router = useRouter()
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  // H2: раздельные состояния — отправка одной формы не блокирует другую
  const [avatarSubmitting, setAvatarSubmitting] = useState(false)
  const [pwSubmitting, setPwSubmitting] = useState(false)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // F-UI-4: валидация типа/размера до загрузки
    if (!file.type.startsWith("image/")) {
      setError("Выберите изображение")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Файл больше 5 МБ")
      return
    }
    setError("")
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleAvatarSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!avatarFile) {
      setError("Пожалуйста, выберите изображение")
      return
    }
    setAvatarSubmitting(true)
    setSuccess("")
    setError("")

    try {
      // F-UI-1: грузим файл в Storage и сохраняем короткий URL, а не base64
      // (avatarUrl ограничен 2000 символами — base64 всегда падал).
      const fd = new FormData()
      fd.append("file", avatarFile)
      const up = await fetch("/api/uploads/avatars", { method: "POST", body: fd })
      const upJson = await up.json()
      if (!up.ok || !upJson.success) {
        setError(upJson.error || "Не удалось загрузить изображение")
        return
      }

      const response = await fetch(`/api/artists`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: artist.id, avatarUrl: upJson.url }),
      })
      const result = await response.json()

      if (result.success) {
        setSuccess("Аватарка успешно обновлена")
        setArtist({ ...artist, avatarUrl: upJson.url })
        setAvatarPreview(upJson.url)
        setAvatarFile(null)
        router.refresh() // H1: обновить аватар в навбаре (серверный layout)
      } else {
        setError(result.error || "Ошибка при обновлении аватарки")
      }
    } catch {
      setError("Произошла ошибка при обновлении аватарки")
    } finally {
      setAvatarSubmitting(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwSubmitting(true)
    setSuccess("")
    setError("")

    try {
      if (!currentPassword.trim()) {
        setError("Введите текущий пароль")
        setPwSubmitting(false)
        return
      }

      if (newPassword !== confirmPassword) {
        setError("Новые пароли не совпадают")
        setPwSubmitting(false)
        return
      }

      if (newPassword.length < 6) {
        setError("Пароль должен содержать минимум 6 символов")
        setPwSubmitting(false)
        return
      }

      const response = await fetch(`/api/artists`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: artist.id,
          password: newPassword,
          currentPassword,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSuccess("Пароль успешно обновлён")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        setError(result.error || "Ошибка при обновлении пароля")
      }
    } catch {
      setError("Произошла ошибка при обновлении пароля")
    } finally {
      setPwSubmitting(false)
    }
  }

  // C-17: поля пароля переехали на ui/input; собственных классов у формы больше
  // нет — высота и фокус приходят из компонента.
  const inputClass = "h-12 rounded-xl bg-white/5"

  return (
    <>
      <div className="space-y-8">
      <PageHeader
        title="НАСТРОЙКИ"
        subtitle="Профиль, аватар и смена пароля."
      />

      <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 mb-8">
        {/* F-59: у трёх секций были зелёная, синяя и фиолетовая полосы без логики. */}
        <SectionHeader className="mb-6" title="Профиль" />
        <dl className="space-y-5">
          <div>
            <dt className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Имя артиста</dt>
            <dd className="text-lg text-white mt-1">{artist.name}</dd>
            <p className="text-xs text-gray-600 mt-1">Имя может изменить только администратор</p>
          </div>
          <div>
            <dt className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Почта</dt>
            <dd className="text-lg text-white mt-1">{artist.email || "Не указан"}</dd>
            <p className="text-xs text-gray-600 mt-1">Email может изменить только администратор</p>
          </div>
          <div>
            <dt className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Логин</dt>
            <dd className="text-lg text-white font-mono mt-1">{artist.username}</dd>
          </div>
        </dl>
      </div>

      <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 mb-8">
        <SectionHeader className="mb-6" title="Аватар" />
        <form onSubmit={handleAvatarSubmit} className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="relative w-28 h-28 rounded-full border-2 border-primary/40 overflow-hidden flex-shrink-0 mx-auto sm:mx-0">
              {avatarPreview ? (
                avatarPreview.startsWith("data:") ? (
                  <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Image src={avatarPreview} alt="" fill className="object-cover" sizes="112px" />
                )
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white font-display">{artist.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="flex-1 w-full min-w-0">
              {/*
                C-17/F-12: сырой `<input type="file">` за самописным label заменён
                на FileInput — сам input остаётся в DOM и фокусируем, а зона
                выбора это кнопка кита в прежней пунктирной раскладке.
              */}
              <FileInput
                id="avatar"
                accept="image/*"
                onChange={handleAvatarChange}
                showFileName={false}
                icon={null}
                buttonVariant="ghost"
                containerClassName="w-full"
                buttonClassName="h-auto w-full flex-col gap-1 rounded-xl border-2 border-dashed border-white/10 p-6 text-center font-normal hover:border-primary/30 hover:bg-transparent"
                buttonLabel={
                  <>
                    <span className="material-symbols-outlined mb-1 block text-4xl text-gray-500" aria-hidden>
                      upload
                    </span>
                    <span className="text-sm text-gray-300">Нажмите чтобы выбрать изображение</span>
                    <span className="text-xs text-gray-600">PNG, JPG до 5MB</span>
                  </>
                }
              />
            </div>
          </div>
          {/* C-02: обе submit-кнопки формы — один вариант кита с единым disabled (F-28). */}
          <Button
            type="submit"
            variant="cta"
            disabled={avatarSubmitting || !avatarFile}
            className="h-12 w-full rounded-xl"
          >
            {avatarSubmitting ? "Сохранение…" : "Сохранить аватарку"}
          </Button>
        </form>
      </div>

      <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 mb-8">
        <SectionHeader className="mb-6" title="Смена пароля" />
        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
          <FormField
            label="Текущий пароль"
            htmlFor="currentPassword"
          >
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
              spellCheck={false}
              required
            />
          </FormField>
          <FormField
            label="Новый пароль"
            htmlFor="newPassword"
            hint="Минимум 6 символов"
          >
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
              spellCheck={false}
              required
              minLength={6}
            />
          </FormField>
          <FormField
            label="Подтвердите новый пароль"
            htmlFor="confirmPassword"
          >
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
              spellCheck={false}
              required
            />
          </FormField>
          <Button type="submit" variant="cta" disabled={pwSubmitting} className="h-12 w-full rounded-xl">
            {pwSubmitting ? "Обновление…" : "Обновить пароль"}
          </Button>
        </form>
      </div>

      {success && (
        <Banner variant="success" className="mb-4">
          {success}
        </Banner>
      )}
      {error && (
        <Banner variant="danger" className="mb-4">
          {error}
        </Banner>
      )}

      <DashboardFooter role="artist" />
      </div>
    </>
  )
}
