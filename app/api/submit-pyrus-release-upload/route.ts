import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// import { TEST_PYRUS_API_KEY } from '../submit-pyrus-catalog-upload/route'; // Удаляем этот импорт

const PYRUS_FORM_ID_RELEASE_UPLOAD = 1534238;
const PYRUS_LOGIN_EMAIL = "rossel66.music@gmail.com";
const PYRUS_API_KEY = "HxiuebPcNiPfJLM7wGDHI~8BgKzZbZ3KqhCJhr52f8QvLhdiHGI4dGNLYxCGXB-beBsOnh7yvTS6M8z6V2PnwNnZ6DX7DQ4w"; // Прямое определение ключа

// --- Interfaces (should match client-side state) ---
interface TrackReleaseData {
  id: string;
  trackName: string;
  mainArtists: string;
  previewStart: string;
  musicAuthor: string;
  wordsAuthor: string;
  language: string; // Pyrus choice_id
  explicit: string; // Pyrus choice_id Yes/No
  isFocusTrack: boolean;
  // audioFile and lyricsFile are handled as File objects from FormData
}

interface ReleaseUploadAPIData {
  email?: string;
  artistNicknames: string;
  releaseTitle: string;
  releaseType: string; // Pyrus choice_id
  releaseDate: string;
  genre: string; // Pyrus choice_id
  otherGenre?: string;
  tracks: TrackReleaseData[];
  videoSnippetNeeded: string; // Pyrus choice_id
  submitToPromo: string; // Pyrus choice_id
  artistInfo?: string;
  releaseInfo?: string;
  releaseSupport?: string;
  artistPhotosLink?: string;
  specifySocialMedia?: string; // Pyrus choice_id
  vkLink?: string;
  tiktokLink?: string;
  youtubeLink?: string;
  instagramLink?: string;
  soundcloudLink?: string;
  specifyStreamingLinks?: string; // Pyrus choice_id
  yandexMusicLink?: string;
  spotifyLink?: string;
  appleMusicLink?: string;
  vkMusicLink?: string;
  otherComments?: string;
  // coverArtFile is handled as File object from FormData
}

async function getPyrusAccessToken(apiKey: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.pyrus.com/v4/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: PYRUS_LOGIN_EMAIL, security_key: apiKey }),
    });
    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error("Pyrus auth error:", error);
    return null;
  }
}

// Field ID to human-readable name mapping for better error messages
const fieldIdToName: Record<number, string> = {
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
  66: "Explicit контент"
};

