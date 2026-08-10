"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface TrackRelease {
  id: string;
  audio: File | null;
  trackName: string;
  mainArtists: string;
  previewStart: string;
  musicAuthor: string;
  wordsAuthor: string;
  language: string;
  explicit: string;
  isFocusTrack: boolean;
  lyrics: File | null;
}

interface FormData {
  releaseType: string;
  title: string;
  artists: string;
  cover: File | null;
  releaseDate: string;
  genre: string;
  otherGenre: string;
  contact: string;
  tracks: TrackRelease[];
  // Promo fields
  videoSnippetNeeded: string;
  submitToPromo: string;
  artistInfo: string;
  releaseInfo: string;
  releaseSupport: string;
  artistPhotosLink: string;
  specifySocialMedia: string;
  vkLink: string;
  tiktokLink: string;
  youtubeLink: string;
  instagramLink: string;
  soundcloudLink: string;
  // Streaming links
  specifyStreamingLinks: string;
  yandexMusicLink: string;
  spotifyLink: string;
  appleMusicLink: string;
  vkMusicLink: string;
  otherComments: string;
}

const genreOptions = [
  { choice_id: "1", choice_value: "Hip Hop/Rap" },
  { choice_id: "2", choice_value: "Phonk" },
  { choice_id: "3", choice_value: "Electronic" },
  { choice_id: "4", choice_value: "Pop" },
  { choice_id: "5", choice_value: "Dance" },
  { choice_id: "6", choice_value: "Rock" },
  { choice_id: "7", choice_value: "Другой" }
];

const releaseTypeOptions = [
  { choice_id: "1", choice_value: "Сингл (1 трек)" },
  { choice_id: "2", choice_value: "Макси-сингл (2-3 трека)" },
  { choice_id: "3", choice_value: "EP (2-7 треков)" },
  { choice_id: "4", choice_value: "Альбом (8 и более треков)" }
];

const languageOptions = [
  { choice_id: "1", choice_value: "Русский" },
  { choice_id: "2", choice_value: "Английский" },
  { choice_id: "3", choice_value: "Без слов" }
];

const explicitOptions = [
  { choice_id: "1", choice_value: "Да" },
  { choice_id: "2", choice_value: "Нет" }
];

