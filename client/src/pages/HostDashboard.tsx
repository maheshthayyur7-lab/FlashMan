import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useSocket } from "@/hooks/use-socket";
import { useEvent } from "@/hooks/use-events";
import { useTorch } from "@/hooks/use-torch";
import { GlowButton } from "@/components/GlowButton";
import { StatusIndicator } from "@/components/StatusIndicator";
import { Zap, Activity, StopCircle, Radio, Copy, Users, Wifi, Lock, QrCode, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import type { EffectType } from "@shared/schema";
import { MusicLibrary } from "@/components/MusicLibrary";
import { QRCodeSVG } from "qrcode.react";

export default function HostDashboard() {
  const { id } = useParams();
  const hostId = id;
  const { data: event, isLoading: eventLoading } = useEvent(hostId as string);
  const { isConnected, latency, emitEffect, emitNowPlaying, participants, lastEffect } = useSocket(event?.id || 0, 'host', event?.pin);
  const { requestPermission, hasPermission, toggle } = useTorch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [activeEffect, setActiveEffect] = useState<EffectType | null>(null);
  const [strobeHz, setStrobeHz] = useState(5);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    if (!lastEffect) return;
    let intervalId: NodeJS.Timeout;

    const runEffect = async () => {
      const { type, duration = 5000, frequency = 5 } = lastEffect;
      if (type === 'TORCH_OFF') { if (hasPermission) toggle(false); return; }
      if (type === 'TORCH_ON') { if (hasPermission) toggle(true); }
      if (type === 'PULSE') { if (hasPermission) { toggle(true); setTimeout(() => toggle(false), 200); } }
      if (type === 'STROBE') {
        const period = 1000 / frequency;
        let state = false;
        intervalId = setInterval(() => { state = !state; if (hasPermission) toggle(state); }, period * 0.5);
        setTimeout(() => { clearInterval(intervalId); if (hasPermission) toggle(false); }, duration);
      }
    };

    runEffect();
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [lastEffect, hasPermission, toggle]);

  useEffect(() => {
    if (!eventLoading && !event) setLocation("/");
  }, [event, eventLoading, setLocation]);

  const handleEffect = (type: EffectType) => {
    setActiveEffect(type);
    if (type === 'STROBE') emitEffect('STROBE', { frequency: strobeHz, duration: 10000 });
    else emitEffect(type);
    if (type === 'TORCH_OFF') setActiveEffect(null);
  };

  const handleCopyPin = () => {
    if (event) {
      navigator.clipboard.writeText(event.pin);
      toast({ title: "PIN Copied", description: "Share this PIN with attendees." });
    }
  };

  // Build the join URL for QR code
  const joinUrl = event ? `${window.location.origin}/?pin=${event.pin}` : "";

  if (eventLoading || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading Controller...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      <header className="bg-white/5 border-b border-white/10 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-display font-bold text-xl tracking-tight">{event.name}</h1>
            <StatusIndicator connected={isConnected} latency={latency} />
          </div>
          <button onClick={() => setLocation("/")} className="text-xs font-bold text-white/50 hover:text-white">EXIT</button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 pt-8 space-y-8">
        {!hasPermission && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex gap-3 text-left">
            <Lock className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200/80">
              <p className="font-bold mb-2">Flashlight Access Needed</p>
              <GlowButton onClick={requestPermission} size="sm" className="w-full">Enable Flashlight</GlowButton>
            </div>
          </motion.div>
        )}

        {/* PIN & Stats Panel */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-2xl p-6 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-secondary" />

          <div className="text-center space-y-2">
            <p className="text-muted-foreground text-sm uppercase tracking-wider font-bold">Event PIN</p>
            <div
              onClick={handleCopyPin}
              className="text-6xl font-display font-black text-white tracking-widest cursor-pointer hover:scale-105 transition-transform active:scale-95"
            >
              {event.pin}
            </div>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button onClick={handleCopyPin} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Copy className="w-3 h-3" /> Copy PIN
              </button>
              <button onClick={() => setShowQR(!showQR)} className="flex items-center gap-1 text-xs text-secondary hover:underline">
                <QrCode className="w-3 h-3" /> {showQR ? "Hide QR" : "Show QR"}
              </button>
            </div>
          </div>

          {/* QR Code */}
          <AnimatePresence>
            {showQR && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col items-center gap-3 pt-2 border-t border-white/10">
                  <div className="bg-white p-4 rounded-2xl">
                    <QRCodeSVG value={joinUrl} size={180} bgColor="#ffffff" fgColor="#000000" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Attendees can scan this to join instantly</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground uppercase font-bold">Active Now</span>
              </div>
              <div className="text-3xl font-display font-black text-white">{participants.activeNow}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Users className="w-4 h-4 text-secondary" />
                <span className="text-xs text-muted-foreground uppercase font-bold">Total Joined</span>
              </div>
              <div className="text-3xl font-display font-black text-white">{participants.totalJoined}</div>
            </div>
          </div>
        </motion.div>

        {/* Music Library */}
        <section className="pt-4">
          <MusicLibrary
            eventId={event.id}
            onPlayEffect={(eff: any) => emitEffect(eff.type, eff)}
            onNowPlaying={(title) => emitNowPlaying(title)}
          />
        </section>

        {/* Live Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <span className="font-bold">LIVE CONTROLS</span>
            <span className="flex items-center gap-1"><Radio className="w-3 h-3 text-red-500 animate-pulse" /> Broadcasting</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <GlowButton size="xl" variant="primary" active={activeEffect === 'TORCH_ON'} onClick={() => handleEffect(activeEffect === 'TORCH_ON' ? 'TORCH_OFF' : 'TORCH_ON')} className="h-32 flex flex-col gap-2">
              <Zap className={activeEffect === 'TORCH_ON' ? "fill-white" : ""} />
              {activeEffect === 'TORCH_ON' ? "ON" : "FLASH"}
            </GlowButton>
            <GlowButton size="xl" variant="secondary" active={activeEffect === 'STROBE'} onClick={() => handleEffect('STROBE')} className="h-32 flex flex-col gap-2">
              <Activity /> STROBE
            </GlowButton>
          </div>

          <AnimatePresence>
            {activeEffect === 'STROBE' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="glass-panel p-4 rounded-xl space-y-2 overflow-hidden">
                <div className="flex justify-between text-sm font-bold text-white/80">
                  <span>Frequency</span><span>{strobeHz} Hz</span>
                </div>
                <input type="range" min="1" max="20" step="1" value={strobeHz}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setStrobeHz(val);
                    if (activeEffect === 'STROBE') emitEffect('STROBE', { frequency: val, duration: 10000 });
                  }}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-secondary"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <GlowButton variant="ghost" size="lg" className="w-full" onClick={() => handleEffect('PULSE')}>PULSE ONCE</GlowButton>

          <div className="pt-4">
            <GlowButton variant="danger" size="lg" className="w-full font-black tracking-widest" onClick={() => handleEffect('TORCH_OFF')}>
              <StopCircle className="w-6 h-6 mr-2" /> STOP ALL
            </GlowButton>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-white/30 max-w-[200px] mx-auto">
            Effects are automatically stopped after 60 seconds to prevent device overheating.
          </p>
        </div>
      </main>
    </div>
  );
}