function getPyrusErrorMessage(errorCode: string, originalError: string): string {
  switch (errorCode) {
    case 'required_field_missing':
      // Extract field info from error message if possible
      const fieldMatch = originalError.match(/field[^\d]*(\d+)/i);
      const fieldId = fieldMatch ? parseInt(fieldMatch[1]) : null;
      const fieldName = fieldId && fieldIdToName[fieldId] ? fieldIdToName[fieldId] : "одно из полей";
      return `Не заполнено обязательное поле: ${fieldName}`;
      
    case 'invalid_value_format':
      // Try to extract field info from error message
      const formatMatch = originalError.match(/field[^\d]*(\d+)/i);
      const formatFieldId = formatMatch ? parseInt(formatMatch[1]) : null;
      const formatFieldName = formatFieldId && fieldIdToName[formatFieldId] ? fieldIdToName[formatFieldId] : "одном из полей";
      return `Неверный формат данных в поле: ${formatFieldName}. Проверьте правильность заполнения.`;
      
    case 'required_table_field_missing':
      // Extract table field info
      const tableMatch = originalError.match(/table.*field[^\d]*(\d+)/i) || originalError.match(/line\s+(\d+)/i);
      const lineNumber = tableMatch ? tableMatch[1] : "одной из строк";
      return `В трек-листе (строка ${lineNumber}) не заполнено обязательное поле. Проверьте все поля треков.`;
      
    case 'invalid_field_id':
      return `Ошибка конфигурации формы. Обратитесь к администратору.`;
      
    case 'deleted_field':
      return `Поле было удалено из формы. Обновите страницу и попробуйте снова.`;
      
    case 'too_large_request_length':
      return `Размер загружаемых файлов превышает допустимый лимит. Уменьшите размер файлов и попробуйте снова.`;
      
    case 'invalid_credentials':
    case 'revoked_token':
    case 'expired_token':
    case 'invalid_token':
      return `Ошибка авторизации. Обратитесь к администратору.`;
      
    case 'access_denied_form':
      return `Нет доступа к форме. Обратитесь к администратору.`;
      
    case 'too_many_requests':
      return `Превышен лимит запросов. Пожалуйста, подождите несколько минут и попробуйте снова.`;
      
    case 'server_error':
      return `Внутренняя ошибка сервера. Попробуйте позже или обратитесь в поддержку.`;
      
    case 'max_text_length_exceeded':
      const lengthMatch = originalError.match(/field[^\d]*(\d+)/i);
      const lengthFieldId = lengthMatch ? parseInt(lengthMatch[1]) : null;
      const lengthFieldName = lengthFieldId && fieldIdToName[lengthFieldId] ? fieldIdToName[lengthFieldId] : "одно из текстовых полей";
      return `Превышена максимальная длина текста в поле: ${lengthFieldName}`;
      
    case 'unsupported_attachment_format':
      return `Неподдерживаемый формат файла. Проверьте требования к файлам.`;
      
    case 'empty_file':
      return `Один из загружаемых файлов пуст. Проверьте все файлы.`;
      
    case 'validation_error':
      return `Ошибка валидации данных: ${originalError}`;
      
    default:
      // For unknown errors, try to make the original message more user-friendly
      if (originalError.toLowerCase().includes('required')) {
        return `Не заполнены обязательные поля. Проверьте форму.`;
      }
      if (originalError.toLowerCase().includes('format') || originalError.toLowerCase().includes('invalid')) {
        return `Неверный формат данных в одном из полей. Проверьте правильность заполнения.`;
      }
      return `Ошибка при обработке данных: ${originalError}`;
  }
}

