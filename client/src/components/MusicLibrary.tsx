
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Music, Upload, Play, Trash2, Loader2, Music2 } from "lucide-react";
import { GlowButton } from "./GlowButton";
import { useToast } from "@/hooks/use-toast";
import { type Song } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

interface MusicLibraryProps {
  eventId: number;
  onPlayEffect: (effect: any) => void;
}

export function MusicLibrary({ eventId, onPlayEffect }: MusicLibraryProps) {
  const [isUploading, setIsUploading] = useState(false);
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
      toast({ title: "Song added to library", description: "Beat analysis complete." });
      setIsUploading(false);
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    // Mock upload - in a real app, this would upload to cloud storage
    setTimeout(() => {
      uploadMutation.mutate({
        title: file.name.split('.')[0],
        artist: "Unknown Artist",
        url: URL.createObjectURL(file),
        duration: 180000 // 3 minutes mock
      });
    }, 1500);
  };

  const handlePlaySong = (song: Song) => {
    toast({ title: `Playing: ${song.title}`, description: "Synchronizing flashlights to beat..." });
    
    const audio = new Audio(song.url);
    audio.play();

    // Broadcast the entire sync sequence via WebSockets
    const syncSequence = song.syncData as any[];
    syncSequence.forEach((item) => {
      setTimeout(() => {
        onPlayEffect({
          type: item.effect,
          duration: item.duration,
        });
      }, item.time);
    });

    // Handle cleanup when audio ends
    audio.onended = () => {
      onPlayEffect({ type: 'TORCH_OFF' });
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Music className="w-5 h-5 text-primary" />
          Music Sync Library
        </h3>
        <label className="cursor-pointer">
          <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} disabled={isUploading} />
          <GlowButton variant="secondary" size="sm" className="flex items-center gap-2">
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Song
          </GlowButton>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : songs.length === 0 ? (
          <div className="text-center p-12 glass-panel rounded-2xl border-dashed border-2 border-white/10">
            <Music2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">Your music library is empty</p>
          </div>
        ) : (
          songs.map((song) => (
            <Card key={song.id} className="glass-panel p-4 flex items-center justify-between border-white/5 bg-white/5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Music className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-white">{song.title}</h4>
                  <p className="text-xs text-muted-foreground">{song.artist}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <GlowButton size="sm" variant="primary" onClick={() => handlePlaySong(song)}>
                  <Play className="w-4 h-4" />
                </GlowButton>
                <GlowButton size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                </GlowButton>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
