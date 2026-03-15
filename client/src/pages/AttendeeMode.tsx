import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useSocket } from "@/hooks/use-socket";
import { useTorch } from "@/hooks/use-torch";
import { useEvent } from "@/hooks/use-events";
import { GlowButton } from "@/components/GlowButton";
import { StatusIndicator } from "@/components/StatusIndicator";
import { Lock, Zap, AlertTriangle, LogOut, Music } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AttendeeMode() {
  const { id } = useParams();
  const eventId = parseInt(id || "0");
  const [, setLocation] = useLocation();
  
  const { data: event, isLoading: eventLoading } = useEvent(eventId);
  const { isConnected, latency, lastEffect, nowPlaying } = useSocket(eventId, 'attendee', event?.pin);
  const { requestPermission, hasPermission, toggle, isSupported } = useTorch();
  
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [screenFlashColor, setScreenFlashColor] = useState<string | null>(null);

  // Wake Lock
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          const lock = await navigator.wakeLock.request('screen');
          setWakeLock(lock);
          console.log('Wake Lock active');
        }
      } catch (err) {
        console.error('Wake Lock failed:', err);
      }
    };

    requestWakeLock();
    return () => {
      wakeLock?.release();
    };
  }, []);

  // Effect Processing Logic
  useEffect(() => {
    if (!lastEffect) return;

    let intervalId: NodeJS.Timeout;
    
    const runEffect = async () => {
      const { type, duration = 5000, frequency = 5, color = '#FFFFFF' } = lastEffect;

      // Torch available = permission granted AND hardware torch supported
      const canUseTorch = hasPermission && isSupported;

      if (type === 'TORCH_OFF') {
        if (canUseTorch) toggle(false);
        setScreenFlashColor(null);
        return;
      }

      if (type === 'TORCH_ON') {
        if (canUseTorch) toggle(true);
        else setScreenFlashColor(color);
      }

      if (type === 'PULSE') {
        if (canUseTorch) {
          toggle(true);
          setTimeout(() => toggle(false), 200);
        } else {
          setScreenFlashColor(color);
          setTimeout(() => setScreenFlashColor(null), 200);
        }
      }

      if (type === 'STROBE') {
        const period = 1000 / frequency;
        let state = false;
        intervalId = setInterval(() => {
          state = !state;
          if (canUseTorch) {
            toggle(state);
          } else {
            setScreenFlashColor(state ? color : null);
          }
        }, period * 0.5);

        setTimeout(() => {
          clearInterval(intervalId);
          if (canUseTorch) toggle(false);
          setScreenFlashColor(null);
        }, duration);
      }
    };

    runEffect();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [lastEffect, hasPermission, isSupported, toggle]);

  // Clean exit
  const handleExit = () => {
    toggle(false);
    wakeLock?.release();
    setLocation("/");
  };

  if (eventLoading || !event) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white/50">
        Connecting...
      </div>
    );
  }

  // --- PERMISSION SCREEN ---
  if (!hasPermission) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-8">
        <div className="space-y-4">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto ring-1 ring-primary/50">
            <Lock className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white">Permission Needed</h1>
          <p className="text-muted-foreground">
            To participate in the light show, we need access to your camera's flashlight.
          </p>
        </div>

        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex gap-3 text-left">
          <AlertTriangle className="w-6 h-6 text-yellow-500 shrink-0" />
          <p className="text-sm text-yellow-200/80">
            <strong>Safety Warning:</strong> This event includes flashing lights and strobes which may affect photosensitive individuals.
          </p>
        </div>

        <div className="w-full space-y-3">
          <GlowButton onClick={requestPermission} size="lg" className="w-full">
            Enable Flashlight
          </GlowButton>
          <button onClick={() => setLocation("/")} className="text-sm text-muted-foreground hover:text-white underline">
            Leave Event
          </button>
        </div>
      </div>
    );
  }

  // --- ACTIVE MODE ---
  // If screen flash is active, we cover everything
  if (screenFlashColor) {
    return (
      <div 
        className="fixed inset-0 z-[9999]" 
        style={{ backgroundColor: screenFlashColor }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Dark overlay always active to save battery */}
      
      {/* Status Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10">
        <StatusIndicator connected={isConnected} latency={latency} label={event.name} />
        <button 
          onClick={handleExit}
          className="p-2 bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 z-10">
        
        {/* Animated Rings */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse" />
          <div className="relative w-40 h-40 rounded-full border border-white/10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            {lastEffect && lastEffect.type !== 'TORCH_OFF' ? (
              <Zap className="w-16 h-16 text-primary animate-pulse" />
            ) : (
              <div className="text-center space-y-2">
                <span className="block w-3 h-3 bg-green-500 rounded-full mx-auto animate-pulse shadow-[0_0_10px_#22c55e]" />
                <span className="text-xs text-white/30 uppercase tracking-widest font-bold">Standing By</span>
              </div>
            )}
          </div>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-display font-bold text-white tracking-tight">
            {lastEffect && lastEffect.type !== 'TORCH_OFF' ? "EFFECT ACTIVE" : "EVENT MODE"}
          </h2>
          <p className="text-white/40 text-sm max-w-xs mx-auto">
            Keep this screen open. Your phone is now part of the show.
          </p>
        </div>

        {/* Now Playing Banner */}
        <AnimatePresence>
          {nowPlaying && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 backdrop-blur-sm"
            >
              <div className="p-2 bg-primary/20 rounded-lg">
                <Music className="w-4 h-4 text-primary animate-pulse" />
              </div>
              <div className="text-left">
                <p className="text-xs text-white/40 uppercase tracking-widest">Now Playing</p>
                <p className="text-sm font-bold text-white truncate max-w-[180px]">{nowPlaying}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isSupported && (
          <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-200">
            Torch not available. Using Screen Flash fallback.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 text-center text-white/10 text-[10px] uppercase tracking-widest z-10">
        Synced via FlashMan
      </div>
    </div>
  );
}
