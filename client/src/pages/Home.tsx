import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { GlowButton } from "@/components/GlowButton";
import { useCreateEvent, useJoinEvent, useHostLogin } from "@/hooks/use-events";
import { Zap, Smartphone, ArrowRight, Music, LogIn, ChevronRight, Clock, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";

interface SavedEvent {
  id: number;
  name: string;
  pin: string;
  password: string;
  hostId: string;
  createdAt: string;
}

function getSavedEvents(): SavedEvent[] {
  try {
    return JSON.parse(localStorage.getItem("savedEvents") || "[]");
  } catch {
    return [];
  }
}

function saveEvent(event: SavedEvent) {
  const existing = getSavedEvents().filter((e) => e.id !== event.id);
  localStorage.setItem("savedEvents", JSON.stringify([event, ...existing]));
}

function removeSavedEvent(id: number) {
  const existing = getSavedEvents().filter((e) => e.id !== id);
  localStorage.setItem("savedEvents", JSON.stringify(existing));
}

export default function Home() {
  const [pin, setPin] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showHostLogin, setShowHostLogin] = useState(false);
  const [eventName, setEventName] = useState("");
  const [hostEventId, setHostEventId] = useState("");
  const [hostPassword, setHostPassword] = useState("");
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const createEvent = useCreateEvent();
  const joinEvent = useJoinEvent();
  const hostLogin = useHostLogin();

  // Load saved events and auto-fill PIN from URL (for QR code scans)
  useEffect(() => {
    setSavedEvents(getSavedEvents());

    const params = new URLSearchParams(window.location.search);
    const urlPin = params.get("pin");
    if (urlPin) {
      setPin(urlPin.toUpperCase().slice(0, 9));
    }
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) {
      toast({ title: "Event name required", description: "Please enter a name for your event.", variant: "destructive" });
      return;
    }
    const hostId = uuidv4();
    createEvent.mutate(
      { name: eventName.trim(), hostId },
      {
        onSuccess: (data) => {
          const newEvent: SavedEvent = {
            id: data.id,
            name: data.name,
            pin: data.pin,
            password: data.password,
            hostId: data.hostId,
            createdAt: new Date().toISOString(),
          };
          saveEvent(newEvent);
          setSavedEvents(getSavedEvents());
          setLocation(`/host/${data.hostId}`);
        },
      }
    );
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 9) {
      toast({ title: "Invalid PIN", description: "Please enter 8 digits + 1 letter (e.g., 12345678A).", variant: "destructive" });
      return;
    }
    joinEvent.mutate(pin, {
      onError: (err) => toast({ title: "Join Failed", description: err.message, variant: "destructive" }),
    });
  };

  const handleHostLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostEventId.trim() || !hostPassword.trim()) {
      toast({ title: "Invalid Input", description: "Please enter both Event ID and Password.", variant: "destructive" });
      return;
    }
    hostLogin.mutate({ eventId: hostEventId, password: hostPassword }, {
      onError: (err) => toast({ title: "Login Failed", description: err.message, variant: "destructive" }),
    });
  };

  const handleDeleteSaved = (id: number) => {
    removeSavedEvent(id);
    setSavedEvents(getSavedEvents());
    toast({ title: "Event removed from history" });
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch { return ""; }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-6">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md space-y-10 relative z-10"
      >
        {/* Logo */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm border border-white/10 mb-4"
          >
            <Zap className="w-12 h-12 text-primary" />
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-display font-black tracking-tighter text-white">
            FLASH<span className="text-gradient">MAN</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xs mx-auto">
            Control the crowd's flashlights for the ultimate synchronized light show.
          </p>
        </div>

        {/* Join / Create */}
        <div className="space-y-5">
          {/* Join */}
          <div className="glass-panel rounded-2xl p-1">
            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9A-Z]/g, "").slice(0, 9).toUpperCase())}
                placeholder="Enter PIN (e.g., 12345678A)"
                className="flex-1 bg-transparent border-none text-center text-xl font-bold tracking-[0.3em] placeholder:tracking-normal placeholder:font-normal placeholder:text-muted-foreground/50 focus:ring-0 text-white h-14 placeholder:text-sm"
                maxLength={9}
                inputMode="text"
                data-testid="input-pin"
              />
              <button
                type="submit"
                disabled={joinEvent.isPending || pin.length !== 9}
                className="bg-white/10 hover:bg-white/20 text-white rounded-xl px-6 font-bold disabled:opacity-50 transition-colors"
                data-testid="button-join"
              >
                {joinEvent.isPending ? "..." : <ArrowRight />}
              </button>
            </form>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!showCreateForm && !showHostLogin ? (
              <motion.div key="buttons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                <GlowButton variant="primary" size="lg" className="w-full" onClick={() => setShowCreateForm(true)} disabled={createEvent.isPending} data-testid="button-host-event">
                  Host an Event
                </GlowButton>
                <button
                  onClick={() => setShowHostLogin(true)}
                  className="w-full bg-white/10 hover:bg-white/20 text-white rounded-xl px-6 py-3 font-bold transition-colors flex items-center justify-center gap-2"
                  data-testid="button-host-login"
                >
                  <LogIn className="w-4 h-4" /> Host Login
                </button>
              </motion.div>
            ) : showHostLogin ? (
              <motion.form key="login" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onSubmit={handleHostLogin} className="space-y-3">
                <div className="glass-panel rounded-xl p-4">
                  <input type="text" value={hostEventId} onChange={(e) => setHostEventId(e.target.value)} placeholder="Event ID (9 digits)" maxLength={10} className="w-full bg-transparent border-none text-white placeholder:text-muted-foreground focus:ring-0 outline-none" autoFocus data-testid="input-event-id" />
                </div>
                <div className="glass-panel rounded-xl p-4">
                  <input type="text" value={hostPassword} onChange={(e) => setHostPassword(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Password (4 digits)" maxLength={4} inputMode="numeric" className="w-full bg-transparent border-none text-white placeholder:text-muted-foreground focus:ring-0 outline-none" data-testid="input-password" />
                </div>
                <div className="flex gap-2">
                  <GlowButton variant="primary" size="lg" className="flex-1" type="submit" disabled={hostLogin.isPending || !hostEventId.trim() || !hostPassword.trim()} data-testid="button-login-submit">
                    {hostLogin.isPending ? "Logging in..." : "Login"}
                  </GlowButton>
                  <button type="button" onClick={() => { setShowHostLogin(false); setHostEventId(""); setHostPassword(""); }} className="flex-1 bg-white/10 hover:bg-white/20 text-white rounded-xl px-6 font-bold transition-colors">
                    Cancel
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.form key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onSubmit={handleCreate} className="space-y-3">
                <div className="glass-panel rounded-xl p-4">
                  <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Event name (e.g., New Year Party)" maxLength={100} className="w-full bg-transparent border-none text-white placeholder:text-muted-foreground focus:ring-0 outline-none" autoFocus data-testid="input-event-name" />
                </div>
                <div className="flex gap-2">
                  <GlowButton variant="primary" size="lg" className="flex-1" type="submit" disabled={createEvent.isPending || !eventName.trim()} data-testid="button-create-submit">
                    {createEvent.isPending ? "Creating..." : "Create"}
                  </GlowButton>
                  <button type="button" onClick={() => { setShowCreateForm(false); setEventName(""); }} className="flex-1 bg-white/10 hover:bg-white/20 text-white rounded-xl px-6 font-bold transition-colors">
                    Cancel
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* My Events */}
        {savedEvents.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-3 h-3" /> My Events
            </h2>
            <div className="space-y-2">
              {savedEvents.map((ev) => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-panel rounded-xl flex items-center justify-between px-4 py-3 border border-white/5"
                  data-testid={`saved-event-${ev.id}`}
                >
                  <button
                    className="flex flex-col text-left flex-1 min-w-0"
                    onClick={() => setLocation(`/host/${ev.hostId}`)}
                  >
                    <span className="text-sm font-bold text-white truncate">{ev.name}</span>
                    <span className="text-xs text-muted-foreground">PIN: {ev.pin} · {formatDate(ev.createdAt)}</span>
                  </button>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <button
                      onClick={() => setLocation(`/host/${ev.hostId}`)}
                      className="text-primary hover:text-white transition-colors"
                      title="Open event"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(ev.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove from history"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-panel p-4 rounded-xl flex flex-col items-center text-center gap-2">
            <Smartphone className="w-6 h-6 text-secondary" />
            <span className="text-xs text-white/60">No App Required</span>
          </div>
          <div className="glass-panel p-4 rounded-xl flex flex-col items-center text-center gap-2">
            <Music className="w-6 h-6 text-accent" />
            <span className="text-xs text-white/60">Music Sync</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
