/**
 * Legacy Pyrus multipart form routes — deprecated after Buildin session API cutover.
 */

export const LEGACY_PYRUS_FORM_GONE_MESSAGE =
  "Этот эндпоинт устарел. Загружайте файлы через сессионный API: POST /api/forms/sessions"

export const LEGACY_PYRUS_FILE_UPLOAD_GONE_MESSAGE =
  "Прямая загрузка в Pyrus отключена. Используйте presign через сессию: POST /api/forms/sessions/{id}/files/presign"

export const legacyPyrusFormGoneBody = {
  message: LEGACY_PYRUS_FORM_GONE_MESSAGE,
  sessionApi: "/api/forms/sessions",
} as const
