import bcrypt from "bcryptjs"

/**
 * J1 (решение владельца): пароли хранятся ОТКРЫТЫМ ТЕКСТОМ, чтобы админ мог
 * заходить в профили артистов.
 *
 * Важно: старые пароли уже захешированы bcrypt'ом и расшифровать их нельзя.
 * Поэтому сверка обязана поддерживать оба варианта, иначе все существующие
 * пользователи с хешем окажутся заблокированы. Хеш становится читаемым только
 * после того, как админ задаст пароль заново.
 */

/** Пароль хранится в виде bcrypt-хеша (его нельзя показать админу). */
export function isHashedPassword(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith("$2")
}

/** Сверяет введённый пароль с сохранённым (открытый текст или legacy-bcrypt). */
export async function verifyPassword(
  input: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false
  if (isHashedPassword(stored)) {
    return bcrypt.compare(input, stored)
  }
  return input === stored
}

/**
 * Значение пароля для показа админу. Для legacy-хеша вернёт null —
 * показывать нечего, нужен сброс.
 */
export function readablePassword(stored: string | null | undefined): string | null {
  if (!stored || isHashedPassword(stored)) return null
  return stored
}
