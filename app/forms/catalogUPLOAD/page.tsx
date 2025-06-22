"use client"

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SparklesCore } from "@/components/sparkles";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { PlusCircle, Trash2, ChevronDown, ChevronUp, UploadCloud } from "lucide-react";

// --- Interfaces for State Management ---
interface Track {
  id: string;
  audioFile?: File;
  trackName: string;
  mainArtists: string;
  isrc: string;
  previewStart: string;
  musicAuthor: string;
  wordsAuthor: string;
  language: string;
  explicit: boolean;
  lyricsFile?: File;
  isFocusTrack: boolean;
}

interface Release {
  id: string;
  releaseType: string;
  releaseTitle: string;
  artists: string;
  coverArt?: File;
  upc: string;
  originalReleaseDate: string;
  genre: string;
  otherGenre: string;
  tracks: Track[];
  isExpanded: boolean;
}

interface FormDataCatalogUpload {
  releases: Release[];
}

// --- Options based on Pyrus Form 2312633 ---
const releaseTypeOptions = [
  { choice_id: "1", choice_value: "Сингл" },
  { choice_id: "2", choice_value: "Альбом" },
];

const languageOptions = [
  { choice_id: "1", choice_value: "Русский" },
  { choice_id: "2", choice_value: "Английский" },
  { choice_id: "3", choice_value: "Без слов" },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function CatalogUploadPage() {
  const initialTrack = (): Track => ({
    id: generateId(),
    trackName: "",
    mainArtists: "",
    isrc: "",
    previewStart: "00:30",
    musicAuthor: "",
    wordsAuthor: "",
    language: "0",
    explicit: false,
    isFocusTrack: false,
  });

  const initialRelease = (): Release => ({
    id: generateId(),
    releaseType: "0",
    releaseTitle: "",
    artists: "",
    upc: "",
    originalReleaseDate: "",
    genre: "",
    otherGenre: "",
    tracks: [initialTrack()],
    isExpanded: true,
  });

  const [formData, setFormData] = useState<FormDataCatalogUpload>({
    releases: [initialRelease()],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  useEffect(() => {
    document.title = 'Перенос каталога | ROSSEL 66 MUSIC';
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // --- Handlers for Releases ---
  const handleReleaseChange = (releaseId: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      releases: prev.releases.map(release =>
        release.id === releaseId ? { ...release, [name]: value } : release
      ),
    }));
  };

  const handleReleaseSelectChange = (releaseId: string, name: keyof Pick<Release, 'releaseType' | 'genre'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      releases: prev.releases.map(release =>
        release.id === releaseId ? { ...release, [name]: value } : release
      ),
    }));
  };

  const handleReleaseFileChange = (releaseId: string, name: 'coverArt', files: FileList | null) => {
    if (files && files[0]) {
      setFormData(prev => ({
        ...prev,
        releases: prev.releases.map(release =>
          release.id === releaseId ? { ...release, [name]: files[0] } : release
        ),
      }));
    }
  };

  const toggleReleaseExpansion = (releaseId: string) => {
    setFormData(prev => ({
      ...prev,
      releases: prev.releases.map(release =>
        release.id === releaseId ? { ...release, isExpanded: !release.isExpanded } : release
      ),
    }));
  };

  const addRelease = () => {
    setFormData(prev => ({
      ...prev,
      releases: [...prev.releases, initialRelease()],
    }));
  };

  const removeRelease = (releaseId: string) => {
    setFormData(prev => ({
        ...prev,
        releases: prev.releases.filter(release => release.id !== releaseId),
    }));
  };

  // --- Handlers for Tracks Table ---
  const handleTrackChange = (releaseId: string, trackId: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      releases: prev.releases.map(release =>
        release.id === releaseId
          ? {
              ...release,
              tracks: release.tracks.map(track =>
                track.id === trackId ? { ...track, [name]: value } : track
              ),
            }
          : release
      ),
    }));
  };

  const handleTrackSelectChange = (releaseId: string, trackId: string, name: keyof Pick<Track, 'language'>, value: string) => {
     setFormData(prev => ({
      ...prev,
      releases: prev.releases.map(release =>
        release.id === releaseId
          ? {
              ...release,
              tracks: release.tracks.map(track => {
                if (track.id === trackId) {
                  const updatedTrack = { ...track, [name]: value };
                  if (name === 'language' && (value === '0' || value === '3')) {
                    updatedTrack.wordsAuthor = '';
                  }
                  return updatedTrack;
                }
                return track;
              }),
            }
          : release
      ),
    }));
  };
  
  const handleTrackCheckboxChange = (releaseId: string, trackId: string, name: keyof Pick<Track, 'explicit' | 'isFocusTrack'>) => {
    setFormData(prev => ({
        ...prev,
        releases: prev.releases.map(release =>
            release.id === releaseId
            ? {
                ...release,
                tracks: release.tracks.map(track =>
                    track.id === trackId ? { ...track, [name]: !track[name] } : track
                ),
                }
            : release
        ),
    }));
  };

  const handleTrackFileChange = (releaseId: string, trackId: string, name: 'audioFile' | 'lyricsFile', files: FileList | null) => {
    if (files && files[0]) {
      setFormData(prev => ({
        ...prev,
        releases: prev.releases.map(release =>
          release.id === releaseId
            ? {
                ...release,
                tracks: release.tracks.map(track =>
                  track.id === trackId ? { ...track, [name]: files[0] } : track
                ),
              }
            : release
        ),
      }));
    }
  };

  const addTrack = (releaseId: string) => {
    setFormData(prev => ({
      ...prev,
      releases: prev.releases.map(release =>
        release.id === releaseId
          ? { ...release, tracks: [...release.tracks, initialTrack()] }
          : release
      ),
    }));
  };

  const removeTrack = (releaseId: string, trackId: string) => {
    setFormData(prev => ({
      ...prev,
      releases: prev.releases.map(release =>
        release.id === releaseId
          ? { ...release, tracks: release.tracks.filter(track => track.id !== trackId) }
          : release
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);
    setSubmitMessage("");
    setUploadProgress(0);

    // 1. Create a deep copy and remove file objects for JSON payload
    const releasesForJson = formData.releases.map(release => {
      const { coverArt, tracks, ...restOfRelease } = release;
      const cleanedTracks = tracks.map(track => {
        const { audioFile, lyricsFile, ...restOfTrack } = track;
        return restOfTrack;
      });
      return { ...restOfRelease, tracks: cleanedTracks };
    });

    const submissionData = new FormData();
    submissionData.append('form_data_json', JSON.stringify(releasesForJson));

    // 2. Append files with indexed keys
    formData.releases.forEach((release, releaseIndex) => {
      if (release.coverArt) {
        submissionData.append(`release_${releaseIndex}_coverArt`, release.coverArt);
      }
      release.tracks.forEach((track, trackIndex) => {
        if (track.audioFile) {
          submissionData.append(`release_${releaseIndex}_track_${trackIndex}_audioFile`, track.audioFile);
        }
        if (track.lyricsFile) {
          submissionData.append(`release_${releaseIndex}_track_${trackIndex}_lyricsFile`, track.lyricsFile);
        }
      });
    });
    
    const uploadId = self.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    submissionData.append('upload_id', uploadId);
    const es = new EventSource(`/api/upload-progress/${uploadId}`);
    es.onmessage = (ev) => {
      const p = parseInt(ev.data, 10);
      if (!isNaN(p)) setUploadProgress(p);
    };
    es.onerror = () => { es.close(); };
    setEventSource(es);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/submit-pyrus-catalog-upload');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        setIsSubmitting(false);
        setUploadProgress(0);
        try {
          const result = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            setSubmitStatus('success');
            setSubmitMessage('Спасибо! Данные успешно отправлены.');
        setFormData({ releases: [initialRelease()] }); 
      } else {
            setSubmitStatus('error');
            setSubmitMessage(result.message || 'Ошибка при отправке данных.');
          }
        } catch (_) {
          setSubmitStatus('error');
          setSubmitMessage('Ошибка обработки ответа сервера.');
        }
        if (eventSource) eventSource.close();
      };

      xhr.onerror = () => {
        setIsSubmitting(false);
        setUploadProgress(0);
        setSubmitStatus('error');
        setSubmitMessage('Произошла сетевая ошибка. Пожалуйста, попробуйте снова.');
        if (eventSource) eventSource.close();
      };

      xhr.send(submissionData);
    } catch (error) {
      console.error('Client-side submission error:', error);
      setIsSubmitting(false);
      setUploadProgress(0);
      setSubmitStatus('error');
      setSubmitMessage('Произошла ошибка при отправке.');
      if (eventSource) eventSource.close();
    }
  };
  
  const renderInputField = (
    idPrefix: string,
    name: string, 
    label: string,
    value: string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
    placeholder: string = "",
    type: string = "text",
    required: boolean = true,
    isTextArea: boolean = false,
    className: string = "",
    disabled: boolean = false
  ) => (
    <div className={`mb-4 ${className}`}>
      <label htmlFor={idPrefix} className="block text-sm font-medium text-gray-300 mb-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {isTextArea ? (
        <Textarea
          id={idPrefix}
          name={name}
          value={value as string}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full"
          rows={4}
          disabled={disabled}
        />
      ) : (
        <Input
          id={idPrefix}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full hover:border-emerald-500/60 disabled:bg-neutral-800 disabled:border-neutral-700 disabled:cursor-not-allowed"
          disabled={disabled}
        />
      )}
    </div>
  );

 const renderSelectField = (
    idPrefix: string,
    name: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: { choice_id: string; choice_value: string }[],
    placeholder: string = "Не выбрано",
    required: boolean = true,
    className: string = "",
    disabled: boolean = false
  ) => (
    <div className={`mb-4 ${className}`}>
      <label htmlFor={`${idPrefix}_${name}`} className="block text-sm font-medium text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Select value={value} onValueChange={onChange} required={required} disabled={disabled}>
        <SelectTrigger id={`${idPrefix}_${name}`} className="w-full bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 border-opacity-50 hover:border-emerald-500 hover:border-opacity-40">
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
    idPrefix: string,
    name: string, 
    label: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    accept: string,
    currentFile?: File,
    required: boolean = true,
    className: string = ""
  ) => {
    const inputId = `${idPrefix}_${name}`;
    return (
      <div className={`mb-4 ${className}`}>
        {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-300 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        )}
        <label 
            htmlFor={inputId} 
            className="w-full h-10 flex items-center justify-between bg-white/5 border border-dashed border-white/20 transition-colors duration-200 cursor-pointer px-3 py-2 text-sm border-opacity-50 hover:border-emerald-500 hover:border-opacity-40"
        >
            <span className={`truncate max-w-[calc(100%-4rem)] ${currentFile ? 'text-white' : 'text-gray-400'}`}>
                {currentFile ? currentFile.name : "Выберите или перетащите файл"}
            </span>
            <div className="flex items-center justify-center w-7 h-7 bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors duration-200 ml-2 flex-shrink-0 border-opacity-50">
                <UploadCloud className="w-3 h-3 text-emerald-400" />
            </div>
        </label>
        <Input 
            id={inputId}
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

  const renderCheckboxField = (
    idPrefix: string,
    name: string,
    label: string,
    checked: boolean,
    onCheckedChange: () => void, 
    className: string = ""
) => (
    <div className={`flex items-center space-x-2 mb-4 ${className}`}>
        <Checkbox id={`${idPrefix}_${name}`} name={name} checked={checked} onCheckedChange={onCheckedChange} className="border-gray-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-600 border-opacity-50 hover:border-emerald-500 hover:border-opacity-40" />
        <label htmlFor={`${idPrefix}_${name}`} className="text-sm font-medium text-gray-300 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
        </label>
    </div>
);

  return (
    <main 
      className="min-h-screen flex flex-col overflow-y-auto overflow-x-hidden bg-black/[0.96] antialiased bg-grid-white/[0.02] relative"
      style={{ fontFamily: "'Mulish', sans-serif" }}
    >
      <Navbar />
      <div className="flex-grow pt-20 pb-12 md:pt-24 md:pb-16 relative">
        <div className="h-full w-full fixed inset-0 z-0">
          <SparklesCore
            id="tsparticlesfullpage-catalogupload"
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
              Отгрузка бэк-каталога
            </h1>
            <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto"></div>
          </motion.div>

          <div className="max-w-6xl mx-auto shadow-2xl relative z-10">
            <form
              onSubmit={handleSubmit}
              className="w-full h-full bg-neutral-950/60 backdrop-blur-[2px] p-6 sm:p-8 relative z-[1]"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderImageSource: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.5), rgba(20, 184, 166, 0.5), rgba(6, 182, 212, 0.5))',
                borderImageSlice: 1,
              }}
            >
              {formData.releases.map((release, releaseIndex) => (
                <div key={release.id} className="mb-8 p-4 border border-neutral-700 bg-neutral-900/50">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-white">
                      Релиз {releaseIndex + 1}
                    </h2>
                    <div className="flex items-center space-x-2">
                        {formData.releases.length > 1 && (
                            <Button 
                                type="button" 
                                onClick={() => removeRelease(release.id)} 
                                variant="ghost" 
                                size="icon" 
                                className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        <Button 
                            type="button" 
                            onClick={() => toggleReleaseExpansion(release.id)} 
                            variant="ghost" 
                            size="icon"
                            className="text-gray-400 hover:text-white"
                        >
                            {release.isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </Button>
                    </div>
                  </div>
                  
                  {renderSelectField(
                      release.id,
                      "releaseType", 
                      "Тип релиза", 
                      release.releaseType, 
                      (value) => handleReleaseSelectChange(release.id, 'releaseType', value), 
                      releaseTypeOptions,
                      "Не выбрано",
                      true,
                      "md:col-span-2 mb-6"
                  )}

                  {release.isExpanded && (
                    <div className="mt-6">
                       <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                        {renderInputField(
                              `${release.id}_releaseTitle`,
                            "releaseTitle", 
                            "Название релиза", 
                            release.releaseTitle, 
                            (e) => handleReleaseChange(release.id, e), 
                              "Название вашего сингла или альбома"
                        )}
                            {renderInputField(
                              `${release.id}_artists`,
                                "artists", 
                                "Никнеймы артистов релиза", 
                                release.artists, 
                                (e) => handleReleaseChange(release.id, e), 
                              "Artist1, Artist2"
                            )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                            {renderInputField(
                              `${release.id}_upc`,
                                "upc", 
                                "UPC/EAN (если есть)", 
                                release.upc, 
                                (e) => handleReleaseChange(release.id, e), 
                              "123456789012",
                              "text",
                              false
                            )}
                            {renderInputField(
                              `${release.id}_originalReleaseDate`,
                                "originalReleaseDate", 
                                "Оригинальная дата релиза", 
                                release.originalReleaseDate, 
                                (e) => handleReleaseChange(release.id, e), 
                              "",
                              "date"
                            )}
                      </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
                            {renderFileField(
                              `${release.id}_coverArt`,
                                "coverArt", 
                                "Обложка (3000x3000, JPG/PNG)", 
                                (e) => handleReleaseFileChange(release.id, 'coverArt', e.target.files), 
                              "image/jpeg, image/png",
                              release.coverArt
                          )}
                           {renderInputField(
                              `${release.id}_genre`,
                              "genre", 
                              "Жанр", 
                              release.genre, 
                              (e) => handleReleaseChange(release.id, e),
                              "Hip-hop, Pop, Rock..."
                            )}
                        </div>

                      <h3 className="text-lg font-semibold text-white mt-8 mb-4 border-t border-neutral-800 pt-6">
                        Трек-лист *
                      </h3>
                      
                      {/* Desktop Table - EXACT COPY FROM RELEASE UPLOAD */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-neutral-700 border border-neutral-700 rounded-lg text-sm text-left">
                            <thead className="bg-neutral-800/50">
                                <tr>
                                    <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-10">№</th>
                                    <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[15%]">Аудио-файл <span className="text-red-500">*</span></th>
                                    {release.releaseType === '2' && <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Название трека <span className="text-red-500">*</span></th>}
                                    {release.releaseType === '2' && <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Осн. исполнители <span className="text-red-500">*</span></th>}
                                    <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ISRC <span className="text-red-500">*</span></th>
                                    <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Начало предпр. <span className="text-red-500">*</span></th>
                                    <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Автор музыки <span className="text-red-500">*</span></th>
                                    <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Автор слов</th>
                                    <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Язык <span className="text-red-500">*</span></th>
                                    <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Мат</th>
                                    {release.releaseType === '2' && <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Фокус</th>}
                                    <th scope="col" className="py-3 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[15%]">Текст трека</th>
                                    <th scope="col" className="py-3 px-1 text-center text-xs font-medium text-gray-300 uppercase tracking-wider w-12"><span className="sr-only">Удалить</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-neutral-900/70 divide-y divide-neutral-700/70">
                                {release.tracks.map((track, trackIndex) => (
                                    <tr key={track.id}>
                                        <td className="py-2 px-3 text-sm text-gray-400">{trackIndex + 1}</td>
                                        <td className="px-3 py-2 align-top">
                                            {renderFileField(`${track.id}_audioFile`, "audioFile", "", (e) => handleTrackFileChange(release.id, track.id, 'audioFile', e.target.files), ".wav", track.audioFile, true, "mb-0")}
                                        </td>
                                        {release.releaseType === '2' && (
                                            <td className="px-3 py-2 align-top">
                                                <Input name="trackName" value={track.trackName} onChange={(e) => handleTrackChange(release.id, track.id, e)} placeholder="Название" required className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[150px] hover:border-emerald-500 hover:border-opacity-40" />
                                            </td>
                                        )}
                                        {release.releaseType === '2' && (
                                            <td className="px-3 py-2 align-top">
                                                <Input name="mainArtists" value={track.mainArtists} onChange={(e) => handleTrackChange(release.id, track.id, e)} placeholder="Artist1, Artist2" required className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[150px] hover:border-emerald-500 hover:border-opacity-40" />
                                            </td>
                                        )}
                                        <td className="px-3 py-2 align-top">
                                            <Input name="isrc" value={track.isrc} onChange={(e) => handleTrackChange(release.id, track.id, e)} placeholder="XX-XXX-YY-NNNNN" required className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[150px] hover:border-emerald-500 hover:border-opacity-40" />
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <Input name="previewStart" value={track.previewStart} onChange={(e) => handleTrackChange(release.id, track.id, e)} placeholder="00:30" required className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-24 min-w-[100px] hover:border-emerald-500 hover:border-opacity-40" />
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <Input name="musicAuthor" value={track.musicAuthor} onChange={(e) => handleTrackChange(release.id, track.id, e)} placeholder="Иванов И.И." required className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[150px] hover:border-emerald-500 hover:border-opacity-40" />
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                           <Input 
                                              name="wordsAuthor" 
                                              value={track.wordsAuthor} 
                                              onChange={(e) => handleTrackChange(release.id, track.id, e)} 
                                              placeholder="Петров П.П." 
                                              required={track.language === '1' || track.language === '2'}
                                              disabled={!(track.language === '1' || track.language === '2')}
                                              className="bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 w-full min-w-[150px] hover:border-emerald-500 hover:border-opacity-40 disabled:bg-neutral-800 disabled:border-neutral-700 disabled:cursor-not-allowed" 
                                            />
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <Select value={track.language} onValueChange={(value) => handleTrackSelectChange(release.id, track.id, 'language', value)} required>
                                              <SelectTrigger className="w-full bg-white/5 border-white/20 text-white focus:ring-emerald-500 focus:border-emerald-500 border-opacity-50 hover:border-emerald-500 hover:border-opacity-40"><SelectValue placeholder="Не выбрано" /></SelectTrigger>
                                              <SelectContent className="bg-neutral-800 border-neutral-700 text-gray-200">
                                                  <SelectItem value="0" disabled>Не выбрано</SelectItem>
                                                  {languageOptions.map(opt => <SelectItem key={opt.choice_id} value={opt.choice_id}>{opt.choice_value}</SelectItem>)}
                                              </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            <Checkbox name="explicit" checked={track.explicit} onCheckedChange={() => handleTrackCheckboxChange(release.id, track.id, 'explicit')} className="border-gray-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-600" />
                                        </td>
                                        {release.releaseType === '2' && (
                                          <td className="py-2 px-3 text-center">
                                              <Checkbox name="isFocusTrack" checked={track.isFocusTrack} onCheckedChange={() => handleTrackCheckboxChange(release.id, track.id, 'isFocusTrack')} className="border-gray-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-600" />
                                          </td>
                                        )}
                                        <td className="px-3 py-2 align-top">
                                            {renderFileField(`${track.id}_lyricsFile`, "lyricsFile", "", (e) => handleTrackFileChange(release.id, track.id, 'lyricsFile', e.target.files), ".txt,.doc,.docx", track.lyricsFile, false, "mb-0")}
                                        </td>
                                        <td className="px-2 py-3 align-middle text-right">
                                            {release.tracks.length > 1 && (
                                                <Button type="button" onClick={() => removeTrack(release.id, track.id)} variant="ghost" size="icon" className="text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-full">
                                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                            </div>

                      {/* Mobile Cards */}
                      <div className="md:hidden space-y-4">
                            {release.tracks.map((track, trackIndex) => (
                            <div key={track.id} className="p-4 border border-neutral-700/80 rounded-lg bg-neutral-900/60">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-semibold text-white">Трек {trackIndex + 1}</h4>
                                {release.tracks.length > 1 && (
                                        <Button type="button" onClick={() => removeTrack(release.id, track.id)} variant="ghost" size="icon" className="text-red-500 hover:text-red-400 hover:bg-red-500/10 -mr-2 -mt-2">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                                </div>
                                {release.releaseType === '2' && renderInputField(`${track.id}_mob_trackName`, "trackName", "Название трека", track.trackName, (e) => handleTrackChange(release.id, track.id, e), "Название трека")}
                                {release.releaseType === '2' && renderInputField(`${track.id}_mob_mainArtists`, "mainArtists", "Артисты", track.mainArtists, (e) => handleTrackChange(release.id, track.id, e), "Артисты трека")}
                                {renderFileField(`${track.id}_mob_audioFile`, "audioFile", "Аудиофайл (.wav)", (e) => handleTrackFileChange(release.id, track.id, 'audioFile', e.target.files), ".wav", track.audioFile)}
                                {renderInputField(`${track.id}_mob_isrc`, "isrc", "ISRC", track.isrc, (e) => handleTrackChange(release.id, track.id, e), "XX-XXX-YY-NNNNN")}
                                {renderInputField(`${track.id}_mob_musicAuthor`, "musicAuthor", "Автор музыки", track.musicAuthor, (e) => handleTrackChange(release.id, track.id, e), "Автор музыки")}
                                {renderInputField(
                                  `${track.id}_mob_wordsAuthor`, 
                                  "wordsAuthor", 
                                  "Автор слов", 
                                  track.wordsAuthor, 
                                  (e) => handleTrackChange(release.id, track.id, e), 
                                  "Автор слов",
                                  "text",
                                  track.language === '1' || track.language === '2',
                                  false,
                                  `disabled:opacity-50 disabled:cursor-not-allowed`
                                )}
                                {renderSelectField(`${track.id}_mob_language`, "language", "Язык", track.language, (value) => handleTrackSelectChange(release.id, track.id, 'language', value), languageOptions, "Язык")}
                                {renderInputField(`${track.id}_mob_previewStart`, "previewStart", "Начало предпрослушивания", track.previewStart, (e) => handleTrackChange(release.id, track.id, e), "00:30")}
                                {renderFileField(`${track.id}_mob_lyricsFile`, "lyricsFile", "Текст трека (.txt, .doc)", (e) => handleTrackFileChange(release.id, track.id, 'lyricsFile', e.target.files), ".txt,.doc,.docx", track.lyricsFile, false)}
                                <div className="flex flex-col space-y-3 mt-4">
                                    {renderCheckboxField(`${track.id}_mob_explicit`, "explicit", "Содержит ненормативную лексику", track.explicit, () => handleTrackCheckboxChange(release.id, track.id, 'explicit'))}
                                    {release.releaseType === '2' && renderCheckboxField(`${track.id}_mob_isFocusTrack`, "isFocusTrack", "Это фокус-трек альбома", track.isFocusTrack, () => handleTrackCheckboxChange(release.id, track.id, 'isFocusTrack'))}
                                </div>
                            </div>
                        ))}
                      </div>

                      <div className="mt-4 flex justify-start">
                        <Button type="button" onClick={() => addTrack(release.id)} variant="default" className="bg-neutral-800 text-emerald-500 border border-neutral-700 hover:bg-neutral-700 hover:text-emerald-400">
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Добавить трек
                        </Button>
                      </div>

                    </div>
                  )}
                </div>
              ))}
              
              <div className="mt-6 text-center">
                <Button
                    type="button"
                    onClick={addRelease}
                    variant="default"
                  className="bg-neutral-800 text-emerald-500 border border-neutral-700 hover:bg-neutral-700 hover:text-emerald-400 px-6 py-2.5 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={formData.releases.length >= 5}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Добавить еще релиз
                </Button>
                {formData.releases.length >= 5 && (
                  <p className="text-sm text-gray-400 mt-3 max-w-md mx-auto">
                    За раз можно отправить до 5 релизов. Чтобы добавить больше, отправьте текущую форму и создайте новую.
                  </p>
                )}
              </div>
              
              {isSubmitting && (
                <div className="w-full flex items-center justify-center mt-4 mb-6 space-x-3 text-gray-400 text-sm">
                  <svg className="animate-spin h-5 w-5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  <span>Загрузка файлов, это может занять несколько минут…</span>
                </div>
              )}

              {submitStatus && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`mt-6 p-3 rounded-md text-sm ${
                    submitStatus === "success"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {submitMessage}
                </motion.div>
              )}
              <div className="mt-10 text-center md:col-span-2">
                <Button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-md text-base font-semibold shadow-[0_0_15px_rgba(16,185,129,0.31)] transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.44)]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Отправка..." : "Отправить данные каталога"}
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