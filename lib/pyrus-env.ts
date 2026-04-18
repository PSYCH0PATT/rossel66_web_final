/**
 * Pyrus API credentials — только из окружения (никаких литералов в репозитории).
 * PYRUS_LOGIN_EMAIL или PYRUS_LOGIN; PYRUS_API_KEY или PYRUS_SECRET_KEY.
 */

export function getPyrusLoginEmail(): string {
  return (
    process.env.PYRUS_LOGIN_EMAIL?.trim() ||
    process.env.PYRUS_LOGIN?.trim() ||
    ''
  )
}

export function getPyrusApiKey(): string {
  return (
    process.env.PYRUS_API_KEY?.trim() ||
    process.env.PYRUS_SECRET_KEY?.trim() ||
    ''
  )
}

export function assertPyrusConfigured(): { login: string; apiKey: string } {
  const login = getPyrusLoginEmail()
  const apiKey = getPyrusApiKey()
  if (!login || !apiKey) {
    throw new Error(
      'Pyrus: задайте PYRUS_LOGIN_EMAIL (или PYRUS_LOGIN) и PYRUS_API_KEY (или PYRUS_SECRET_KEY) в окружении'
    )
  }
  return { login, apiKey }
}
