/**
 * Имя файла из заголовка Content-Disposition (RFC 6266). Сервер отдаёт оба
 * параметра — ASCII-фолбэк и UTF-8 версию, см. lib/content-disposition.ts.
 * Предпочитаем `filename*`, иначе кириллица приедет транслитом.
 */
export function fileNameFromContentDisposition(header: string | null): string | null {
  if (!header) return null

  const utf8 = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim())
    } catch {
      /* битая перекодировка — пробуем ASCII-вариант ниже */
    }
  }

  const ascii = header.match(/filename\s*=\s*"([^"]+)"/i) || header.match(/filename\s*=\s*([^;]+)/i)
  return ascii ? ascii[1].trim() : null
}

/**
 * Скачивание файла с API-роута.
 *
 * QA5: по коду было разбросано `window.open(url, "_blank")`. Блокировщик
 * всплывающих окон гасил такой вызов молча — кнопка выглядела нерабочей, — а
 * ошибку сервера пользователь получал в виде пустой вкладки с сырым JSON.
 * Здесь запрос идёт через fetch, файл отдаётся скрытой ссылкой, а неуспешный
 * ответ превращается в понятное сообщение.
 *
 * Возвращает true, если файл отдан браузеру.
 */
export async function downloadFileFromApi(
  url: string,
  fileName: string,
  onError: (message: string) => void = (message) => alert(message)
): Promise<boolean> {
  try {
    const res = await fetch(url)

    if (!res.ok) {
      let message = `Не удалось скачать файл (HTTP ${res.status})`
      try {
        const data = await res.json()
        if (data?.error) message = String(data.error)
      } catch {
        /* тело не JSON — оставляем сообщение по коду ответа */
      }
      onError(message)
      return false
    }

    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = objectUrl
    // У blob-ссылки Content-Disposition не действует, имя задаёт только атрибут
    // download. Поэтому имя, собранное сервером, забираем из заголовка сами.
    link.download = fileNameFromContentDisposition(res.headers.get("content-disposition")) || fileName
    link.style.display = "none"
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
    return true
  } catch {
    onError("Не удалось скачать файл. Проверьте соединение.")
    return false
  }
}

/** Имя ZIP-архива квартала. Год обязателен, иначе архивы разных лет неразличимы. */
export function quarterArchiveName(quarter: string, year?: number | string | null): string {
  return year ? `${quarter}_${year}_reports.zip` : `${quarter}_reports.zip`
}
