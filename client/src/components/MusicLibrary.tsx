
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Music, Upload, Play, Trash2, Loader2, Music2, Plus, FileJson, FileAudio, X, ChevronDown, ChevronUp } from "lucide-react";
import { GlowButton } from "./GlowButton";
import { useToast } from "@/hooks/use-toast";
import { type Song } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

interface MusicLibraryProps {
  eventId: number;
  onPlayEffect: (effect: any) => void;
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

export function MusicLibrary({ eventId, onPlayEffect }: MusicLibraryProps) {
  const [sections, setSections] = useState<Section[]>([createSection()]);
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

  const addSection = () => {
    setSections((prev) => [...prev, createSection()]);
  };

  const removeSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSongFile = (sectionId: string, file: File) => {
    const title = file.name.replace(/\.[^/.]+$/, "");
    updateSection(sectionId, { songFile: file, title });
  };

  const handleJsonFile = (sectionId: string, file: File) => {
    updateSection(sectionId, { jsonFile: file });
  };

  const uploadSection = async (section: Section) => {
    if (!section.songFile || !section.jsonFile) {
      toast({
        title: "Both files required",
        description: "Please select a song file and a JSON timing file.",
        variant: "destructive",
      });
      return;
    }

    updateSection(section.id, { isUploading: true });

    try {
      // Read JSON file
      const jsonText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(section.jsonFile!);
      });

      let syncData: any[];
      try {
        syncData = JSON.parse(jsonText);
        if (!Array.isArray(syncData)) throw new Error("JSON must be an array");
      } catch {
        toast({
          title: "Invalid JSON file",
          description: 'File must be a JSON array like [{"time": 1000, "action": "on"}, ...]',
          variant: "destructive",
        });
        updateSection(section.id, { isUploading: false });
        return;
      }

      // Read audio file as base64
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (result.length > 50 * 1024 * 1024) {
            reject(new Error("File too large (max 50MB)"));
          } else {
            resolve(result);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(section.songFile!);
      });

      await uploadMutation.mutateAsync({
        title: section.title || section.songFile.name.replace(/\.[^/.]+$/, ""),
        artist: "Unknown Artist",
        url: audioBase64,
        syncData,
        duration: 0,
      });

      toast({
        title: "Section uploaded!",
        description: `"${section.title}" with flashlight timing loaded.`,
      });

      updateSection(section.id, {
        isUploading: false,
        songFile: null,
        jsonFile: null,
        title: "",
        isExpanded: false,
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
      updateSection(section.id, { isUploading: false });
    }
  };

  const handlePlaySong = (song: Song) => {
    toast({ title: `Playing: ${song.title}`, description: "Synchronizing flashlights to timing data..." });

    const audio = new Audio(song.url);
    const timeouts: NodeJS.Timeout[] = [];

    audio.onplay = () => {
      const syncData = song.syncData as Array<{ time: number; action: "on" | "off" }>;
      syncData.forEach((item) => {
        const timeout = setTimeout(() => {
          onPlayEffect({
            type: item.action === "on" ? "TORCH_ON" : "TORCH_OFF",
            duration: 200,
          });
        }, item.time);
        timeouts.push(timeout);
      });
    };

    audio.play();

    const cleanup = () => {
      timeouts.forEach(clearTimeout);
      onPlayEffect({ type: "TORCH_OFF" });
    };

    audio.onended = cleanup;
    audio.onpause = cleanup;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <GlowButton
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
            onClick={addSection}
            data-testid="button-add-section"
          >
            <Plus className="w-4 h-4" />
            Add Section
          </GlowButton>
        </div>

        {sections.map((section, index) => (
          <Card
            key={section.id}
            className="glass-panel border-white/10 bg-white/5 overflow-hidden"
            data-testid={`card-section-${section.id}`}
          >
            {/* Section header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer select-none"
              onClick={() => updateSection(section.id, { isExpanded: !section.isExpanded })}
            >
              <span className="text-sm font-semibold text-white">
                Section {index + 1}
                {section.title && (
                  <span className="ml-2 text-primary font-normal">— {section.title}</span>
                )}
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
                {section.isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Section body */}
            {section.isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-4">
                {/* Song File */}
                <FilePickerRow
                  label="Song File"
                  accept="audio/*"
                  icon={<FileAudio className="w-4 h-4 text-primary" />}
                  file={section.songFile}
                  testId={`input-song-${section.id}`}
                  onFileSelect={(f) => handleSongFile(section.id, f)}
                />

                {/* JSON Timing File */}
                <FilePickerRow
                  label="Flashlight Timing (JSON)"
                  accept=".json,application/json"
                  icon={<FileJson className="w-4 h-4 text-yellow-400" />}
                  file={section.jsonFile}
                  testId={`input-json-${section.id}`}
                  onFileSelect={(f) => handleJsonFile(section.id, f)}
                  hint='Format: [{"time": 1000, "action": "on"}, {"time": 2000, "action": "off"}]'
                />

                {/* Upload Button */}
                <div className="pt-1">
                  <GlowButton
                    variant="primary"
                    size="sm"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={() => uploadSection(section)}
                    disabled={section.isUploading || !section.songFile || !section.jsonFile}
                    data-testid={`button-upload-section-${section.id}`}
                  >
                    {section.isUploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Upload Section</>
                    )}
                  </GlowButton>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Library */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Uploaded Songs
        </h4>
        <div className="grid grid-cols-1 gap-3">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : songs.length === 0 ? (
            <div className="text-center p-10 glass-panel rounded-2xl border-dashed border-2 border-white/10">
              <Music2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground text-sm">No songs uploaded yet</p>
            </div>
          ) : (
            songs.map((song) => (
              <Card
                key={song.id}
                className="glass-panel p-4 flex items-center justify-between border-white/5 bg-white/5"
                data-testid={`card-song-${song.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Music className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{song.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {Array.isArray(song.syncData) ? `${(song.syncData as any[]).length} timing events` : "No timing data"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <GlowButton
                    size="sm"
                    variant="primary"
                    onClick={() => handlePlaySong(song)}
                    data-testid={`button-play-${song.id}`}
                  >
                    <Play className="w-4 h-4" />
                  </GlowButton>
                  <GlowButton
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => deleteMutation.mutate(song.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${song.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </GlowButton>
                </div>
              </Card>
            ))
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
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </label>
      <div
        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
          file
            ? "border-primary/40 bg-primary/5"
            : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
        onClick={() => inputRef.current?.click()}
        data-testid={`picker-${testId}`}
      >
        <span className={`text-sm truncate ${file ? "text-white" : "text-muted-foreground"}`}>
          {file ? file.name : `Choose ${label}`}
        </span>
        <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
      {hint && !file && (
        <p className="text-xs text-muted-foreground/60 pl-1">{hint}</p>
      )}
      <input
        ref={inputRef}
        id={testId}
        type="file"
        className="hidden"
        accept={accept}
        data-testid={testId}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelect(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
