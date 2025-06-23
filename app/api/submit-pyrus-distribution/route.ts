import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { pushProgress } from '../progress-stream';

const PYRUS_FORM_ID_DISTRIBUTION = 2320361;
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

interface DistributionAPIData {
  contact: string; // Единственное отличие от основной формы - обязательное поле контактов
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
    const uploadId = formDataFromRequest.get('upload_id') as string | null;
    
    if (!formJsonString) {
      return NextResponse.json({ message: "Отсутствуют основные данные формы." }, { status: 400 });
    }
    const clientData: DistributionAPIData = JSON.parse(formJsonString);

    // ---- Calculate total file count for progress ---
    let totalFilesToUpload = 1; // cover art
    clientData.tracks.forEach(() => {
      totalFilesToUpload++; // audio file
      // We'll check for lyrics files during processing
    });
    
    // Count lyrics files
    for (let i = 0; i < clientData.tracks.length; i++) {
      const lyricsFile = formDataFromRequest.get(`track_${i}_lyricsFile`) as File | null;
      if (lyricsFile) totalFilesToUpload++;
    }
    
    let uploadedCount = 0;

    const pyrusFields: any[] = [];

    // --- Basic Info --- Field IDs from Pyrus Form 2320361
    pyrusFields.push({ id: 41, value: clientData.contact }); // Телеграм или ВК для связи - ЕДИНСТВЕННОЕ ОТЛИЧИЕ
    pyrusFields.push({ id: 2, value: clientData.artistNicknames });
    pyrusFields.push({ id: 3, value: clientData.releaseTitle });
    if (clientData.releaseType && clientData.releaseType !== "0") pyrusFields.push({ id: 4, value: { choice_id: parseInt(clientData.releaseType) } });
    pyrusFields.push({ id: 5, value: clientData.releaseDate });
    
    const coverArtFile = formDataFromRequest.get('coverArtFile') as File | null;
    if (coverArtFile) {
      const uploadedCover = await uploadFileToPyrus(coverArtFile, accessToken);
      if (uploadedCover && uploadedCover.guid) {
        pyrusFields.push({ id: 6, value: [{ guid: uploadedCover.guid }] });
        if (uploadId) {
          uploadedCount++; 
          pushProgress(uploadId, Math.round((uploadedCount / totalFilesToUpload) * 100));
        }
      }
    }
    
    if (clientData.genre && clientData.genre !== "0") pyrusFields.push({ id: 7, value: { choice_id: parseInt(clientData.genre) } });
    if (clientData.genre === "7" && clientData.otherGenre) {
      pyrusFields.push({ id: 8, value: clientData.otherGenre });
    }

    // --- Tracks Table (Field ID 9) ---
    const tracksTableRows: any[] = [];
    for (let i = 0; i < clientData.tracks.length; i++) {
      const track = clientData.tracks[i];
      const trackCells: any[] = [];
      
      // Генерируем числовой row_id на основе индекса (i + 1)
      const numericRowId = i + 1; 

      const audioFile = formDataFromRequest.get(`track_${i}_audioFile`) as File | null;
      if (audioFile) {
        const uploadedAudio = await uploadFileToPyrus(audioFile, accessToken);
        if (uploadedAudio && uploadedAudio.guid) {
          trackCells.push({ id: 10, value: [uploadedAudio.guid] });
          if (uploadId) {
            uploadedCount++; 
            pushProgress(uploadId, Math.round((uploadedCount / totalFilesToUpload) * 100));
          }
        }
      }
      trackCells.push({ id: 11, value: track.trackName });
      trackCells.push({ id: 12, value: track.mainArtists });
      trackCells.push({ id: 13, value: track.previewStart });
      trackCells.push({ id: 14, value: track.musicAuthor });
      trackCells.push({ id: 15, value: track.wordsAuthor });
      if (track.language && track.language !== "0") trackCells.push({ id: 16, value: { choice_id: parseInt(track.language) } });
      if (track.explicit && track.explicit !== "0") trackCells.push({ id: 17, value: { choice_id: parseInt(track.explicit) } });
      trackCells.push({ id: 18, value: track.isFocusTrack ? true : null });
      
      const lyricsFile = formDataFromRequest.get(`track_${i}_lyricsFile`) as File | null;
      if (lyricsFile) {
        const uploadedLyrics = await uploadFileToPyrus(lyricsFile, accessToken);
        if (uploadedLyrics && uploadedLyrics.guid) {
          trackCells.push({ id: 19, value: [uploadedLyrics.guid] });
          if (uploadId) {
            uploadedCount++; 
            pushProgress(uploadId, Math.round((uploadedCount / totalFilesToUpload) * 100));
          }
        }
      }
      tracksTableRows.push({ row_id: numericRowId, cells: trackCells }); // Используем числовой numericRowId
    }
    if (tracksTableRows.length > 0) {
      pyrusFields.push({ id: 9, value: tracksTableRows });
    }

