import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Транслитерация кириллицы в латиницу для логина (ник → neroza) */
const RU_TO_LAT: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z',
  'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
  'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}

/**
 * Генерирует логин (username) из ника артиста: транслитерация + нормализация.
 * Пример: "не роза" → "neroza", "ALSSY" → "alssy"
 */
export function nicknameToUsername(nickname: string): string {
  if (!nickname || typeof nickname !== 'string') return 'artist'
  let s = nickname.trim().toLowerCase()
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (RU_TO_LAT[c]) {
      out += RU_TO_LAT[c]
    } else if (/[a-z0-9]/.test(c)) {
      out += c
    } else if (c === ' ' || c === '-' || c === '_') {
      // пробелы и дефисы просто убираем (сливаем слова)
      continue
    }
    // остальные символы (знаки, не-кириллица) пропускаем
  }
  return out || 'artist'
}
