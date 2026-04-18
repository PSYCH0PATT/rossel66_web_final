import { getPyrusApiKey, getPyrusLoginEmail } from "./pyrus-env";

export { getPyrusLoginEmail, getPyrusApiKey, assertPyrusConfigured } from "./pyrus-env";

export async function getPyrusAccessToken(apiKey?: string): Promise<string | null> {
  const key = apiKey ?? getPyrusApiKey();
  const login = getPyrusLoginEmail();
  if (!key || !login) {
    console.error("Pyrus: не заданы PYRUS_LOGIN_EMAIL/PYRUS_LOGIN и PYRUS_API_KEY/PYRUS_SECRET_KEY");
    return null;
  }
  try {
    const response = await fetch("https://api.pyrus.com/v4/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, security_key: key }),
    });
    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error("Pyrus auth error:", error);
    return null;
  }
}

export async function uploadFileToPyrus(
  file: File,
  accessToken: string
): Promise<{ guid: string } | null> {
  try {
    const pyrusFileFormData = new FormData();
    pyrusFileFormData.append("file", file);

    const fileResponse = await fetch("https://api.pyrus.com/v4/files/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: pyrusFileFormData,
    });

    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();
      console.error(
        `Pyrus file upload HTTP error for ${file.name}: ${fileResponse.status} ${fileResponse.statusText}`,
        errorText
      );
      return null;
    }

    const responseText = await fileResponse.text();
    try {
      const fileResult = JSON.parse(responseText);
      if (fileResult && fileResult.guid) {
        return { guid: fileResult.guid };
      }
      console.error(
        `Pyrus file upload error for ${file.name} (parsed, but no guid):`,
        fileResult
      );
      return null;
    } catch (e) {
      console.error(
        `Pyrus file upload JSON parse error for ${file.name}. Response text:`,
        responseText,
        e
      );
      return null;
    }
  } catch (error) {
    console.error(`Exception during Pyrus file upload for ${file.name}:`, error);
    return null;
  }
}

export const fieldIdToName: Record<number, string> = {
  2: "Никнеймы артистов",
  5: "Название релиза",
  11: "Тип релиза",
  12: "Дата релиза",
  13: "Обложка",
  15: "Жанр",
  16: "Другой жанр",
  17: "Трек-лист",
  19: "Название трека",
  20: "Основные исполнители",
  25: "Аудиофайл",
  67: "Начало предпрослушивания",
  27: "Автор музыки",
  28: "Автор слов",
  29: "Язык вокала",
  30: "Фокус-трек",
  38: "Текст трека",
  41: "Нужен ли видео-сниппет",
  42: "Подать на промо",
  44: "Информация об артисте",
  45: "Информация о релизе",
  46: "Поддержка релиза",
  47: "Ссылка на фото артиста",
  59: "Указать соцсети",
  60: "ВКонтакте",
  61: "TikTok",
  62: "YouTube",
  63: "Instagram",
  64: "SoundCloud",
  32: "Указать ссылки на стриминги",
  33: "Spotify",
  34: "Apple Music",
  35: "VK Музыка",
  36: "Яндекс Музыка",
  40: "Дополнительные комментарии",
  66: "Explicit контент",
};

export function getPyrusErrorMessage(errorCode: string, originalError: string): string {
  switch (errorCode) {
    case "required_field_missing": {
      const fieldMatch = originalError.match(/field[^\d]*(\d+)/i);
      const fieldId = fieldMatch ? parseInt(fieldMatch[1]) : null;
      const fieldName =
        fieldId && fieldIdToName[fieldId] ? fieldIdToName[fieldId] : "одно из полей";
      return `Не заполнено обязательное поле: ${fieldName}`;
    }
    case "invalid_value_format": {
      const formatMatch = originalError.match(/field[^\d]*(\d+)/i);
      const formatFieldId = formatMatch ? parseInt(formatMatch[1]) : null;
      const formatFieldName =
        formatFieldId && fieldIdToName[formatFieldId]
          ? fieldIdToName[formatFieldId]
          : "одном из полей";
      return `Неверный формат данных в поле: ${formatFieldName}. Проверьте правильность заполнения.`;
    }
    case "required_table_field_missing": {
      const tableMatch =
        originalError.match(/table.*field[^\d]*(\d+)/i) || originalError.match(/line\s+(\d+)/i);
      const lineNumber = tableMatch ? tableMatch[1] : "одной из строк";
      return `В трек-листе (строка ${lineNumber}) не заполнено обязательное поле. Проверьте все поля треков.`;
    }
    case "invalid_field_id":
      return `Ошибка конфигурации формы. Обратитесь к администратору.`;
    case "deleted_field":
      return `Поле было удалено из формы. Обновите страницу и попробуйте снова.`;
    case "too_large_request_length":
      return `Размер загружаемых файлов превышает допустимый лимит. Уменьшите размер файлов и попробуйте снова.`;
    case "invalid_credentials":
    case "revoked_token":
    case "expired_token":
    case "invalid_token":
      return `Ошибка авторизации. Обратитесь к администратору.`;
    case "access_denied_form":
      return `Нет доступа к форме. Обратитесь к администратору.`;
    case "too_many_requests":
      return `Превышен лимит запросов. Пожалуйста, подождите несколько минут и попробуйте снова.`;
    case "server_error":
      return `Внутренняя ошибка сервера. Попробуйте позже или обратитесь в поддержку.`;
    case "max_text_length_exceeded": {
      const lengthMatch = originalError.match(/field[^\d]*(\d+)/i);
      const lengthFieldId = lengthMatch ? parseInt(lengthMatch[1]) : null;
      const lengthFieldName =
        lengthFieldId && fieldIdToName[lengthFieldId]
          ? fieldIdToName[lengthFieldId]
          : "одно из текстовых полей";
      return `Превышена максимальная длина текста в поле: ${lengthFieldName}`;
    }
    case "unsupported_attachment_format":
      return `Неподдерживаемый формат файла. Проверьте требования к файлам.`;
    case "empty_file":
      return `Один из загружаемых файлов пуст. Проверьте все файлы.`;
    case "validation_error":
      return `Ошибка валидации данных: ${originalError}`;
    default:
      if (originalError.toLowerCase().includes("required")) {
        return `Не заполнены обязательные поля. Проверьте форму.`;
      }
      if (
        originalError.toLowerCase().includes("format") ||
        originalError.toLowerCase().includes("invalid")
      ) {
        return `Неверный формат данных в одном из полей. Проверьте правильность заполнения.`;
      }
      return `Ошибка при обработке данных: ${originalError}`;
  }
}