    // --- Promo Block --- 
    if (clientData.videoSnippetNeeded && clientData.videoSnippetNeeded !== "0") pyrusFields.push({ id: 20, value: { choice_id: parseInt(clientData.videoSnippetNeeded) } });
    if (clientData.submitToPromo && clientData.submitToPromo !== "0") pyrusFields.push({ id: 22, value: { choice_id: parseInt(clientData.submitToPromo) } });

    if (clientData.submitToPromo === "1") {
      if (clientData.artistInfo) pyrusFields.push({ id: 24, value: clientData.artistInfo });
      if (clientData.releaseInfo) pyrusFields.push({ id: 25, value: clientData.releaseInfo });
      if (clientData.releaseSupport) pyrusFields.push({ id: 26, value: clientData.releaseSupport });
      if (clientData.artistPhotosLink) pyrusFields.push({ id: 27, value: clientData.artistPhotosLink });
      
      if (clientData.specifySocialMedia && clientData.specifySocialMedia !== "0") pyrusFields.push({ id: 28, value: { choice_id: parseInt(clientData.specifySocialMedia) } });
      if (clientData.specifySocialMedia === "1") {
        if (clientData.vkLink) pyrusFields.push({ id: 29, value: clientData.vkLink });
        if (clientData.tiktokLink) pyrusFields.push({ id: 30, value: clientData.tiktokLink });
        if (clientData.youtubeLink) pyrusFields.push({ id: 31, value: clientData.youtubeLink });
        if (clientData.instagramLink) pyrusFields.push({ id: 32, value: clientData.instagramLink });
        if (clientData.soundcloudLink) pyrusFields.push({ id: 33, value: clientData.soundcloudLink });
      }
    }

    // --- Streaming Links --- 
    if (clientData.specifyStreamingLinks && clientData.specifyStreamingLinks !== "0") pyrusFields.push({ id: 34, value: { choice_id: parseInt(clientData.specifyStreamingLinks) } });
    if (clientData.specifyStreamingLinks === "1") {
        if (clientData.yandexMusicLink) pyrusFields.push({ id: 35, value: clientData.yandexMusicLink });
        if (clientData.spotifyLink) pyrusFields.push({ id: 36, value: clientData.spotifyLink });
        if (clientData.appleMusicLink) pyrusFields.push({ id: 37, value: clientData.appleMusicLink });
        if (clientData.vkMusicLink) pyrusFields.push({ id: 38, value: clientData.vkMusicLink });
    }
    
    if (clientData.otherComments) pyrusFields.push({ id: 39, value: clientData.otherComments });

    // Формируем заголовок задачи
    let taskTitle = `Заявка на дистрибуцию: ${clientData.releaseTitle || 'Без названия'} от ${clientData.artistNicknames || 'Неизвестный артист'}`;

    const pyrusTaskData = {
        form_id: PYRUS_FORM_ID_DISTRIBUTION,
        fields: pyrusFields.filter(f => f.value !== null && f.value !== undefined && f.value !== '' && (Array.isArray(f.value) ? f.value.length > 0 : true)),
        text: taskTitle,
    };

    // console.log("Pyrus API Request Body (Distribution):", JSON.stringify(pyrusTaskData, null, 2));

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
        if (uploadId) pushProgress(uploadId, 100);
        return NextResponse.json({
            message: "Форма успешно отправлена",
            taskId: responseData.task.id,
        });
    } else {
        console.error("Pyrus API error (creating distribution task):", responseData);
        
        // Handle validation errors
        if (responseData.error && responseData.error_code === 'invalid_value_format') {
          return NextResponse.json(
            { message: "Проверьте корректность заполненных полей в форме." },
            { status: 400 }
          );
        }
        
        return NextResponse.json(
            { message: "Ошибка при отправке формы", details: responseData },
            { status: pyrusResponse.status || 500 }
        );
    }
  } catch (error) {
    console.error("Error processing Pyrus distribution submission:", error);
    let simplifiedErrorMessage = "Ошибка при отправке формы";
    let errorDetails: any = "Неизвестная ошибка сервера";
    if (error instanceof Error) {
      errorDetails = error.message;
    }
    return NextResponse.json({ message: simplifiedErrorMessage, details: errorDetails }, { status: 500 });
  }
}