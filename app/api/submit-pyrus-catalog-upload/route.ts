import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { pushProgress } from '../progress-stream';
import { getPyrusApiKey, getPyrusAccessToken, uploadFileToPyrus } from '@/lib/pyrus';
import {
  guardPublicFormRateLimit,
  safeParseFormJsonString,
  pyrusCatalogReleasesSchema,
} from '@/lib/pyrus-public-schemas';

const PYRUS_FORM_ID_CATALOG_UPLOAD = 2312633;

// --- Interfaces (should match client-side state) ---
interface TrackData {
  id: string;
  trackName: string; 
  mainArtists: string; 
  isrc: string;
  previewStart: string; 
  musicAuthor: string;
  wordsAuthor: string;
  language: string; // choice_id 
  explicit: boolean; 
  isFocusTrack: boolean; 
}

interface ReleaseData {
  id: string; 
  releaseType: string; // choice_id
  releaseTitle: string;
  artists: string;
  upc: string;
  originalReleaseDate: string; 
  genre: string;
  otherGenre?: string;
  tracks: TrackData[];
}

// --- Pyrus Field ID Mapping ---
const releaseFieldIds = [
  { // First release
    type: 45,
    single: {
      title: 57, artists: 58, cover: 59, upc: 60, isrc: 61, releaseDate: 62, genre: 63,
      tracklistTable: 64,
      tracklistCols: { audio: 65, preview: 235, musicAuthor: 67, wordsAuthor: 68, language: 69, explicit: 122, lyrics: 70 }
    },
    album: {
      title: 55, artists: 71, cover: 72, upc: 73, releaseDate: 74, genre: 75,
      tracklistTable: 76,
      tracklistCols: { audio: 77, trackName: 78, mainArtists: 80, isrc: 79, preview: 236, musicAuthor: 82, wordsAuthor: 83, language: 84, explicit: 126, focusTrack: 86, lyrics: 87 }
    }
  },
  { // Second release
    type: 88,
    single: {
      title: 90, artists: 91, cover: 92, upc: 93, isrc: 94, releaseDate: 95, genre: 96,
      tracklistTable: 97,
      tracklistCols: { audio: 98, preview: 237, musicAuthor: 100, wordsAuthor: 101, language: 102, explicit: 123, lyrics: 103 }
    },
    album: {
        title: 127, artists: 128, cover: 129, upc: 130, releaseDate: 131, genre: 132,
        tracklistTable: 133,
        tracklistCols: { audio: 134, trackName: 135, mainArtists: 136, isrc: 137, preview: 238, musicAuthor: 139, wordsAuthor: 140, language: 141, explicit: 142, focusTrack: 143, lyrics: 144 }
    }
  },
  { // Third release
    type: 105,
    single: {
        title: 107, artists: 108, cover: 109, upc: 110, isrc: 111, releaseDate: 112, genre: 113,
        tracklistTable: 114,
        tracklistCols: { audio: 115, preview: 239, musicAuthor: 117, wordsAuthor: 118, language: 124, explicit: 125, lyrics: 120 }
    },
    album: {
        title: 145, artists: 146, cover: 147, upc: 148, releaseDate: 149, genre: 150,
        tracklistTable: 151,
        tracklistCols: { audio: 152, trackName: 153, mainArtists: 154, isrc: 155, preview: 240, musicAuthor: 157, wordsAuthor: 158, language: 159, explicit: 160, focusTrack: 161, lyrics: 162 }
    }
  },
  { // Fourth release
    type: 164,
    single: {
      title: 170, artists: 171, cover: 172, upc: 173, isrc: 174, releaseDate: 175, genre: 175, // genre may share field; adjust if form updated
      tracklistTable: 176,
      tracklistCols: { audio: 177, preview: 241, musicAuthor: 180, wordsAuthor: 181, language: 179, explicit: 182, lyrics: 183 }
    },
    album: {
      title: 184, artists: 185, cover: 186, upc: 187, releaseDate: 188, genre: 189,
      tracklistTable: 190,
      tracklistCols: { audio: 191, trackName: 192, mainArtists: 193, isrc: 194, preview: 242, musicAuthor: 196, wordsAuthor: 197, language: 198, explicit: 199, focusTrack: 200, lyrics: 201 }
    }
  },
  { // Fifth release
    type: 165,
    single: {
      title: 220, artists: 221, cover: 222, upc: 223, isrc: 224, releaseDate: 225, genre: 226,
      tracklistTable: 227,
      tracklistCols: { audio: 228, preview: 243, musicAuthor: 230, wordsAuthor: 231, language: 232, explicit: 233, lyrics: 234 }
    },
    album: {
      title: 202, artists: 203, cover: 204, upc: 205, releaseDate: 206, genre: 207,
      tracklistTable: 208,
      tracklistCols: { audio: 209, trackName: 210, mainArtists: 211, isrc: 212, preview: 244, musicAuthor: 214, wordsAuthor: 215, language: 216, explicit: 217, focusTrack: 218, lyrics: 219 }
    }
  }
];

