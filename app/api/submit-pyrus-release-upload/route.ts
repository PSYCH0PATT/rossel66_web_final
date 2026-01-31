import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  PYRUS_API_KEY,
  getPyrusAccessToken,
  uploadFileToPyrus,
  getPyrusErrorMessage,
} from "@/lib/pyrus";

const PYRUS_FORM_ID_RELEASE_UPLOAD = 1534238;

// --- Interfaces (should match client-side state) ---
interface TrackReleaseData {
  id: string;
  trackName: string;
  mainArtists: string;
  previewStart: string;
  musicAuthor: string;
  wordsAuthor: string;
  language: string;
  explicit: string;
  isFocusTrack: boolean;
  audioGuid?: string;
  lyricsGuid?: string;
}

interface ReleaseUploadAPIData {
  email?: string;
  artistNicknames: string;
  releaseTitle: string;
  releaseType: string;
  releaseDate: string;
  genre: string;
  otherGenre?: string;
  tracks: TrackReleaseData[];
  videoSnippetNeeded: string;
  submitToPromo: string;
  artistInfo?: string;
  releaseInfo?: string;
  releaseSupport?: string;
  artistPhotosLink?: string;
  specifySocialMedia?: string;
  vkLink?: string;
  tiktokLink?: string;
  youtubeLink?: string;
  instagramLink?: string;
  soundcloudLink?: string;
  specifyStreamingLinks?: string;
  yandexMusicLink?: string;
  spotifyLink?: string;
  appleMusicLink?: string;
  vkMusicLink?: string;
  otherComments?: string;
  coverArtGuid?: string;
}

function buildPyrusFieldsFromClientData(
  clientData: ReleaseUploadAPIData,
  coverGuid: string | null,
  trackGuids: { audioGuid: string | null; lyricsGuid: string | null }[]
): any[] {
  const pyrusFields: any[] = [];

  if (clientData.email) pyrusFields.push({ id: 37, value: clientData.email });

  pyrusFields.push({ id: 2, value: clientData.artistNicknames });
  pyrusFields.push({ id: 5, value: clientData.releaseTitle });
  if (clientData.releaseType && clientData.releaseType !== "0")
    pyrusFields.push({ id: 11, value: { choice_id: parseInt(clientData.releaseType) } });
  pyrusFields.push({ id: 12, value: clientData.releaseDate });

  if (coverGuid) {
    pyrusFields.push({ id: 13, value: [{ guid: coverGuid }] });
  }

  if (clientData.genre && clientData.genre !== "0")
    pyrusFields.push({ id: 15, value: { choice_id: parseInt(clientData.genre) } });
  if (clientData.genre === "7" && clientData.otherGenre) {
    pyrusFields.push({ id: 16, value: clientData.otherGenre });
  }

  const tracksTableRows: any[] = [];
  for (let i = 0; i < clientData.tracks.length; i++) {
    const track = clientData.tracks[i];
    const guids = trackGuids[i] ?? { audioGuid: null, lyricsGuid: null };
    const trackCells: any[] = [];

    const numericRowId = i + 1;

    if (guids.audioGuid) {
      trackCells.push({ id: 25, value: [guids.audioGuid] });
    }
    trackCells.push({ id: 19, value: track.trackName });
    trackCells.push({ id: 20, value: track.mainArtists });
    trackCells.push({ id: 67, value: track.previewStart });
    trackCells.push({ id: 27, value: track.musicAuthor });
    trackCells.push({ id: 28, value: track.wordsAuthor });
    if (track.language && track.language !== "0")
      trackCells.push({ id: 29, value: { choice_id: parseInt(track.language) } });
    if (track.explicit && track.explicit !== "0")
      trackCells.push({ id: 66, value: { choice_id: parseInt(track.explicit) } });
    if (track.isFocusTrack) trackCells.push({ id: 30, value: "checked" });

    if (guids.lyricsGuid) {
      trackCells.push({ id: 38, value: [guids.lyricsGuid] });
    }
    tracksTableRows.push({ row_id: numericRowId, cells: trackCells });
  }
  if (tracksTableRows.length > 0) {
    pyrusFields.push({ id: 17, value: tracksTableRows });
  }

  if (clientData.videoSnippetNeeded && clientData.videoSnippetNeeded !== "0")
    pyrusFields.push({ id: 41, value: { choice_id: parseInt(clientData.videoSnippetNeeded) } });
  if (clientData.submitToPromo && clientData.submitToPromo !== "0")
    pyrusFields.push({ id: 42, value: { choice_id: parseInt(clientData.submitToPromo) } });

  if (clientData.submitToPromo === "1") {
    if (clientData.artistInfo) pyrusFields.push({ id: 44, value: clientData.artistInfo });
    if (clientData.releaseInfo) pyrusFields.push({ id: 45, value: clientData.releaseInfo });
    if (clientData.releaseSupport) pyrusFields.push({ id: 46, value: clientData.releaseSupport });
    if (clientData.artistPhotosLink) pyrusFields.push({ id: 47, value: clientData.artistPhotosLink });

    if (clientData.specifySocialMedia && clientData.specifySocialMedia !== "0")
      pyrusFields.push({ id: 59, value: { choice_id: parseInt(clientData.specifySocialMedia) } });
    if (clientData.specifySocialMedia === "1") {
      if (clientData.vkLink) pyrusFields.push({ id: 60, value: clientData.vkLink });
      if (clientData.tiktokLink) pyrusFields.push({ id: 61, value: clientData.tiktokLink });
      if (clientData.youtubeLink) pyrusFields.push({ id: 62, value: clientData.youtubeLink });
      if (clientData.instagramLink) pyrusFields.push({ id: 63, value: clientData.instagramLink });
      if (clientData.soundcloudLink) pyrusFields.push({ id: 64, value: clientData.soundcloudLink });
    }
  }

  if (clientData.specifyStreamingLinks && clientData.specifyStreamingLinks !== "0")
    pyrusFields.push({ id: 32, value: { choice_id: parseInt(clientData.specifyStreamingLinks) } });
  if (clientData.specifyStreamingLinks === "1") {
    if (clientData.yandexMusicLink) pyrusFields.push({ id: 36, value: clientData.yandexMusicLink });
    if (clientData.spotifyLink) pyrusFields.push({ id: 33, value: clientData.spotifyLink });
    if (clientData.appleMusicLink) pyrusFields.push({ id: 34, value: clientData.appleMusicLink });
    if (clientData.vkMusicLink) pyrusFields.push({ id: 35, value: clientData.vkMusicLink });
  }

  if (clientData.otherComments) pyrusFields.push({ id: 40, value: clientData.otherComments });

  return pyrusFields;
}

