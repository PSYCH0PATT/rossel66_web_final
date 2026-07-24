"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

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

  const inputClass =
    "w-full bg-white/5 border border-white/10 text-white rounded-xl h-12 px-4 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"

  return (
    <>
      <div className="p-0 md:p-0 max-w-full pb-6 md:pb-0">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
          <Link
            href={`/dashboard/artist/${username}/dashboard`}
            className="hover:text-[#10b981] cursor-pointer transition-colors"
          >
            ДАШБОРД
          </Link>
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
            chevron_right
          </span>
          <span className="text-white">Настройки</span>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">НАСТРОЙКИ</h1>
            <p className="text-sm text-gray-400 font-light max-w-md">
              Профиль, аватар и смена пароля.
            </p>
          </div>
        </div>
      </div>

      <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 mb-8">
        <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-6">
          <span className="w-1.5 h-6 bg-primary rounded-full" />
          Профиль
        </h2>
        <dl className="space-y-5">
          <div>
            <dt className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Имя артиста</dt>
            <dd className="text-lg text-white mt-1">{artist.name}</dd>
            <p className="text-xs text-gray-600 mt-1">Имя может изменить только администратор</p>
          </div>
          <div>
            <dt className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Email</dt>
            <dd className="text-lg text-white mt-1">{artist.email || "Не указан"}</dd>
            <p className="text-xs text-gray-600 mt-1">Email может изменить только администратор</p>
          </div>
          <div>
            <dt className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Username</dt>
            <dd className="text-lg text-white font-mono mt-1">{artist.username}</dd>
          </div>
        </dl>
      </div>

      <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 mb-8">
        <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-6">
          <span className="w-1.5 h-6 bg-accent-azure rounded-full" />
          Аватар
        </h2>
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
              <label htmlFor="avatar" className="cursor-pointer block">
                <div className="border-2 border-dashed border-white/10 rounded-xl p-6 hover:border-primary/30 transition-colors text-center">
                  <span className="material-symbols-outlined text-4xl text-gray-500 mb-2 block">upload</span>
                  <p className="text-sm text-gray-300">Нажмите чтобы выбрать изображение</p>
                  <p className="text-xs text-gray-600 mt-1">PNG, JPG до 5MB</p>
                </div>
              </label>
              <input id="avatar" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </div>
          </div>
          <button
            type="submit"
            disabled={avatarSubmitting || !avatarFile}
            className="w-full bg-[#10b981] hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-xl h-12 text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {avatarSubmitting ? "Сохранение…" : "Сохранить аватарку"}
          </button>
        </form>
      </div>

      <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 mb-8">
        <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-6">
          <span className="w-1.5 h-6 bg-purple-400 rounded-full" />
          Смена пароля
        </h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
          <div className="space-y-2">
            <label htmlFor="currentPassword" className="text-[10px] font-mono uppercase tracking-widest text-gray-500 block">
              Текущий пароль
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
              spellCheck={false}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="newPassword" className="text-[10px] font-mono uppercase tracking-widest text-gray-500 block">
              Новый пароль
            </label>
            <input
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
            <p className="text-xs text-gray-600">Минимум 6 символов</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-[10px] font-mono uppercase tracking-widest text-gray-500 block">
              Подтвердите новый пароль
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
              spellCheck={false}
              required
            />
          </div>
          <button
            type="submit"
            disabled={pwSubmitting}
            className="w-full bg-[#10b981] hover:bg-emerald-400 disabled:opacity-50 text-black font-bold rounded-xl h-12 text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {pwSubmitting ? "Обновление…" : "Обновить пароль"}
          </button>
        </form>
      </div>

      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 mb-4 flex items-start gap-2"
        >
          <span className="material-symbols-outlined text-emerald-400 flex-shrink-0">check_circle</span>
          {success}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 mb-4 flex items-start gap-2"
        >
          <span className="material-symbols-outlined text-red-400 flex-shrink-0">error</span>
          {error}
        </div>
      )}

      <div className="mt-8 flex justify-between items-center text-sm border-t border-white/5 pt-6">
        <div className="text-gray-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-primary inline-block mr-2 animate-pulse" />
          System Operational
        </div>
        <div className="text-gray-400 font-mono text-xs">ROSSEL LABEL ENGINE V2.4</div>
      </div>
      </div>
    </>
  )
}
