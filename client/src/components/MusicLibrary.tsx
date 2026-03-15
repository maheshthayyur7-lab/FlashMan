
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Music, Upload, Play, Square, Trash2, Loader2, Music2,
  Plus, FileJson, FileAudio, X, ChevronDown, ChevronUp, Clock
} from "lucide-react";
import { GlowButton } from "./GlowButton";
import { useToast } from "@/hooks/use-toast";
import { type Song } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

interface MusicLibraryProps {
  eventId: number;
  onPlayEffect: (effect: any) => void;
  onNowPlaying?: (title: string | null) => void;
}

interface Section {
  id: string;
  songFile: File | null;
  jsonFile: File | null;
  title: string;
  isUploading: boolean;
  isExpanded: boolean;
}

function createSection(): Section {
  return {
    id: crypto.randomUUID(),
    songFile: null,
    jsonFile: null,
    title: "",
    isUploading: false,
    isExpanded: true,
  };
}

export function MusicLibrary({ eventId, onPlayEffect, onNowPlaying }: MusicLibraryProps) {
  const [sections, setSections] = useState<Section[]>([createSection()]);
  const [playingSongId, setPlayingSongId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0); // 0–1
  const [duration, setDuration] = useState(0);
  const [previewSongId, setPreviewSongId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: songs = [], isLoading } = useQuery<Song[]>({
    queryKey: ["/api/events", eventId, "songs"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (songData: any) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/songs`, songData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "songs"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (songId: number) => {
      await apiRequest("DELETE", `/api/events/${eventId}/songs/${songId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "songs"] });
      toast({ title: "Song removed" });
    },
  });

  const updateSection = (id: string, updates: Partial<Section>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const addSection = () => setSections((prev) => [...prev, createSection()]);
  const removeSection = (id: string) => setSections((prev) => prev.filter((s) => s.id !== id));

  const handleSongFile = (sectionId: string, file: File) => {
    updateSection(sectionId, { songFile: file, title: file.name.replace(/\.[^/.]+$/, "") });
  };

  const handleJsonFile = (sectionId: string, file: File) => {
    updateSection(sectionId, { jsonFile: file });
  };

  const uploadSection = async (section: Section) => {
    if (!section.songFile || !section.jsonFile) {
      toast({ title: "Both files required", description: "Select a song and a JSON timing file.", variant: "destructive" });
      return;
    }
    updateSection(section.id, { isUploading: true });
    try {
      const jsonText = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = (e) => resolve(e.target?.result as string);
        r.onerror = reject;
        r.readAsText(section.jsonFile!);
      });

      let syncData: any[];
      try {
        syncData = JSON.parse(jsonText);
        if (!Array.isArray(syncData)) throw new Error();
      } catch {
        toast({ title: "Invalid JSON", description: 'Must be an array: [{"time":1000,"action":"on"},...]', variant: "destructive" });
        updateSection(section.id, { isUploading: false });
        return;
      }

      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = (e) => {
          const result = e.target?.result as string;
          if (result.length > 50 * 1024 * 1024) reject(new Error("File too large (max 50MB)"));
          else resolve(result);
        };
        r.onerror = reject;
        r.readAsDataURL(section.songFile!);
      });

      await uploadMutation.mutateAsync({
        title: section.title || section.songFile.name.replace(/\.[^/.]+$/, ""),
        artist: "Unknown Artist",
        url: audioBase64,
        syncData,
        duration: 0,
      });

      toast({ title: "Section uploaded!", description: `"${section.title}" loaded with ${syncData.length} timing events.` });
      updateSection(section.id, { isUploading: false, songFile: null, jsonFile: null, title: "", isExpanded: false });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Something went wrong.", variant: "destructive" });
      updateSection(section.id, { isUploading: false });
    }
  };

  const stopCurrentSong = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onpause = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    onPlayEffect({ type: "TORCH_OFF" });
    onNowPlaying?.(null);
    setPlayingSongId(null);
    setProgress(0);
    setDuration(0);
  };

  const handlePlaySong = (song: Song) => {
    stopCurrentSong();
    toast({ title: `Playing: ${song.title}`, description: "Synchronizing flashlights…" });

    const audio = new Audio(song.url);
    audioRef.current = audio;
    setPlayingSongId(song.id);
    onNowPlaying?.(song.title);

    audio.onloadedmetadata = () => {
      setDuration(audio.duration);
    };

    audio.onplay = () => {
      const syncData = song.syncData as Array<{ time: number; action: "on" | "off" }>;
      syncData.forEach((item) => {
        const timeout = setTimeout(() => {
          onPlayEffect({ type: item.action === "on" ? "TORCH_ON" : "TORCH_OFF", duration: 200 });
        }, item.time);
        timeoutsRef.current.push(timeout);
      });

      progressIntervalRef.current = setInterval(() => {
        if (audioRef.current) {
          const dur = audioRef.current.duration || 1;
          setProgress(audioRef.current.currentTime / dur);
        }
      }, 300);
    };

    const cleanup = () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      onPlayEffect({ type: "TORCH_OFF" });
      onNowPlaying?.(null);
      setPlayingSongId(null);
      setProgress(0);
      audioRef.current = null;
    };

    audio.onended = cleanup;
    audio.onpause = cleanup;
    audio.play();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Music className="w-5 h-5 text-primary" />
          Music Sync Library
        </h3>
      </div>

      {/* Upload Sections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Each section = one song + one JSON timing file</p>
          <GlowButton variant="secondary" size="sm" className="flex items-center gap-2" onClick={addSection} data-testid="button-add-section">
            <Plus className="w-4 h-4" /> Add Section
          </GlowButton>
        </div>

        {sections.map((section, index) => (
          <Card key={section.id} className="glass-panel border-white/10 bg-white/5 overflow-hidden" data-testid={`card-section-${section.id}`}>
            <div
              className="flex items-center justify-between p-4 cursor-pointer select-none"
              onClick={() => updateSection(section.id, { isExpanded: !section.isExpanded })}
            >
              <span className="text-sm font-semibold text-white">
                Section {index + 1}
                {section.title && <span className="ml-2 text-primary font-normal">— {section.title}</span>}
              </span>
              <div className="flex items-center gap-2">
                {sections.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSection(section.id); }}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                    data-testid={`button-remove-section-${section.id}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {section.isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>

            {section.isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-4">
                <FilePickerRow label="Song File" accept="audio/*" icon={<FileAudio className="w-4 h-4 text-primary" />} file={section.songFile} testId={`input-song-${section.id}`} onFileSelect={(f) => handleSongFile(section.id, f)} />
                <FilePickerRow label="Flashlight Timing (JSON)" accept=".json,application/json" icon={<FileJson className="w-4 h-4 text-yellow-400" />} file={section.jsonFile} testId={`input-json-${section.id}`} onFileSelect={(f) => handleJsonFile(section.id, f)} hint='Format: [{"time": 1000, "action": "on"}, {"time": 2000, "action": "off"}]' />
                <div className="pt-1">
                  <GlowButton
                    variant="primary" size="sm" className="w-full flex items-center justify-center gap-2"
                    onClick={() => uploadSection(section)}
                    disabled={section.isUploading || !section.songFile || !section.jsonFile}
                    data-testid={`button-upload-section-${section.id}`}
                  >
                    {section.isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload Section</>}
                  </GlowButton>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Uploaded Songs */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Uploaded Songs</h4>
        <div className="grid grid-cols-1 gap-3">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : songs.length === 0 ? (
            <div className="text-center p-10 glass-panel rounded-2xl border-dashed border-2 border-white/10">
              <Music2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground text-sm">No songs uploaded yet</p>
            </div>
          ) : (
            songs.map((song) => {
              const syncData = Array.isArray(song.syncData) ? (song.syncData as Array<{ time: number; action: string }>) : [];
              const isPlaying = playingSongId === song.id;
              const isPreviewing = previewSongId === song.id;
              const totalDuration = syncData.length > 0 ? Math.max(...syncData.map((d) => d.time)) : 0;

              return (
                <Card key={song.id} className={`glass-panel border-white/5 bg-white/5 overflow-hidden transition-all ${isPlaying ? "border-primary/30 bg-primary/5" : ""}`} data-testid={`card-song-${song.id}`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl transition-colors ${isPlaying ? "bg-primary/20" : "bg-primary/10"}`}>
                          <Music className={`w-5 h-5 ${isPlaying ? "text-primary animate-pulse" : "text-primary"}`} />
                        </div>
                        <div>
                          <h4 className="font-bold text-white">{song.title}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {syncData.length} events
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {isPlaying ? (
                          <GlowButton size="sm" variant="danger" onClick={stopCurrentSong} data-testid={`button-stop-${song.id}`} className="flex items-center gap-1 px-3">
                            <Square className="w-3 h-3 fill-current" /> Stop
                          </GlowButton>
                        ) : (
                          <GlowButton size="sm" variant="primary" onClick={() => handlePlaySong(song)} data-testid={`button-play-${song.id}`}>
                            <Play className="w-4 h-4" />
                          </GlowButton>
                        )}
                        <GlowButton
                          size="sm" variant="ghost"
                          className={`transition-colors ${isPreviewing ? "text-yellow-400 bg-yellow-400/10" : "text-muted-foreground hover:text-white"}`}
                          onClick={() => setPreviewSongId(isPreviewing ? null : song.id)}
                          data-testid={`button-preview-${song.id}`}
                          title="Show timing preview"
                        >
                          <Clock className="w-4 h-4" />
                        </GlowButton>
                        <GlowButton
                          size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
                          onClick={() => deleteMutation.mutate(song.id)}
                          disabled={deleteMutation.isPending || isPlaying}
                          data-testid={`button-delete-${song.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </GlowButton>
                      </div>
                    </div>

                    {/* Progress bar when playing */}
                    {isPlaying && (
                      <div className="mt-4 space-y-1">
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{duration > 0 ? formatTime(progress * duration) : "0:00"}</span>
                          <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
                        </div>
                      </div>
                    )}

                    {/* Timing Preview */}
                    {isPreviewing && syncData.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Timing Preview</p>
                        <div className="relative w-full h-8 bg-white/5 rounded-lg overflow-hidden">
                          {syncData.map((event, i) => {
                            const pct = totalDuration > 0 ? (event.time / totalDuration) * 100 : (i / syncData.length) * 100;
                            return (
                              <div
                                key={i}
                                className={`absolute top-1 w-1.5 h-6 rounded-sm ${event.action === "on" ? "bg-primary" : "bg-white/20"}`}
                                style={{ left: `${pct}%` }}
                                title={`${event.action} @ ${(event.time / 1000).toFixed(2)}s`}
                              />
                            );
                          })}
                          {/* Playhead when playing */}
                          {isPlaying && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-white/80"
                              style={{ left: `${progress * 100}%` }}
                            />
                          )}
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground/60">
                          <span>0s</span>
                          <span className="text-primary text-xs">{syncData.filter(d => d.action === "on").length} flashes</span>
                          <span>{(totalDuration / 1000).toFixed(1)}s</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

interface FilePickerRowProps {
  label: string;
  accept: string;
  icon: React.ReactNode;
  file: File | null;
  testId: string;
  hint?: string;
  onFileSelect: (file: File) => void;
}

function FilePickerRow({ label, accept, icon, file, testId, hint, onFileSelect }: FilePickerRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</label>
      <div
        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${file ? "border-primary/40 bg-primary/5" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
        onClick={() => inputRef.current?.click()}
        data-testid={`picker-${testId}`}
      >
        <span className={`text-sm truncate ${file ? "text-white" : "text-muted-foreground"}`}>
          {file ? file.name : `Choose ${label}`}
        </span>
        <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
      {hint && !file && <p className="text-xs text-muted-foreground/60 pl-1">{hint}</p>}
      <input
        ref={inputRef} id={testId} type="file" className="hidden" accept={accept} data-testid={testId}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = ""; }}
      />
    </div>
  );
}