export async function POST(request: NextRequest) {
  if (!PYRUS_API_KEY) {
    return NextResponse.json(
      { message: "Ошибка сервера: Ключ API Pyrus не настроен." },
      { status: 500 }
    );
  }

  const accessToken = await getPyrusAccessToken(PYRUS_API_KEY);
  if (!accessToken) {
    return NextResponse.json(
      { message: "Ошибка аутентификации Pyrus." },
      { status: 500 }
    );
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let clientData: ReleaseUploadAPIData;
    let coverGuid: string | null = null;
    let trackGuids: { audioGuid: string | null; lyricsGuid: string | null }[] = [];

    if (contentType.includes("application/json")) {
      const body = await request.json();
      clientData = body as ReleaseUploadAPIData;
      coverGuid = clientData.coverArtGuid ?? null;
      trackGuids = clientData.tracks.map((t) => ({
        audioGuid: t.audioGuid ?? null,
        lyricsGuid: t.lyricsGuid ?? null,
      }));
    } else {
      const formDataFromRequest = await request.formData();
      const formJsonString = formDataFromRequest.get("form_data_json") as string | null;
      if (!formJsonString) {
        return NextResponse.json(
          { message: "Отсутствуют основные данные формы." },
          { status: 400 }
        );
      }
      clientData = JSON.parse(formJsonString) as ReleaseUploadAPIData;

      const coverArtFile = formDataFromRequest.get("coverArtFile") as File | null;
      if (coverArtFile && coverArtFile instanceof File) {
        const uploadedCover = await uploadFileToPyrus(coverArtFile, accessToken);
        if (uploadedCover?.guid) coverGuid = uploadedCover.guid;
      }

      for (let i = 0; i < clientData.tracks.length; i++) {
        const audioFile = formDataFromRequest.get(`track_${i}_audioFile`) as File | null;
        const lyricsFile = formDataFromRequest.get(`track_${i}_lyricsFile`) as File | null;
        let audioGuid: string | null = null;
        let lyricsGuid: string | null = null;
        if (audioFile && audioFile instanceof File) {
          const uploaded = await uploadFileToPyrus(audioFile, accessToken);
          if (uploaded?.guid) audioGuid = uploaded.guid;
        }
        if (lyricsFile && lyricsFile instanceof File) {
          const uploaded = await uploadFileToPyrus(lyricsFile, accessToken);
          if (uploaded?.guid) lyricsGuid = uploaded.guid;
        }
        trackGuids.push({ audioGuid, lyricsGuid });
      }
    }

    const pyrusFields = buildPyrusFieldsFromClientData(
      clientData,
      coverGuid,
      trackGuids
    ).filter(
      (f) =>
        f.value !== null &&
        f.value !== undefined &&
        f.value !== "" &&
        (Array.isArray(f.value) ? f.value.length > 0 : true)
    );

    const taskTitle = `Заявка на выгрузку релиза: ${clientData.releaseTitle || "Без названия"} от ${clientData.artistNicknames || "Неизвестный артист"}${clientData.email ? ` (${clientData.email})` : ""}`;

    const pyrusTaskData = {
      form_id: PYRUS_FORM_ID_RELEASE_UPLOAD,
      fields: pyrusFields,
      text: taskTitle,
    };

    const pyrusResponse = await fetch("https://api.pyrus.com/v4/tasks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pyrusTaskData),
    });

    const responseData = await pyrusResponse.json();

    if (pyrusResponse.ok && responseData?.task?.id) {
      return NextResponse.json({
        message: "Форма успешно отправлена",
        taskId: responseData.task.id,
      });
    }

    console.error("Pyrus API error (creating release task):", responseData);
    if (responseData.error_code) {
      const errorMessage = getPyrusErrorMessage(
        responseData.error_code,
        responseData.error ?? ""
      );
      return NextResponse.json(
        { message: errorMessage },
        { status: pyrusResponse.status || 400 }
      );
    }
    return NextResponse.json(
      { message: "Ошибка при отправке формы", details: responseData },
      { status: pyrusResponse.status || 500 }
    );
  } catch (error) {
    console.error("Error processing Pyrus release submission:", error);
    const errorDetails =
      error instanceof Error ? error.message : "Неизвестная ошибка сервера";
    return NextResponse.json(
      { message: "Ошибка при отправке формы", details: errorDetails },
      { status: 500 }
    );
  }
}