async function uploadFileToPyrus(file: File, accessToken: string): Promise<{ guid: string } | null> {
  try {
    const pyrusFileFormData = new FormData();
    pyrusFileFormData.append('file', file);

    const fileResponse = await fetch("https://api.pyrus.com/v4/files/upload", {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}` },
      body: pyrusFileFormData,
    });

    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();
      console.error(`Pyrus file upload HTTP error for ${file.name}: ${fileResponse.status} ${fileResponse.statusText}`, errorText);
      return null;
    }

    const responseText = await fileResponse.text();
    try {
      const fileResult = JSON.parse(responseText);
      if (fileResult && fileResult.guid) {
        return { guid: fileResult.guid };
      } else {
        console.error(`Pyrus file upload error for ${file.name} (parsed, but no guid):`, fileResult);
        return null;
      }
    } catch (e) {
      console.error(`Pyrus file upload JSON parse error for ${file.name}. Response text:`, responseText, e);
      return null;
    }

  } catch (error) {
    console.error(`Exception during Pyrus file upload for ${file.name}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const pyrusApiKey = PYRUS_API_KEY; // Используем локально определенный ключ

  if (!pyrusApiKey) {
    return NextResponse.json({ message: "Ошибка сервера: Ключ API Pyrus не настроен." }, { status: 500 });
  }

  const accessToken = await getPyrusAccessToken(pyrusApiKey);
  if (!accessToken) {
    return NextResponse.json({ message: "Ошибка аутентификации Pyrus." }, { status: 500 });
  }

  try {
    const formDataFromRequest = await request.formData();
    const formJsonString = formDataFromRequest.get('form_data_json') as string | null;
    if (!formJsonString) {
      return NextResponse.json({ message: "Отсутствуют основные данные формы." }, { status: 400 });
    }
    const clientData: ReleaseUploadAPIData = JSON.parse(formJsonString);

    const pyrusFields: any[] = [];

    // --- Basic Info --- Field IDs from Pyrus Form 1534238
    if (clientData.email) pyrusFields.push({ id: 37, value: clientData.email });
    
    pyrusFields.push({ id: 2, value: clientData.artistNicknames });
    pyrusFields.push({ id: 5, value: clientData.releaseTitle });
    if (clientData.releaseType && clientData.releaseType !== "0") pyrusFields.push({ id: 11, value: { choice_id: parseInt(clientData.releaseType) } });
    pyrusFields.push({ id: 12, value: clientData.releaseDate });
    
    const coverArtFile = formDataFromRequest.get('coverArtFile') as File | null;
    if (coverArtFile) {
      const uploadedCover = await uploadFileToPyrus(coverArtFile, accessToken);
      if (uploadedCover && uploadedCover.guid) pyrusFields.push({ id: 13, value: [{ guid: uploadedCover.guid }] });
    }
    
    if (clientData.genre && clientData.genre !== "0") pyrusFields.push({ id: 15, value: { choice_id: parseInt(clientData.genre) } });
    if (clientData.genre === "7" && clientData.otherGenre) {
      pyrusFields.push({ id: 16, value: clientData.otherGenre });
    }

    // --- Tracks Table (Field ID 17) ---
    const tracksTableRows: any[] = [];
    for (let i = 0; i < clientData.tracks.length; i++) {
      const track = clientData.tracks[i];
      const trackCells: any[] = [];
      
      // Генерируем числовой row_id на основе индекса (i + 1)
      const numericRowId = i + 1; 

      const audioFile = formDataFromRequest.get(`track_${i}_audioFile`) as File | null;
      if (audioFile) {
        const uploadedAudio = await uploadFileToPyrus(audioFile, accessToken);
        if (uploadedAudio && uploadedAudio.guid) trackCells.push({ id: 25, value: [uploadedAudio.guid] });
      }
      trackCells.push({ id: 19, value: track.trackName });
      trackCells.push({ id: 20, value: track.mainArtists });
      trackCells.push({ id: 67, value: track.previewStart });
      trackCells.push({ id: 27, value: track.musicAuthor });
      trackCells.push({ id: 28, value: track.wordsAuthor });
      if (track.language && track.language !== "0") trackCells.push({ id: 29, value: { choice_id: parseInt(track.language) } });
      if (track.explicit && track.explicit !== "0") trackCells.push({ id: 66, value: { choice_id: parseInt(track.explicit) } });
      if (track.isFocusTrack) trackCells.push({ id: 30, value: "checked" });
      
      const lyricsFile = formDataFromRequest.get(`track_${i}_lyricsFile`) as File | null;
      if (lyricsFile) {
        const uploadedLyrics = await uploadFileToPyrus(lyricsFile, accessToken);
        if (uploadedLyrics && uploadedLyrics.guid) trackCells.push({ id: 38, value: [uploadedLyrics.guid] });
      }
      tracksTableRows.push({ row_id: numericRowId, cells: trackCells }); // Используем числовой numericRowId
    }
    if (tracksTableRows.length > 0) {
      pyrusFields.push({ id: 17, value: tracksTableRows });
    }

    // --- Promo Block --- 
    if (clientData.videoSnippetNeeded && clientData.videoSnippetNeeded !== "0") pyrusFields.push({ id: 41, value: { choice_id: parseInt(clientData.videoSnippetNeeded) } });
    if (clientData.submitToPromo && clientData.submitToPromo !== "0") pyrusFields.push({ id: 42, value: { choice_id: parseInt(clientData.submitToPromo) } });

    if (clientData.submitToPromo === "1") {
      if (clientData.artistInfo) pyrusFields.push({ id: 44, value: clientData.artistInfo });
      if (clientData.releaseInfo) pyrusFields.push({ id: 45, value: clientData.releaseInfo });
      if (clientData.releaseSupport) pyrusFields.push({ id: 46, value: clientData.releaseSupport });
      if (clientData.artistPhotosLink) pyrusFields.push({ id: 47, value: clientData.artistPhotosLink });
      
      if (clientData.specifySocialMedia && clientData.specifySocialMedia !== "0") pyrusFields.push({ id: 59, value: { choice_id: parseInt(clientData.specifySocialMedia) } });
      if (clientData.specifySocialMedia === "1") {
        if (clientData.vkLink) pyrusFields.push({ id: 60, value: clientData.vkLink });
        if (clientData.tiktokLink) pyrusFields.push({ id: 61, value: clientData.tiktokLink });
        if (clientData.youtubeLink) pyrusFields.push({ id: 62, value: clientData.youtubeLink });
        if (clientData.instagramLink) pyrusFields.push({ id: 63, value: clientData.instagramLink });
        if (clientData.soundcloudLink) pyrusFields.push({ id: 64, value: clientData.soundcloudLink });
      }
    }

    // --- Streaming Links --- 
    if (clientData.specifyStreamingLinks && clientData.specifyStreamingLinks !== "0") pyrusFields.push({ id: 32, value: { choice_id: parseInt(clientData.specifyStreamingLinks) } });
    if (clientData.specifyStreamingLinks === "1") {
        if (clientData.yandexMusicLink) pyrusFields.push({ id: 36, value: clientData.yandexMusicLink });
        if (clientData.spotifyLink) pyrusFields.push({ id: 33, value: clientData.spotifyLink });
        if (clientData.appleMusicLink) pyrusFields.push({ id: 34, value: clientData.appleMusicLink });
        if (clientData.vkMusicLink) pyrusFields.push({ id: 35, value: clientData.vkMusicLink });
    }
    
    if (clientData.otherComments) pyrusFields.push({ id: 40, value: clientData.otherComments });

    // Формируем заголовок задачи
    let taskTitle = `Заявка на выгрузку релиза: ${clientData.releaseTitle || 'Без названия'} от ${clientData.artistNicknames || 'Неизвестный артист'}`;
    if (clientData.email) {
        taskTitle += ` (${clientData.email})`;
    }

    const pyrusTaskData = {
        form_id: PYRUS_FORM_ID_RELEASE_UPLOAD,
        fields: pyrusFields.filter(f => f.value !== null && f.value !== undefined && f.value !== '' && (Array.isArray(f.value) ? f.value.length > 0 : true)),
        text: taskTitle,
    };

    // console.log("Pyrus API Request Body (Release Upload):", JSON.stringify(pyrusTaskData, null, 2));

    const pyrusResponse = await fetch(
      "https://api.pyrus.com/v4/tasks",
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(pyrusTaskData),
      }
    );

    const responseData = await pyrusResponse.json();

    if (pyrusResponse.ok && responseData && responseData.task && responseData.task.id) {
        return NextResponse.json({
            message: "Форма успешно отправлена",
            taskId: responseData.task.id,
        });
    } else {
        console.error("Pyrus API error (creating release task):", responseData);
        
        // Detailed error handling based on Pyrus error codes
        if (responseData.error_code) {
          const errorMessage = getPyrusErrorMessage(responseData.error_code, responseData.error);
          return NextResponse.json(
            { message: errorMessage },
            { status: pyrusResponse.status || 400 }
          );
        }
        
        return NextResponse.json(
            { message: "Ошибка при отправке формы", details: responseData },
            { status: pyrusResponse.status || 500 }
        );
    }
  } catch (error) {
    console.error("Error processing Pyrus release submission:", error);
    let simplifiedErrorMessage = "Ошибка при отправке формы";
    let errorDetails: any = "Неизвестная ошибка сервера";
    if (error instanceof Error) {
      errorDetails = error.message;
    }
    return NextResponse.json({ message: simplifiedErrorMessage, details: errorDetails }, { status: 500 });
  }
} 