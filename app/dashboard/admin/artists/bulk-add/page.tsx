"use client"

import { useState } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { User, Check, AlertCircle, Loader2, ArrowLeft, Edit3, X, Plus } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function BulkAddArtistsPage() {
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [addedArtists, setAddedArtists] = useState<Array<{ name: string; password: string }>>([])
  const [isEditing, setIsEditing] = useState(false)
  const [artistNames, setArtistNames] = useState([
    "передоз",
    "ЭНТЕNДАНS",
    "ASTRODYA",
    "EnellySayk",
    "Etxrnxtx",
    "Jelato",
    "LXNOWER",
    "Makishima",
    "Matcukito Kioto",
    "MEELBRN",
    "MENDXZA",
    "night moral",
    "Nnaia",
    "PLVT",
    "Roudie J.",
    "SLAVKESH",
    "Sour Diesel",
    "Takeda",
    "TXYK",
    "W.1ce3",
    "WIDE PIE",
    "wvlaik",
  ])
  const [editText, setEditText] = useState("")

  // Функция для генерации случайного 4-значного числа
  const generateRandomDigits = () => {
    return Math.floor(1000 + Math.random() * 9000).toString()
  }

  // Функции для редактирования списка
  const startEditing = () => {
    setEditText(artistNames.join('\n'))
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditText("")
  }

  const saveEditing = () => {
    const newNames = editText
      .split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0)
    
    setArtistNames(newNames)
    setIsEditing(false)
    setEditText("")
  }

  const removeArtist = (index: number) => {
    const newNames = artistNames.filter((_, i) => i !== index)
    setArtistNames(newNames)
  }

  const addNewArtist = () => {
    const newName = prompt("Введите имя артиста:")
    if (newName && newName.trim()) {
      setArtistNames([...artistNames, newName.trim()])
    }
  }

  // Функция для добавления всех артистов
  const addAllArtists = async () => {
    setIsAdding(true)
    setError("")
    setAddedArtists([])

    try {
      // Получаем существующих пользователей через API
      const usersResponse = await fetch('/api/users')
      const usersData = await usersResponse.json()
      const existingUsers = usersData.success ? usersData.users : []

      const addedArtistsInfo = []
      let successCount = 0
      let errorCount = 0

      for (const name of artistNames) {
        try {
          // Генерируем пароль (никнейм + 4 случайных цифры)
          const randomDigits = generateRandomDigits()
          const password = `${name.toLowerCase().replace(/[^a-zA-Z0-9]/g, "")}${randomDigits}`

          // Создаем username (используем никнейм, заменяя пробелы и специальные символы)
          const username = name.toLowerCase().replace(/[^a-zA-Z0-9]/g, "")

          // Проверяем, существует ли уже пользователь с таким именем
          const existingUser = existingUsers.some(
            (user: any) => user.username.toLowerCase() === username.toLowerCase()
          )

          if (!existingUser) {
            // Создаем артиста через API
            const response = await fetch('/api/artists', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                username: username,
                password: password,
                name: name,
                email: undefined,
                avatarUrl: undefined,
                vkMusicUrl: undefined,
                yandexMusicUrl: undefined,
                spotifyUrl: undefined,
              }),
            })

            const result = await response.json()

            if (result.success) {
              addedArtistsInfo.push({ name, password })
              successCount++
              console.log(`✅ Артист ${name} успешно создан`)
            } else {
              console.error(`❌ Ошибка создания артиста ${name}:`, result.error)
              errorCount++
            }
          } else {
            console.log(`⚠️ Артист ${name} уже существует, пропускаем`)
          }

          // Небольшая задержка между запросами
          await new Promise((resolve) => setTimeout(resolve, 100))
        } catch (artistError) {
          console.error(`❌ Ошибка при создании артиста ${name}:`, artistError)
          errorCount++
        }
      }

      // Обновляем состояние
      setAddedArtists(addedArtistsInfo)
      
      if (successCount > 0) {
        setSuccess(true)
        if (errorCount > 0) {
          setError(`Создано ${successCount} артистов, ${errorCount} ошибок`)
        }
      } else if (errorCount > 0) {
        setError(`Не удалось создать ни одного артиста. Ошибок: ${errorCount}`)
      } else {
        setError("Все артисты уже существуют в системе")
      }

    } catch (err) {
      console.error('Общая ошибка при добавлении артистов:', err)
      setError("Произошла ошибка при добавлении артистов")
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href="/admin/artists"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Назад к списку артистов</span>
            </Link>
            <h1 className="text-2xl font-bold text-white">Массовое добавление артистов</h1>
          </div>
          
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
            <User className="h-6 w-6 text-white" />
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-white">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-emerald-500/20 border-emerald-500/50 text-white">
            <Check className="h-4 w-4 text-emerald-400" />
            <AlertDescription>Артисты успешно добавлены!</AlertDescription>
          </Alert>
        )}

        <Card className="bg-transparent border-slate-600/40 text-white rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-400" />
              Добавление списка артистов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">Будут добавлены следующие артисты (всего {artistNames.length}):</p>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addNewArtist}
                        className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Добавить
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={startEditing}
                        className="border-slate-500/50 text-slate-300 hover:bg-slate-500/20"
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        Редактировать
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="Введите имена артистов, каждое с новой строки..."
                    className="min-h-60 bg-transparent border-slate-600/30 text-white resize-none"
                    rows={15}
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelEditing}
                      className="border-slate-500/50 text-slate-300 hover:bg-slate-500/20"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Отмена
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveEditing}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Сохранить
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto p-4 bg-transparent border border-slate-600/20 rounded-xl hover:border-slate-500/40 transition-colors">
                  <ul className="space-y-1">
                    {artistNames.map((name, index) => (
                      <li key={index} className="flex items-center justify-between text-sm group">
                        <span>{name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeArtist(index)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-4 bg-transparent border border-slate-600/20 rounded-xl hover:border-slate-500/40 transition-colors">
                <h3 className="text-sm font-medium mb-2">Примечания:</h3>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Для каждого артиста будет создан пароль в формате "никнейм + 4 случайных цифры"</li>
                  <li>Логин будет создан на основе никнейма (без пробелов и специальных символов)</li>
                  <li>Профили будут созданы без релизов и других данных</li>
                </ul>
              </div>

              {addedArtists.length > 0 && (
                <div className="p-4 bg-emerald/10 border border-emerald/30 rounded-xl">
                  <h3 className="text-sm font-medium mb-2 text-emerald">Созданные учетные данные:</h3>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-gray-700">
                          <th className="pb-2">Артист</th>
                          <th className="pb-2">Пароль</th>
                        </tr>
                      </thead>
                      <tbody>
                        {addedArtists.map((artist, index) => (
                          <tr key={index} className="border-b border-gray-800">
                            <td className="py-2">{artist.name}</td>
                            <td className="py-2 font-mono">{artist.password}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/admin/artists")}
                  className="border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors"
                  disabled={isAdding}
                >
                  Назад к списку артистов
                </Button>
                <Button
                  onClick={addAllArtists}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-transparent hover:border-emerald-300 transition-all duration-200"
                  disabled={isAdding}
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Добавление...
                    </>
                  ) : (
                    "Добавить всех артистов"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
