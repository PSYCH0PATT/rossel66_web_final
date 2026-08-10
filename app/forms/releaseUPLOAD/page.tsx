"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SparklesCore } from "@/components/sparkles";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { PlusCircle, Trash2, UploadCloud } from "lucide-react";
import { submitFormSession } from "@/lib/buildin/form-session-client";
import { pickPromoPayload } from "@/lib/buildin/form-contracts";
import { FORM_SESSION_MAX_FILE_BYTES } from "@/lib/buildin/types";

const MAX_FILE_BYTES = FORM_SESSION_MAX_FILE_BYTES;

function formatFileSizeMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} МБ`;
}

// --- Interfaces for State Management (based on Pyrus Form ID 1534238) ---
interface TrackRelease {
  id: string; // Client-side unique ID
  audioFile?: File;
  trackName: string;
  mainArtists: string;
  previewStart: string; // Format HH:MM:SS or MM:SS
  musicAuthor: string;
  wordsAuthor: string;
  language: string; // Pyrus choice_id (field 29)
  explicit: string; // Pyrus choice_id for Yes/No (field 66)
  isFocusTrack: boolean;
  lyricsFile?: File;
}

interface ReleaseUploadFormData {
  artistNicknames: string; // required
  releaseTitle: string; // required
  releaseType: string; // Pyrus choice_id (field 11), required
  releaseDate: string; // YYYY-MM-DD, required
  coverArtFile?: File;
  genre: string; // Pyrus choice_id (field 15), required
  otherGenre: string;
  tracks: TrackRelease[];
  videoSnippetNeeded: string; // Pyrus choice_id (field 41), required
  submitToPromo: string; // Pyrus choice_id (field 42), required
  // Promo section (conditionally shown based on submitToPromo)
  artistInfo: string;
  releaseInfo: string;
  releaseSupport: string;
  artistPhotosLink: string;
  // Social media (conditionally shown)
  specifySocialMedia: string; // Pyrus choice_id (field 59)
  vkLink: string;
  tiktokLink: string;
  youtubeLink: string;
  instagramLink: string;
  soundcloudLink: string;
  // Streaming links (conditionally shown)
  specifyStreamingLinks: string; // Pyrus choice_id (field 32)
  yandexMusicLink: string;
  spotifyLink: string;
  appleMusicLink: string;
  vkMusicLink: string;
  otherComments: string;
}

// --- Options from Pyrus Form 1534238 ---
const releaseTypeOptionsRelease = [
  { choice_id: "1", choice_value: "Сингл (1 трек)" },
  { choice_id: "2", choice_value: "Макси-сингл (2-3 трека)" },
  { choice_id: "3", choice_value: "EP (2-7 треков)" },
  { choice_id: "4", choice_value: "Альбом (8 и более треков)" },
];

const genreOptionsRelease = [
  { choice_id: "1", choice_value: "Hip Hop/Rap" },
  { choice_id: "2", choice_value: "Phonk" },
  { choice_id: "3", choice_value: "Electronic" },
  { choice_id: "4", choice_value: "Pop" },
  { choice_id: "5", choice_value: "Dance" },
  { choice_id: "6", choice_value: "Rock" },
  { choice_id: "7", choice_value: "Другой" },
];

const trackLanguageOptionsRelease = [
  { choice_id: "1", choice_value: "Русский" },
  { choice_id: "2", choice_value: "Английский" },
  { choice_id: "3", choice_value: "Без слов" },
];

const explicitOptionsRelease = [
  { choice_id: "1", choice_value: "Да" },
  { choice_id: "2", choice_value: "Нет" },
];

const yesNoOptions = [
  { choice_id: "1", choice_value: "Да" },
  { choice_id: "2", choice_value: "Нет" },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function ReleaseUploadPage() {
  const initialTrack = useCallback((): TrackRelease => ({
    id: generateId(),
    trackName: "",
    mainArtists: "",
    previewStart: "00:30",
    musicAuthor: "",
    wordsAuthor: "",
    language: "0", // Default to "Не выбрано"
    explicit: "0", // Default to "Не выбрано"
    isFocusTrack: false,
  }), []);

  const [formData, setFormData] = useState<ReleaseUploadFormData>({
    artistNicknames: "",
    releaseTitle: "",
    releaseType: "0",
    releaseDate: "",
    genre: "0",
    otherGenre: "",
    tracks: [initialTrack()],
    videoSnippetNeeded: "0",
    submitToPromo: "0",
    artistInfo: "",
    releaseInfo: "",
    releaseSupport: "",
    artistPhotosLink: "",
    specifySocialMedia: "0",
    vkLink: "",
    tiktokLink: "",
    youtubeLink: "",
    instagramLink: "",
    soundcloudLink: "",
    specifyStreamingLinks: "0",
    yandexMusicLink: "",
    spotifyLink: "",
    appleMusicLink: "",
    vkMusicLink: "",
    otherComments: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    document.title = 'Отгрузка релиза | ROSSEL 66 MUSIC';
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof ReleaseUploadFormData, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [name]: value } as ReleaseUploadFormData
      if (name === "submitToPromo" && value !== "1") {
        next.artistInfo = ""
        next.releaseInfo = ""
        next.releaseSupport = ""
        next.artistPhotosLink = ""
        next.specifySocialMedia = "0"
        next.vkLink = ""
        next.tiktokLink = ""
        next.youtubeLink = ""
        next.instagramLink = ""
        next.soundcloudLink = ""
      }
      if (name === "specifySocialMedia" && value !== "1") {
        next.vkLink = ""
        next.tiktokLink = ""
        next.youtubeLink = ""
        next.instagramLink = ""
        next.soundcloudLink = ""
      }
      if (name === "specifyStreamingLinks" && value !== "1") {
        next.yandexMusicLink = ""
        next.spotifyLink = ""
        next.appleMusicLink = ""
        next.vkMusicLink = ""
      }
      return next
    })
  };

  const assertFileSize = (file: File, label: string): boolean => {
    if (file.size > MAX_FILE_BYTES) {
      setSubmitStatus("error");
      setSubmitMessage(
        `Ошибка: файл «${file.name}» (${label}) слишком большой. Максимум ${formatFileSizeMb(MAX_FILE_BYTES)}.`
      );
      return false;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    if (!files || !files[0]) return;
    const file = files[0];
    if (name === "coverArtFile") {
      if (!assertFileSize(file, "обложка")) {
        e.target.value = "";
        return;
      }
      setSubmitStatus(null);
      setSubmitMessage("");
      setFormData((prev) => ({ ...prev, coverArtFile: file }));
    }
    e.target.value = "";
  };

  // --- Track Handlers ---
  const handleTrackChange = (trackId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      tracks: prev.tracks.map(track =>
        track.id === trackId ? { ...track, [name]: value } : track
      ),
    }));
  };

  const handleTrackSelectChange = (trackId: string, name: keyof Pick<TrackRelease, 'language' | 'explicit'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => {
        if (track.id === trackId) {
          const updatedTrack = { ...track, [name]: value };
          // Если меняется язык и он "Без слов" или не выбран, очищаем автора слов
          if (name === 'language' && (value === '0' || value === '3')) {
            updatedTrack.wordsAuthor = '';
          }
          return updatedTrack;
        }
        return track;
      }),
    }));
  };

  const handleTrackCheckboxChange = (trackId: string, name: keyof Pick<TrackRelease, 'isFocusTrack'>) => {
    setFormData(prev => ({
      ...prev,
      tracks: prev.tracks.map(track =>
        track.id === trackId ? { ...track, [name]: !track[name] } : track
      ),
    }));
  };

  const handleTrackFileChange = (trackId: string, name: "audioFile" | "lyricsFile", files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    const label = name === "audioFile" ? "аудио" : "текст трека";
    if (!assertFileSize(file, label)) return;
    setSubmitStatus(null);
    setSubmitMessage("");
    setFormData((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) =>
        track.id === trackId ? { ...track, [name]: file } : track
      ),
    }));
  };

  const addTrackRow = useCallback(() => {
    setFormData(prev => ({ ...prev, tracks: [...prev.tracks, initialTrack()] }));
  }, [initialTrack]);

  const removeTrackRow = (trackId: string) => {
    setFormData(prev => ({ ...prev, tracks: prev.tracks.filter(track => track.id !== trackId) }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Валидация основных полей релиза
    if (!formData.artistNicknames.trim()) {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо указать никнеймы артистов.');
      return;
    }

    if (!formData.releaseTitle.trim()) {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо указать название релиза.');
      return;
    }
    
    if (formData.releaseType === "0") {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо выбрать тип релиза.');
      return;
    }
    
    if (!formData.releaseDate) {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо указать дату релиза.');
      return;
    }
    
    if (formData.genre === "0") {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо выбрать жанр.');
      return;
    }
    
    if (formData.genre === "7" && !formData.otherGenre.trim()) {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо указать жанр, так как выбран "Другой".');
      return;
    }
    
    if (!formData.coverArtFile) {
      setSubmitStatus("error");
      setSubmitMessage("Ошибка: Необходимо загрузить обложку.");
      return;
    }
    
    if (formData.videoSnippetNeeded === "0") {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо указать, нужен ли видео-сниппет.');
      return;
    }
    
    if (formData.submitToPromo === "0") {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо указать, нужно ли подавать релиз на промо.');
      return;
    }

    if (formData.submitToPromo === "1" && formData.specifySocialMedia === "0") {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо указать, хотите ли вы указать ссылки на соц. сети.');
      return;
    }

    if (formData.specifyStreamingLinks === "0") {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо указать, хотите ли вы указать ссылки на профили артиста на стриминговых площадках.');
      return;
    }
    
    // Валидация треков
    if (formData.tracks.length === 0) {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо добавить хотя бы один трек.');
      return;
    }
    
    for (let i = 0; i < formData.tracks.length; i++) {
      const track = formData.tracks[i];

      if (!track.audioFile) {
        setSubmitStatus("error");
        setSubmitMessage(`Ошибка: Необходимо загрузить аудио-файл для трека ${i + 1}.`);
        return;
      }
      
      if (!track.trackName.trim()) {
        setSubmitStatus('error');
        setSubmitMessage(`Ошибка: Необходимо указать название трека ${i + 1}.`);
        return;
      }
      
      if (!track.mainArtists.trim()) {
        setSubmitStatus('error');
        setSubmitMessage(`Ошибка: Необходимо указать основных исполнителей для трека ${i + 1}.`);
        return;
      }
      
      if (!track.previewStart.trim()) {
        setSubmitStatus('error');
        setSubmitMessage(`Ошибка: Необходимо указать начало предпрослушивания для трека ${i + 1}.`);
        return;
      }
      
      if (!track.musicAuthor.trim()) {
        setSubmitStatus('error');
        setSubmitMessage(`Ошибка: Необходимо указать автора музыки для трека ${i + 1}.`);
        return;
      }
      
      if (track.language === "0") {
        setSubmitStatus('error');
        setSubmitMessage(`Ошибка: Необходимо выбрать язык вокала для трека ${i + 1}.`);
        return;
      }
      
      if ((track.language === '1' || track.language === '2') && !track.wordsAuthor.trim()) {
        setSubmitStatus('error');
        setSubmitMessage(`Ошибка: Необходимо указать автора слов для трека ${i + 1}, так как выбран язык с вокалом.`);
        return;
      }
      
      if (track.explicit === "0") {
        setSubmitStatus('error');
        setSubmitMessage(`Ошибка: Необходимо указать, содержит ли трек ${i + 1} ненормативную лексику.`);
        return;
      }
    }
    
    // Условная валидация для промо
    if (formData.submitToPromo === "1") {
      if (!formData.artistInfo.trim()) {
        setSubmitStatus('error');
        setSubmitMessage('Ошибка: Необходимо указать информацию об артисте для подачи на промо.');
        return;
      }
      
      if (!formData.releaseInfo.trim()) {
        setSubmitStatus('error');
        setSubmitMessage('Ошибка: Необходимо указать информацию о релизе для подачи на промо.');
        return;
      }
    }
    
    setIsSubmitting(true);
    setSubmitStatus(null);
    setSubmitMessage("");

    const uploadId = self.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    const { coverArtFile, tracks, ...rest } = formData;

    const releaseTracks = tracks.map((track) => ({
      trackTitle: track.trackName,
      artists: track.mainArtists,
      language: track.language,
      explicit: track.explicit === "1",
      focus: track.isFocusTrack,
      previewStart: track.previewStart,
      musicAuthor: track.musicAuthor,
      wordsAuthor: track.wordsAuthor,
    }));

    const files: Array<{
      fieldKey: string;
      file: File;
      parentKind: "release" | "track";
      releaseIndex?: number;
      trackIndex?: number;
    }> = [];

    if (coverArtFile) {
      files.push({
        fieldKey: "coverArtFile",
        file: coverArtFile,
        parentKind: "release",
        releaseIndex: 0,
      });
    }
    tracks.forEach((track, i) => {
      if (track.audioFile) {
        files.push({
          fieldKey: `track_${i}_audioFile`,
          file: track.audioFile,
          parentKind: "track",
          releaseIndex: 0,
          trackIndex: i,
        });
      }
      if (track.lyricsFile) {
        files.push({
          fieldKey: `track_${i}_lyricsFile`,
          file: track.lyricsFile,
          parentKind: "track",
          releaseIndex: 0,
          trackIndex: i,
        });
      }
    });

    try {
      await submitFormSession({
        uploadId,
        manifest: {
          formType: "release_upload",
          title: formData.releaseTitle,
          artistNickname: formData.artistNicknames,
          releases: [
            {
              releaseTitle: formData.releaseTitle,
              artists: formData.artistNicknames,
              releaseType: formData.releaseType,
              genre: formData.genre,
              otherGenre: formData.otherGenre,
              releaseDate: formData.releaseDate,
              tracks: releaseTracks,
            },
          ],
          payload: pickPromoPayload(rest as Record<string, unknown>),
          files,
        },
        onProgress: (p) => setUploadProgress(p.percent),
      });
      setSubmitStatus("success");
      setSubmitMessage("Спасибо! Данные успешно отправлены.");
      setFormData({
        artistNicknames: "",
        releaseTitle: "",
        releaseType: "0",
        releaseDate: "",
        genre: "0",
        otherGenre: "",
        tracks: [initialTrack()],
        videoSnippetNeeded: "0",
        submitToPromo: "0",
        artistInfo: "",
        releaseInfo: "",
        releaseSupport: "",
        artistPhotosLink: "",
        specifySocialMedia: "0",
        vkLink: "",
        tiktokLink: "",
        youtubeLink: "",
        instagramLink: "",
        soundcloudLink: "",
        specifyStreamingLinks: "0",
        yandexMusicLink: "",
        spotifyLink: "",
        appleMusicLink: "",
        vkMusicLink: "",
        otherComments: "",
      });
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(
        error instanceof Error ? error.message : "Сетевая ошибка."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render Helper Functions (Can be DRYed up later if needed) ---
  const renderInputField = (
    name: keyof ReleaseUploadFormData | string,
    label: string,
    value: string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    placeholder: string = "",
    type: string = "text",
    required: boolean = true,
    className: string = ""
  ) => (
    <div className={`mb-4 ${className}`}>
      <label htmlFor={name as string} className="block text-sm font-medium text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Input id={name as string} name={name as string} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full border-opacity-50 hover:border-emerald-500 hover:border-opacity-40"/>
    </div>
  );

  const renderTextareaField = (
    name: keyof ReleaseUploadFormData,
    label: string,
    value: string,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void,
    placeholder: string = "",
    required: boolean = true,
    rows: number = 3,
    className: string = ""
  ) => (
     <div className={`mb-4 ${className}`}>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Textarea id={name} name={name} value={value} onChange={onChange} placeholder={placeholder} required={required} className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full border-opacity-50 hover:border-emerald-500 hover:border-opacity-40" rows={rows}/>
    </div>   
  );

 const renderSelectField = (
    name: keyof ReleaseUploadFormData | string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: { choice_id: string; choice_value: string }[],
    placeholder: string = "Не выбрано",
    required: boolean = true,
    className: string = ""
  ) => (
    <div className={`mb-4 ${className}`}>
      <label htmlFor={name as string} className="block text-sm font-medium text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Select value={value} onValueChange={onChange} required={required}>
        <SelectTrigger id={name as string} className="w-full bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 border-opacity-50 hover:border-emerald-500 hover:border-opacity-40">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-neutral-800 border-neutral-700 text-gray-200">
          <SelectItem value="0" disabled>{placeholder}</SelectItem> 
          {options.map(option => (
            <SelectItem key={option.choice_id} value={option.choice_id} className="hover:bg-neutral-700">
              {option.choice_value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  
  const renderFileField = (
    id: string,
    name: string,
    label: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    accept: string,
    currentFile?: File,
    required: boolean = true,
    className: string = "",
    uploading?: boolean,
    uploaded?: boolean
  ) => {
    const displayText = uploading
      ? "Загрузка..."
      : currentFile
        ? currentFile.name
        : uploaded
          ? "Загружено"
          : "Выберите или перетащите файл";
    const isDone = !!currentFile || !!uploaded;
    return (
      <div className={`mb-4 ${className}`}>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <label
          htmlFor={id}
          className={`w-full h-10 flex items-center justify-between bg-white/5 border border-dashed border-white/20 hover:border-emerald-500 hover:border-opacity-40 transition-colors duration-200 cursor-pointer px-3 py-2 text-xs border-opacity-50 ${uploading ? "pointer-events-none opacity-70" : ""}`}
        >
          <span className={`truncate max-w-[calc(100%-3rem)] ${isDone ? "text-white" : "text-gray-400"}`}>
            {displayText}
          </span>
          <div className="flex items-center justify-center w-6 h-6 bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors duration-200 ml-1.5 flex-shrink-0 border-opacity-50">
            <UploadCloud className="w-3 h-3 text-emerald-400" />
          </div>
        </label>
        <Input
          id={id}
          name={name}
          type="file"
          onChange={onChange}
          accept={accept}
          required={required && !isDone}
          className="hidden"
          disabled={uploading}
        />
      </div>
    );
  };

  const renderCheckboxField = (
    name: keyof ReleaseUploadFormData | string, 
    label: string,
    checked: boolean,
    onCheckedChange: (checked: boolean) => void, 
    className: string = ""
) => (
    <div className={`flex items-center space-x-2 mb-4 ${className}`}>
        <Checkbox id={name as string} name={name as string} checked={checked} onCheckedChange={onCheckedChange} className="border-gray-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-600 border-opacity-50 hover:border-emerald-500 hover:border-opacity-40" />
        <label htmlFor={name as string} className="text-sm font-medium text-gray-300 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
        </label>
    </div>
);

  // --- Actual Form JSX will go here in the next step ---
  return (
    <main 
      className="min-h-screen flex flex-col overflow-y-auto overflow-x-hidden antialiased bg-grid-white/[0.02] relative"
      style={{ fontFamily: "'Mulish', sans-serif", zIndex: 10 }}
    >
      <Navbar />
      <div className="flex-grow pt-20 pb-12 md:pt-24 md:pb-16 relative">
        <div className="h-full w-full fixed inset-0 z-0">
          <SparklesCore
            id="tsparticlesfullpage-releaseupload"
            background="transparent"
            minSize={0.9}
            maxSize={2.1}
            particleDensity={windowSize.width < 768 ? 100 : 180}
            className="w-full h-full"
            particleColor="#FFFFFF"
          />
        </div>
        <div className="relative z-20 container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10 md:mb-12"
          >
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Отправка нового релиза
            </h1>
            <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto"></div>
          </motion.div>

          <div className="max-w-6xl mx-auto shadow-2xl relative z-10">
            {/* Flashes - Removed */}

            <form
              onSubmit={handleSubmit}
              noValidate
              data-testid="release-upload-form"
              className="w-full h-full bg-neutral-990/60 backdrop-blur-sm p-6 sm:p-8 relative z-[1]"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderImageSource: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.5), rgba(20, 184, 166, 0.5), rgba(6, 182, 212, 0.5))',
                borderImageSlice: 1,
              }}
            >
              {/* --- Main Release Information --- */}
              <h2 className="text-xl font-semibold text-white mb-6 border-b border-white/20 pb-3">
                Основная информация о релизе
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                {renderInputField("artistNicknames", "Никнеймы артистов (через запятую)", formData.artistNicknames, handleChange, "Artist1, Artist2", "text", true, "md:col-span-1")}
                {renderInputField("releaseTitle", "Название релиза", formData.releaseTitle, handleChange, "Название сингла/EP/альбома", "text", true, "md:col-span-1")}
                {renderSelectField("releaseType", "Тип релиза", formData.releaseType, (value) => handleSelectChange("releaseType", value), releaseTypeOptionsRelease, "Выберите тип", true, "md:col-span-1")}
                {renderInputField("releaseDate", "Планируемая дата релиза", formData.releaseDate, handleChange, "", "date", true, "md:col-span-1")}
                {renderSelectField("genre", "Жанр", formData.genre, (value) => handleSelectChange("genre", value), genreOptionsRelease, "Выберите жанр", true, "md:col-span-1")}
                {renderFileField("coverArtFile_input", "coverArtFile", "Обложка (3000x3000px, .jpg/.png)", handleFileChange, "image/jpeg,image/png", formData.coverArtFile, true, "md:col-span-1")}
                {formData.genre === "7" && // "Другой"
                  renderInputField("otherGenre", "Уточните жанр", formData.otherGenre, handleChange, "Инди-фолк-рок", "text", true, "md:col-span-2")
                }
              </div>

              {/* --- Files progress (required: cover + one audio per track) --- */}
              {(() => {
                const totalRequiredFiles = 1 + formData.tracks.length;
                const uploadedRequiredFiles =
                  (formData.coverArtFile ? 1 : 0) +
                  formData.tracks.filter((t) => t.audioFile).length;
                const filesPercent =
                  totalRequiredFiles > 0
                    ? Math.round((uploadedRequiredFiles / totalRequiredFiles) * 100)
                    : 0;
                return (
                  <div className="mt-6 mb-2">
                    <div className="flex items-center justify-between text-sm text-gray-400 mb-1.5">
                      <span>
                        Файлы: {uploadedRequiredFiles} из {totalRequiredFiles} загружено
                      </span>
                      {totalRequiredFiles > 0 && (
                        <span className="tabular-nums">{filesPercent}%</span>
                      )}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500/80 transition-all duration-300"
                        style={{ width: `${filesPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* --- Tracks Section --- */}
              <div className="mt-10">
                <h3 className="text-lg font-semibold text-white mb-4">Трек-лист <span className="text-red-500">*</span></h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-700 border border-neutral-700">
                    <thead className="bg-neutral-800/50">
                      <tr>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">№</th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Аудио-файл <span className="text-red-500">*</span></th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Название трека <span className="text-red-500">*</span></th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Осн. исполнители <span className="text-red-500">*</span></th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Начало предпр. <span className="text-red-500">*</span></th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Автор музыки <span className="text-red-500">*</span></th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Автор слов</th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Язык <span className="text-red-500">*</span></th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Мат <span className="text-red-500">*</span></th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Фокус трек</th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Текст трека</th>
                        <th scope="col" className="py-3 px-1 text-center text-xs font-medium text-gray-300 uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-neutral-900/70 divide-y divide-neutral-700/70">
                      {formData.tracks.map((track, index) => (
                        <tr key={track.id}>
                          <td className="py-2 px-3 text-sm text-gray-400">{index + 1}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <label
                              htmlFor={`track_audioFile_${track.id}`}
                              className="w-full h-10 flex items-center justify-between bg-white/5 border border-dashed border-white/20 hover:border-emerald-500 hover:border-opacity-40 transition-colors duration-200 cursor-pointer rounded-md px-3 py-2 text-xs min-w-[150px] max-w-[200px]"
                            >
                              <span className={`truncate max-w-[calc(100%-3rem)] ${track.audioFile ? "text-white" : "text-gray-400"}`}>
                                {track.audioFile ? track.audioFile.name : "Загрузить .wav"}
                              </span>
                              <div className="flex items-center justify-center w-6 h-6 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-md transition-colors duration-200 ml-1.5 flex-shrink-0">
                                <UploadCloud className="w-3 h-3 text-emerald-400" />
                              </div>
                            </label>
                            <Input
                              id={`track_audioFile_${track.id}`}
                              name={`track_audioFile_form_name_${track.id}`}
                              type="file"
                              onChange={(e) => {
                                handleTrackFileChange(track.id, "audioFile", e.target.files);
                                e.target.value = "";
                              }}
                              accept=".wav"
                              required={!track.audioFile}
                              className="hidden"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input id={`track_trackName_${track.id}`} name='trackName' value={track.trackName} onChange={(e) => handleTrackChange(track.id, e)} placeholder="Название" required className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[150px] hover:border-emerald-500 hover:border-opacity-40" />
                          </td>
                          <td className="py-2 px-3">
                             <Input id={`track_mainArtists_${track.id}`} name='mainArtists' value={track.mainArtists} onChange={(e) => handleTrackChange(track.id, e)} placeholder="Artist1, Artist2" required className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[150px] hover:border-emerald-500 hover:border-opacity-40" />
                          </td>
                          <td className="py-2 px-3">
                            <Input id={`track_previewStart_${track.id}`} name='previewStart' value={track.previewStart} onChange={(e) => handleTrackChange(track.id, e)} placeholder="00:30" required className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[100px] hover:border-emerald-500 hover:border-opacity-40" />
                          </td>
                          <td className="py-2 px-3">
                            <Input id={`track_musicAuthor_${track.id}`} name='musicAuthor' value={track.musicAuthor} onChange={(e) => handleTrackChange(track.id, e)} placeholder="Полное ФИО" required className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[150px] hover:border-emerald-500 hover:border-opacity-40" />
                          </td>
                          <td className="py-2 px-3">
                            <Input 
                              id={`track_wordsAuthor_${track.id}`} 
                              name='wordsAuthor' 
                              value={track.wordsAuthor} 
                              onChange={(e) => handleTrackChange(track.id, e)} 
                              placeholder="Полное ФИО" 
                              required={track.language === '1' || track.language === '2'}
                              disabled={!(track.language === '1' || track.language === '2')}
                              className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[150px] hover:border-emerald-500 hover:border-opacity-40 disabled:bg-neutral-800 disabled:border-neutral-700 disabled:cursor-not-allowed" 
                            />
                          </td>
                          <td className="py-2 px-3 min-w-[160px]">
                            <Select value={track.language} onValueChange={(value) => handleTrackSelectChange(track.id, 'language', value)} required>
                              <SelectTrigger className="w-full bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 border-opacity-50 hover:border-emerald-500 hover:border-opacity-40">
                                <SelectValue placeholder="Не выбрано" />
                              </SelectTrigger>
                              <SelectContent className="bg-neutral-800 border-neutral-700 text-gray-200">
                                <SelectItem value="0" disabled>Не выбрано</SelectItem>
                                {trackLanguageOptionsRelease.map(opt => <SelectItem key={opt.choice_id} value={opt.choice_id}>{opt.choice_value}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-3 min-w-[120px]">
                             <Select value={track.explicit} onValueChange={(value) => handleTrackSelectChange(track.id, 'explicit', value)} required>
                              <SelectTrigger className="w-full bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 border-opacity-50 hover:border-emerald-500 hover:border-opacity-40">
                                <SelectValue placeholder="Да/Нет" />
                              </SelectTrigger>
                              <SelectContent className="bg-neutral-800 border-neutral-700 text-gray-200">
                                <SelectItem value="0" disabled>Да/Нет</SelectItem>
                                {explicitOptionsRelease.map(opt => <SelectItem key={opt.choice_id} value={opt.choice_id}>{opt.choice_value}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Checkbox id={`track_isFocusTrack_${track.id}`} name="isFocusTrack" checked={track.isFocusTrack} onCheckedChange={() => handleTrackCheckboxChange(track.id, 'isFocusTrack')} className="border-gray-400 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-600 self-center hover:border-emerald-500 hover:border-opacity-40" />
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <label
                              htmlFor={`track_lyricsFile_${track.id}`}
                              className="w-full h-10 flex items-center justify-between bg-white/5 border border-dashed border-white/20 hover:border-emerald-500 hover:border-opacity-40 transition-colors duration-200 cursor-pointer rounded-md px-3 py-2 text-xs min-w-[150px] max-w-[200px]"
                            >
                              <span className={`truncate max-w-[calc(100%-3rem)] ${track.lyricsFile ? "text-white" : "text-gray-400"}`}>
                                {track.lyricsFile ? track.lyricsFile.name : "Текст (необяз.)"}
                              </span>
                              <div className="flex items-center justify-center w-6 h-6 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-md transition-colors duration-200 ml-1.5 flex-shrink-0">
                                <UploadCloud className="w-3 h-3 text-emerald-400" />
                              </div>
                            </label>
                            <Input
                              id={`track_lyricsFile_${track.id}`}
                              name={`track_lyricsFile_form_name_${track.id}`}
                              type="file"
                              onChange={(e) => {
                                handleTrackFileChange(track.id, "lyricsFile", e.target.files);
                                e.target.value = "";
                              }}
                              accept=".txt,.doc,.docx,.pdf"
                              className="hidden"
                            />
                          </td>
                          <td className="py-2 px-1 text-center">
                            {formData.tracks.length > 1 && (
                              <Button type="button" onClick={() => removeTrackRow(track.id)} variant="ghost" size="icon" className="text-red-500 hover:text-red-400 p-1">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-start">
                  <Button 
                    type="button" 
                    onClick={addTrackRow} 
                    variant="default" 
                    className="bg-neutral-800 text-emerald-500 border border-neutral-700 hover:bg-neutral-700 hover:text-emerald-400 px-4 py-1.5 text-sm"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Добавить трек
                  </Button>
                </div>
              </div>

              {/* --- Promo Information Section --- */}
              <h2 className="text-xl font-semibold text-white mt-10 mb-2 border-b border-white/20 pb-3">
                Промо материалы
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6 mb-4">
                 {renderSelectField("videoSnippetNeeded", "Нужен ли видео-сниппет для релиза?", formData.videoSnippetNeeded, (value) => handleSelectChange("videoSnippetNeeded", value), yesNoOptions, "Да/Нет", true, "md:col-span-1")}
                 {renderSelectField("submitToPromo", "Нужно ли подавать релиз на промо?", formData.submitToPromo, (value) => handleSelectChange("submitToPromo", value), yesNoOptions, "Да/Нет", true, "md:col-span-1")}
              </div>
              
              {formData.submitToPromo === "1" && (
                <>
                  <p className="text-sm text-gray-400 mb-4">Заполните информацию ниже, если выбрали "Да" для подачи на промо.</p>
                  {renderTextareaField("artistInfo", "Информация об артисте", formData.artistInfo, handleChange, "Краткая биография, достижения...", true, 4, "md:col-span-2")}
                  {renderTextareaField("releaseInfo", "Информация о релизе", formData.releaseInfo, handleChange, "Концепция, история создания...", true, 4, "md:col-span-2")}
                  {renderTextareaField("releaseSupport", "Планируется ли поддержка релиза?", formData.releaseSupport, handleChange, "Клип, концерты, реклама...", false, 3, "md:col-span-2")}
                  {renderInputField("artistPhotosLink", "Ссылка на фото артиста (Яндекс.Диск, Google Drive)", formData.artistPhotosLink, handleChange, "https://disk.yandex.ru/...", "url", false, "md:col-span-2")}
                  
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                     {renderSelectField("specifySocialMedia", "Указать ссылки на соц. сети?", formData.specifySocialMedia, (value) => handleSelectChange("specifySocialMedia", value), yesNoOptions, "Да/Нет", true, "md:col-span-2 mb-1")}
                  </div>
                  {formData.specifySocialMedia === "1" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                        {renderInputField("vkLink", "VK", formData.vkLink, handleChange, "https://vk.com/artist", "url", false, "md:col-span-1")}
                        {renderInputField("tiktokLink", "TikTok", formData.tiktokLink, handleChange, "https://tiktok.com/@artist", "url", false, "md:col-span-1")}
                        {renderInputField("youtubeLink", "YouTube", formData.youtubeLink, handleChange, "https://youtube.com/artist", "url", false, "md:col-span-1")}
                        {renderInputField("instagramLink", "Instagram", formData.instagramLink, handleChange, "https://instagram.com/artist", "url", false, "md:col-span-1")}
                        {renderInputField("soundcloudLink", "SoundCloud", formData.soundcloudLink, handleChange, "https://soundcloud.com/artist", "url", false, "md:col-span-2")}
                    </div>
                  )}
                </>
              )}

              {/* --- Streaming Links Section --- */}
              <h2 className="text-xl font-semibold text-white mt-10 mb-2 border-b border-white/20 pb-3">
                Ссылки на стриминги (если релиз уже вышел)
              </h2>
               <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6 mb-4">
                 {renderSelectField("specifyStreamingLinks", "Хотите указать ссылки на профили артиста на стриминговых площадках?", formData.specifyStreamingLinks, (value) => handleSelectChange("specifyStreamingLinks", value), yesNoOptions, "Да/Нет", true, "md:col-span-2 mb-1")}
              </div>
              {formData.specifyStreamingLinks === "1" && (
                <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                    {renderInputField("yandexMusicLink", "Яндекс Музыка", formData.yandexMusicLink, handleChange, "", "url", false, "md:col-span-1")}
                    {renderInputField("spotifyLink", "Spotify", formData.spotifyLink, handleChange, "", "url", false, "md:col-span-1")}
                    {renderInputField("appleMusicLink", "Apple Music", formData.appleMusicLink, handleChange, "", "url", false, "md:col-span-1")}
                    {renderInputField("vkMusicLink", "VK Музыка", formData.vkMusicLink, handleChange, "", "url", false, "md:col-span-1")}
                </div>
              )}

              {/* --- Other Comments --- */}
              <div className="mt-10">
                {renderTextareaField("otherComments", "Прочие комментарии", formData.otherComments, handleChange, "Любая дополнительная информация...", false, 4, "md:col-span-2")}
              </div>

              {/* Submit Button and Status */}
              {isSubmitting && (
                <div className="w-full flex flex-col items-center justify-center mt-4 mb-6 space-y-2 text-gray-400 text-sm">
                  <div className="flex items-center space-x-3">
                    <svg className="animate-spin h-5 w-5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    <span>Загрузка файлов, это может занять несколько минут… {uploadProgress > 0 ? `${uploadProgress}%` : ""}</span>
                  </div>
                  {uploadProgress > 0 && (
                    <div className="w-full max-w-md h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all"
                        style={{ width: `${Math.min(100, uploadProgress)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {submitStatus && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  data-testid="form-submit-status"
                  data-status={submitStatus}
                  className={`mt-6 p-3 rounded-md text-sm ${
                    submitStatus === "success" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {submitMessage}
                </motion.div>
              )}
              <div className="mt-8 text-center">
                <Button type="submit" data-testid="form-submit" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-md text-base font-semibold shadow-[0_0_15px_rgba(16,185,129,0.31)] transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.44)]" disabled={isSubmitting}>
                  {isSubmitting ? "Отправка..." : "Отправить релиз"}
                </Button>
              </div>
            </form>
          </div>
          <div className="pb-12 md:pb-16"></div>
        </div>
      </div>
      <Footer forceTransparentBackground={true} />
    </main>
  );
} 