const yesNoOptions = [
  { choice_id: "1", choice_value: "Да" },
  { choice_id: "2", choice_value: "Нет" }
];

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function DistributionPage() {
  const initialTrack = useCallback((): TrackRelease => ({
    id: generateId(),
    audio: null,
    trackName: "",
    mainArtists: "",
    previewStart: "00:30",
    musicAuthor: "",
    wordsAuthor: "",
    language: "0",
    explicit: "0",
    isFocusTrack: false,
    lyrics: null
  }), []);

  const [formData, setFormData] = useState<FormData>({
    releaseType: "0",
    title: "",
    artists: "",
    cover: null,
    releaseDate: "",
    genre: "0",
    otherGenre: "",
    contact: "",
    tracks: [initialTrack()],
    // Promo fields
    videoSnippetNeeded: '0',
    submitToPromo: '0',
    artistInfo: '',
    releaseInfo: '',
    releaseSupport: '',
    artistPhotosLink: '',
    specifySocialMedia: '0',
    vkLink: '',
    tiktokLink: '',
    youtubeLink: '',
    instagramLink: '',
    soundcloudLink: '',
    // Streaming links
    specifyStreamingLinks: '0',
    yandexMusicLink: '',
    spotifyLink: '',
    appleMusicLink: '',
    vkMusicLink: '',
    otherComments: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    document.title = 'Дистрибуция релиза | ROSSEL 66 MUSIC';
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

  const handleSelectChange = (name: keyof FormData, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [name]: value }
      // Clear hidden promo / social / streaming values when switching to «Нет»
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
    if (files && files[0]) {
      const label = name === "cover" ? "обложка" : name;
      if (!assertFileSize(files[0], label)) {
        e.target.value = "";
        return;
      }
      setSubmitStatus(null);
      setSubmitMessage("");
      setFormData((prev) => ({ ...prev, [name]: files[0] }));
    }
  };

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
          if (name === 'language' && (value === '0' || value === '3')) {
            updatedTrack.wordsAuthor = '';
          }
          return updatedTrack;
        }
        return track;
      }),
    }));
  };

  const handleTrackFileChange = (trackId: string, name: keyof Pick<TrackRelease, 'audio' | 'lyrics'>, files: FileList | null) => {
    if (files && files[0]) {
      const label = name === "audio" ? "аудио" : "текст трека";
      if (!assertFileSize(files[0], label)) return;
      setSubmitStatus(null);
      setSubmitMessage("");
      setFormData((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) =>
          track.id === trackId ? { ...track, [name]: files[0] } : track
        ),
      }));
    }
  };

  const handleTrackCheckboxChange = (trackId: string, name: keyof Pick<TrackRelease, 'isFocusTrack'>) => {
    setFormData(prev => ({
      ...prev,
      tracks: prev.tracks.map(track =>
        track.id === trackId ? { ...track, [name]: !track[name] } : track
      ),
    }));
  };

  const addTrackRow = () => {
    setFormData(prev => ({ ...prev, tracks: [...prev.tracks, initialTrack()] }));
  };

  const removeTrackRow = (trackId: string) => {
    if (formData.tracks.length > 1) {
      setFormData(prev => ({
        ...prev,
        tracks: prev.tracks.filter(track => track.id !== trackId),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Валидация основных полей релиза
    if (!formData.artists.trim()) {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо указать никнеймы артистов.');
      return;
    }
    
    if (!formData.title.trim()) {
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
    
    if (!formData.cover) {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо загрузить обложку.');
      return;
    }
    
    if (!formData.contact.trim()) {
      setSubmitStatus('error');
      setSubmitMessage('Ошибка: Необходимо указать контакт для связи (Телеграм или ВК).');
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
      
      if (!track.audio) {
        setSubmitStatus('error');
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
    setSubmitMessage('');
    setUploadProgress(0);

    const uploadId = self.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    const { cover, tracks, ...rest } = formData;

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

    if (cover) {
      files.push({
        fieldKey: "coverArtFile",
        file: cover,
        parentKind: "release",
        releaseIndex: 0,
      });
    }
    tracks.forEach((track, i) => {
      if (track.audio) {
        files.push({
          fieldKey: `track_${i}_audioFile`,
          file: track.audio,
          parentKind: "track",
          releaseIndex: 0,
          trackIndex: i,
        });
      }
      if (track.lyrics) {
        files.push({
          fieldKey: `track_${i}_lyricsFile`,
          file: track.lyrics,
          parentKind: "track",
          releaseIndex: 0,
          trackIndex: i,
        });
      }
    });

    const payload = pickPromoPayload(rest as Record<string, unknown>);

    try {
      await submitFormSession({
        uploadId,
        manifest: {
          formType: "distribution",
          title: formData.title,
          contact: formData.contact,
          artistNickname: formData.artists,
          releases: [
            {
              releaseTitle: formData.title,
              artists: formData.artists,
              releaseType: formData.releaseType,
              genre: formData.genre,
              otherGenre: formData.otherGenre,
              releaseDate: formData.releaseDate,
              tracks: releaseTracks,
            },
          ],
          payload,
          files,
        },
        onProgress: (p) => setUploadProgress(p.percent),
      });
      setSubmitStatus('success');
      setSubmitMessage('Спасибо! Данные успешно отправлены.');
      setFormData({
        releaseType: "0",
        title: "",
        artists: "",
        cover: null,
        releaseDate: "",
        genre: "0",
        otherGenre: "",
        contact: "",
        tracks: [initialTrack()],
        videoSnippetNeeded: '0',
        submitToPromo: '0',
        artistInfo: '',
        releaseInfo: '',
        releaseSupport: '',
        artistPhotosLink: '',
        specifySocialMedia: '0',
        vkLink: '',
        tiktokLink: '',
        youtubeLink: '',
        instagramLink: '',
        soundcloudLink: '',
        specifyStreamingLinks: '0',
        yandexMusicLink: '',
        spotifyLink: '',
        appleMusicLink: '',
        vkMusicLink: '',
        otherComments: '',
      });
    } catch (error) {
      console.error('Ошибка отправки:', error);
      setSubmitStatus('error');
      setSubmitMessage(
        error instanceof Error ? error.message : 'Ошибка отправки данных. Попробуйте еще раз.'
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const renderInputField = (
    name: keyof FormData | string,
    label: string,
    value: string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    placeholder: string = "",
    type: string = "text",
    required: boolean = true,
    className: string = ""
  ) => (
    <div className={`mb-4 ${className}`}>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="bg-white/5 border-white/20 text-white placeholder-gray-400 focus:ring-emerald-500 focus:border-emerald-500 hover:border-emerald-500 hover:border-opacity-40"
      />
    </div>
  );

  const renderSelectField = (
    name: keyof FormData | string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: { choice_id: string; choice_value: string }[],
    placeholder: string = "Не выбрано",
    required: boolean = true,
    className: string = ""
  ) => (
    <div className={`mb-4 ${className}`}>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Select value={value} onValueChange={onChange} required={required}>
        <SelectTrigger
          id={name as string}
          className="w-full bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 border-opacity-50 hover:border-emerald-500 hover:border-opacity-40"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-neutral-800 border-neutral-700 text-gray-200">
          <SelectItem value="0" disabled>{placeholder}</SelectItem>
          {options.map(opt => (
            <SelectItem key={opt.choice_id} value={opt.choice_id}>
              {opt.choice_value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const renderTextareaField = (
    name: keyof FormData,
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
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className="w-full bg-white/5 border border-white/20 text-white placeholder-gray-400 focus:ring-emerald-500 focus:border-emerald-500 hover:border-emerald-500 hover:border-opacity-40 px-3 py-2 rounded-md resize-vertical"
      />
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
    className: string = ""
  ) => {
    return (
      <div className={`mb-4 ${className}`}>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <label 
            htmlFor={id} 
            className="w-full h-10 flex items-center justify-between bg-white/5 border border-dashed border-white/20 hover:border-emerald-500 hover:border-opacity-40 transition-colors duration-200 cursor-pointer px-3 py-2 text-xs border-opacity-50"
        >
            <span className={`truncate max-w-[calc(100%-3rem)] ${currentFile ? 'text-white' : 'text-gray-400'}`}>
                {currentFile ? currentFile.name : "Выберите или перетащите файл"}
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
            required={required && !currentFile} 
            className="hidden" 
        />
      </div>
    );
  };

  return (
    <main 
      className="min-h-screen flex flex-col overflow-y-auto overflow-x-hidden bg-black/[0.96] antialiased bg-grid-white/[0.02] relative"
      style={{ fontFamily: "'Mulish', sans-serif" }}
    >
      <Navbar />
      <div className="flex-grow pt-20 pb-12 md:pt-24 md:pb-16 relative">
        <div className="h-full w-full fixed inset-0 z-0">
          <SparklesCore
            id="tsparticlesfullpage-distribution"
            background="transparent"
            minSize={0.9}
            maxSize={2.1}
            particleDensity={windowSize.width < 768 ? 100 : 180}
            className="w-full h-full"
            particleColor="#FFFFFF"
          />
        </div>
        <div className="relative z-10 container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10 md:mb-12"
          >
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Отправка релиза на дистрибуцию
            </h1>
            <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto"></div>
          </motion.div>

          <div className="max-w-6xl mx-auto shadow-2xl relative z-10">
            <form
              onSubmit={handleSubmit}
              noValidate
              data-testid="distribution-form"
              className="w-full h-full bg-neutral-990/60 backdrop-blur-sm p-6 sm:p-8 relative z-[1]"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderImageSource: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.5), rgba(20, 184, 166, 0.5), rgba(6, 182, 212, 0.5))',
                borderImageSlice: 1,
              }}
            >
              <h2 className="text-xl font-semibold text-white mb-6 border-b border-white/20 pb-3">
                Основная информация о релизе
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                {renderInputField("artists", "Никнеймы артистов (через запятую)", formData.artists, handleChange, "Artist1, Artist2", "text", true, "md:col-span-1")}
                {renderInputField("title", "Название релиза", formData.title, handleChange, "Название сингла/EP/альбома", "text", true, "md:col-span-1")}
                {renderSelectField("releaseType", "Тип релиза", formData.releaseType, (value) => handleSelectChange("releaseType", value), releaseTypeOptions, "Выберите тип", true, "md:col-span-1")}
                {renderInputField("releaseDate", "Планируемая дата релиза", formData.releaseDate, handleChange, "", "date", true, "md:col-span-1")}
                {renderSelectField("genre", "Жанр", formData.genre, (value) => handleSelectChange("genre", value), genreOptions, "Выберите жанр", true, "md:col-span-1")}
                {renderFileField("cover_input", "cover", "Обложка (3000x3000px, .jpg/.png)", handleFileChange, "image/jpeg,image/png", formData.cover || undefined, true, "md:col-span-1")}
                {formData.genre === "7" && 
                  renderInputField("otherGenre", "Уточните жанр", formData.otherGenre, handleChange, "Инди-фолк-рок", "text", true, "md:col-span-2")
                }
                {renderInputField("contact", "Телеграм или ВК для связи", formData.contact, handleChange, "Ссылка или ID", "text", true, "md:col-span-2")}
              </div>

              <div className="mt-10">
                <h3 className="text-lg font-semibold text-white mb-4">Трек-лист <span className="text-red-500">*</span></h3>
                <div className="overflow-x-auto overflow-y-visible">
                  <table className="min-w-full divide-y divide-neutral-700 border border-neutral-700">
                    <thead className="bg-neutral-800/50">
                      <tr>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">№</th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Аудио-файл <span className="text-red-500">*</span></th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Название трека <span className="text-red-500">*</span></th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Осн. исполнители <span className="text-red-500">*</span></th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Начало предпр. <span className="text-red-500">*</span></th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Автор музыки <span className="text-red-500">*</span></th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Автор слов
                          {formData.tracks.some(track => track.language === '1' || track.language === '2') && (
                            <span className="text-red-500">*</span>
                          )}
                        </th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Язык вокала <span className="text-red-500">*</span></th>
                        <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Мат <span className="text-red-500">*</span>
                        </th>
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
                                htmlFor={`track_audio_${track.id}`} 
                                className="w-full h-10 flex items-center justify-between bg-white/5 border border-dashed border-white/20 hover:border-emerald-500 hover:border-opacity-40 transition-colors duration-200 cursor-pointer rounded-md px-3 py-2 text-xs min-w-[150px] max-w-[200px]"
                            >
                                <span className={`truncate max-w-[calc(100%-3rem)] ${track.audio ? 'text-white' : 'text-gray-400'}`}>
                                    {track.audio ? track.audio.name : "Загрузить .wav"}
                                </span>
                                <div className="flex items-center justify-center w-6 h-6 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-md transition-colors duration-200 ml-1.5 flex-shrink-0">
                                    <UploadCloud className="w-3 h-3 text-emerald-400" />
                                </div>
                            </label>
                            <Input 
                              id={`track_audio_${track.id}`} 
                              name={`track_audio_form_name_${track.id}`}
                              type="file" 
                              onChange={(e) => handleTrackFileChange(track.id, 'audio', e.target.files)}
                              accept="audio/*"
                              required
                              className="hidden"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input name='trackName' value={track.trackName} onChange={(e) => handleTrackChange(track.id, e)} placeholder="Название трека" required className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[150px] hover:border-emerald-500 hover:border-opacity-40" />
                          </td>
                          <td className="py-2 px-3">
                            <Input name='mainArtists' value={track.mainArtists} onChange={(e) => handleTrackChange(track.id, e)} placeholder="Artist1, Artist2" required className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[150px] hover:border-emerald-500 hover:border-opacity-40" />
                          </td>
                          <td className="py-2 px-3">
                            <Input name='previewStart' value={track.previewStart} onChange={(e) => handleTrackChange(track.id, e)} placeholder="00:30" required className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[100px] hover:border-emerald-500 hover:border-opacity-40" />
                          </td>
                          <td className="py-2 px-3">
                            <Input name='musicAuthor' value={track.musicAuthor} onChange={(e) => handleTrackChange(track.id, e)} placeholder="Полное ФИО" required className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[150px] hover:border-emerald-500 hover:border-opacity-40" />
                          </td>
                          <td className="py-2 px-3">
                            <Input 
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
                                {languageOptions.map(opt => <SelectItem key={opt.choice_id} value={opt.choice_id}>{opt.choice_value}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-3 min-w-[120px]">
                            <div className="relative group">
                              <Select value={track.explicit} onValueChange={(value) => handleTrackSelectChange(track.id, 'explicit', value)} required>
                                <SelectTrigger className="w-full bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 border-opacity-50 hover:border-emerald-500 hover:border-opacity-40">
                                  <SelectValue placeholder="Да/Нет" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-800 border-neutral-700 text-gray-200">
                                  <SelectItem value="0" disabled>Да/Нет</SelectItem>
                                  {explicitOptions.map(opt => <SelectItem key={opt.choice_id} value={opt.choice_id}>{opt.choice_value}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/40 text-white text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] whitespace-nowrap border border-emerald-500/50 backdrop-blur-sm pointer-events-none">
                                Если в треке используются слова "bitch", "fuck", "shit", "nigga", "hoe", "ass", то укажите Explicit. Русский мат аналогично.
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/40"></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Checkbox id={`track_isFocusTrack_${track.id}`} name="isFocusTrack" checked={track.isFocusTrack} onCheckedChange={() => handleTrackCheckboxChange(track.id, 'isFocusTrack')} className="border-gray-400 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-600 self-center hover:border-emerald-500 hover:border-opacity-40" />
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <label 
                                htmlFor={`track_lyrics_${track.id}`} 
                                className="w-full h-10 flex items-center justify-between bg-white/5 border border-dashed border-white/20 hover:border-emerald-500 hover:border-opacity-40 transition-colors duration-200 cursor-pointer rounded-md px-3 py-2 text-xs min-w-[150px] max-w-[200px]"
                            >
                                <span className={`truncate max-w-[calc(100%-3rem)] ${track.lyrics ? 'text-white' : 'text-gray-400'}`}>
                                    {track.lyrics ? track.lyrics.name : "Текст (необяз.)"}
                                </span>
                                <div className="flex items-center justify-center w-6 h-6 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-md transition-colors duration-200 ml-1.5 flex-shrink-0">
                                    <UploadCloud className="w-3 h-3 text-emerald-400" />
                                </div>
                            </label>
                             <Input 
                              id={`track_lyrics_${track.id}`} 
                              name={`track_lyrics_form_name_${track.id}`}
                              type="file" 
                              onChange={(e) => handleTrackFileChange(track.id, 'lyrics', e.target.files)}
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