export async function POST(request: NextRequest) {
  const rl = guardPublicFormRateLimit(request);
  if (rl) return rl;

  if (!getPyrusApiKey()) {
    return NextResponse.json({ message: "Ошибка сервера: Ключ API Pyrus не настроен." }, { status: 500 });
  }

  const accessToken = await getPyrusAccessToken();
  if (!accessToken) {
    return NextResponse.json({ message: "Ошибка аутентификации Pyrus." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const formJsonString = formData.get('form_data_json') as string | null;
    
    const parsedReleases = safeParseFormJsonString(formJsonString, pyrusCatalogReleasesSchema);
    if (!parsedReleases.ok) return parsedReleases.response;

    const releasesData = parsedReleases.data as unknown as ReleaseData[];
    const uploadId = formData.get('upload_id') as string | null;

    // ---- Calculate total file count ---
    let totalFilesToUpload = 0;
    releasesData.forEach((release, rIdx) => {
      const coverFile = formData.get(`release_${rIdx}_coverArt`) as File | null;
      if (coverFile) totalFilesToUpload++;
      release.tracks.forEach((_, tIdx) => {
        const audio = formData.get(`release_${rIdx}_track_${tIdx}_audioFile`) as File | null;
        const lyrics = formData.get(`release_${rIdx}_track_${tIdx}_lyricsFile`) as File | null;
        if (audio) totalFilesToUpload++;
        if (lyrics) totalFilesToUpload++;
      });
    });
    let uploadedCount = 0;

    const pyrusFields: any[] = [];

    for (let i = 0; i < releasesData.length; i++) {
        const releaseData = releasesData[i];
        const ids = releaseFieldIds[i];
        if (!ids) continue; // Do not process more than 3 releases

        // --- Process Cover Art ---
        let coverArtPyrusFileId: string | null = null;
        const coverArtFile = formData.get(`release_${i}_coverArt`) as File | null;
        if (coverArtFile) {
            const uploadedCover = await uploadFileToPyrus(coverArtFile, accessToken);
            if (uploadedCover && uploadedCover.guid) {
                coverArtPyrusFileId = uploadedCover.guid;
                if (uploadId) {
                  uploadedCount++; pushProgress(uploadId, Math.round((uploadedCount / totalFilesToUpload) * 100));
                }
            } else {
                console.warn(`Failed to upload cover art for release ${i} to Pyrus`);
            }
        }

        // --- Map common and conditional fields ---
        pyrusFields.push({ id: ids.type, value: { choice_id: parseInt(releaseData.releaseType, 10) } });

        if (releaseData.releaseType === "1") { // Single
            const singleIds = ids.single;
            pyrusFields.push({ id: singleIds.title, value: releaseData.releaseTitle });
            pyrusFields.push({ id: singleIds.artists, value: releaseData.artists });
            if (coverArtPyrusFileId) {
                pyrusFields.push({ id: singleIds.cover, value: [{ guid: coverArtPyrusFileId }] });
            }
            pyrusFields.push({ id: singleIds.upc, value: releaseData.upc });
            if (releaseData.tracks.length > 0) {
                 pyrusFields.push({ id: singleIds.isrc, value: releaseData.tracks[0].isrc });
            }
            pyrusFields.push({ id: singleIds.releaseDate, value: releaseData.originalReleaseDate });
            pyrusFields.push({ id: singleIds.genre, value: releaseData.genre });

            // Single's tracklist (table with one row)
            if (releaseData.tracks.length > 0) {
                const track = releaseData.tracks[0];
                const trackAudioFile = formData.get(`release_${i}_track_0_audioFile`) as File | null;
                const trackLyricsFile = formData.get(`release_${i}_track_0_lyricsFile`) as File | null;
                let trackAudioPyrusFileId: string | null = null;
                let trackLyricsPyrusFileId: string | null = null;

                if (trackAudioFile) {
                    const uploadedAudio = await uploadFileToPyrus(trackAudioFile, accessToken);
                    if (uploadedAudio && uploadedAudio.guid) {
                        trackAudioPyrusFileId = uploadedAudio.guid;
                        if (uploadId) { uploadedCount++; pushProgress(uploadId, Math.round((uploadedCount/totalFilesToUpload)*100)); }
                    }
                }
                if (trackLyricsFile) {
                    const uploadedLyrics = await uploadFileToPyrus(trackLyricsFile, accessToken);
                    if (uploadedLyrics && uploadedLyrics.guid) {
                        trackLyricsPyrusFileId = uploadedLyrics.guid;
                        if (uploadId) { uploadedCount++; pushProgress(uploadId, Math.round((uploadedCount/totalFilesToUpload)*100)); }
                    }
                }

                const singleTrackCells = [];
                const colIds = singleIds.tracklistCols;
                if (trackAudioPyrusFileId) singleTrackCells.push({ id: colIds.audio, value: [trackAudioPyrusFileId] });
                singleTrackCells.push({ id: colIds.preview, value: track.previewStart });
                singleTrackCells.push({ id: colIds.musicAuthor, value: track.musicAuthor });
                singleTrackCells.push({ id: colIds.wordsAuthor, value: track.wordsAuthor });
                if (track.language) singleTrackCells.push({ id: colIds.language, value: { choice_id: parseInt(track.language, 10) } });
                if (track.explicit) {
                     singleTrackCells.push({ id: colIds.explicit, value: "checked" });
                }
                if (trackLyricsPyrusFileId) singleTrackCells.push({ id: colIds.lyrics, value: [trackLyricsPyrusFileId] });

                pyrusFields.push({ id: singleIds.tracklistTable, value: [{ row_id: 1, cells: singleTrackCells }] });
            }
        } else if (releaseData.releaseType === "2") { // Album
            const albumIds = ids.album;
            pyrusFields.push({ id: albumIds.title, value: releaseData.releaseTitle });
            pyrusFields.push({ id: albumIds.artists, value: releaseData.artists });
            if (coverArtPyrusFileId) {
                 pyrusFields.push({ id: albumIds.cover, value: [{ guid: coverArtPyrusFileId }] });
            }
            pyrusFields.push({ id: albumIds.upc, value: releaseData.upc });
            pyrusFields.push({ id: albumIds.releaseDate, value: releaseData.originalReleaseDate });
            pyrusFields.push({ id: albumIds.genre, value: releaseData.genre });

            // Album's tracklist (table with multiple rows)
            const albumTracksRows: any[] = [];
            for (let j = 0; j < releaseData.tracks.length; j++) {
                const track = releaseData.tracks[j];
                const trackAudioFile = formData.get(`release_${i}_track_${j}_audioFile`) as File | null;
                const trackLyricsFile = formData.get(`release_${i}_track_${j}_lyricsFile`) as File | null;
                let trackAudioPyrusFileId: string | null = null;
                let trackLyricsPyrusFileId: string | null = null;

                if (trackAudioFile) {
                    const uploadedAudio = await uploadFileToPyrus(trackAudioFile, accessToken);
                    if (uploadedAudio && uploadedAudio.guid) {
                        trackAudioPyrusFileId = uploadedAudio.guid;
                        if (uploadId) { uploadedCount++; pushProgress(uploadId, Math.round((uploadedCount/totalFilesToUpload)*100)); }
                    }
                }
                if (trackLyricsFile) {
                    const uploadedLyrics = await uploadFileToPyrus(trackLyricsFile, accessToken);
                    if (uploadedLyrics && uploadedLyrics.guid) {
                        trackLyricsPyrusFileId = uploadedLyrics.guid;
                        if (uploadId) { uploadedCount++; pushProgress(uploadId, Math.round((uploadedCount/totalFilesToUpload)*100)); }
                    }
                }

                const albumTrackCells = [];
                const colIds = albumIds.tracklistCols;
                if (trackAudioPyrusFileId) albumTrackCells.push({ id: colIds.audio, value: [trackAudioPyrusFileId] });
                albumTrackCells.push({ id: colIds.trackName, value: track.trackName });
                albumTrackCells.push({ id: colIds.mainArtists, value: track.mainArtists });
                albumTrackCells.push({ id: colIds.isrc, value: track.isrc });
                albumTrackCells.push({ id: colIds.preview, value: track.previewStart });
                albumTrackCells.push({ id: colIds.musicAuthor, value: track.musicAuthor });
                albumTrackCells.push({ id: colIds.wordsAuthor, value: track.wordsAuthor });
                if (track.language) albumTrackCells.push({ id: colIds.language, value: { choice_id: parseInt(track.language, 10) } });
                if (track.explicit) {
                    albumTrackCells.push({ id: colIds.explicit, value: "checked" });
                }
                if (track.isFocusTrack) {
                    albumTrackCells.push({ id: colIds.focusTrack, value: "checked" });
                }
                if (trackLyricsPyrusFileId) albumTrackCells.push({ id: colIds.lyrics, value: [trackLyricsPyrusFileId] });

                albumTracksRows.push({ row_id: j + 1, cells: albumTrackCells });
            }
            if (albumTracksRows.length > 0) {
                pyrusFields.push({ id: albumIds.tracklistTable, value: albumTracksRows });
            }
        }
    }

    // Формируем заголовок задачи
    let taskTitle = `Заявка на перенос каталога`;
    if (releasesData.length > 0 && releasesData[0].releaseTitle) {
        taskTitle = `Перенос каталога: ${releasesData[0].releaseTitle}`;
        if (releasesData[0].artists) {
            taskTitle += ` от ${releasesData[0].artists}`;
        }
        if (releasesData.length > 1) {
            taskTitle += ` (и еще ${releasesData.length - 1})`;
        }
    }

    const pyrusTaskData = {
        form_id: PYRUS_FORM_ID_CATALOG_UPLOAD,
        fields: pyrusFields.filter(f => f.value !== null && f.value !== undefined && f.value !== '' && (Array.isArray(f.value) ? f.value.length > 0 : true)),
        text: taskTitle,
    };

    // console.log("Pyrus API Request Body (Catalog Upload):", JSON.stringify(pyrusTaskData, null, 2));

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
        console.error("Pyrus API error (creating catalog task):", responseData);
        
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
    console.error("Error processing Pyrus catalog submission:", error);
    let simplifiedErrorMessage = "Ошибка при отправке формы";
    let errorDetails: any = "Неизвестная ошибка сервера";
    if (error instanceof Error) {
      errorDetails = error.message;
    }
    return NextResponse.json({ message: simplifiedErrorMessage, details: errorDetails }, { status: 500 });
  }
} 