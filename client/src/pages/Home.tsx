import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { GlowButton } from "@/components/GlowButton";
import { useCreateEvent, useJoinEvent, useHostLogin } from "@/hooks/use-events";
import { Zap, Smartphone, ArrowRight, Music, Users, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";

export default function Home() {
  const [pin, setPin] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showHostLogin, setShowHostLogin] = useState(false);
  const [eventName, setEventName] = useState("");
  const [hostEventId, setHostEventId] = useState("");
  const [hostPassword, setHostPassword] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{ id: number; password: string; pin: string; hostId: string } | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const createEvent = useCreateEvent();
  const joinEvent = useJoinEvent();
  const hostLogin = useHostLogin();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) {
      toast({
        title: "Event name required",
        description: "Please enter a name for your event.",
        variant: "destructive",
      });
      return;
    }
    
    const hostId = uuidv4();
    createEvent.mutate(
      {
        name: eventName.trim(),
        hostId,
      },
      {
        onSuccess: (data) => {
          // Show credentials prominently before redirecting
          setCreatedCredentials({
            id: data.id,
            password: data.password,
            pin: data.pin,
            hostId: data.hostId
          });
          
          // Also store credentials in localStorage for quick access
          localStorage.setItem("lastHostId", data.hostId);
          localStorage.setItem("lastEventPin", data.pin);
          localStorage.setItem("lastEventId", String(data.id));
          localStorage.setItem("lastEventPassword", data.password);
          
          // Redirect after 5 seconds
          setTimeout(() => {
            setLocation(`/host/${data.hostId}`);
          }, 5000);
        },
      }
    );
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 9) {
      toast({
        title: "Invalid PIN",
        description: "Please enter 8 digits + 1 letter (e.g., 12345678A).",
        variant: "destructive",
      });
      return;
    }
    
    joinEvent.mutate(pin, {
      onError: (err) => {
        toast({
          title: "Join Failed",
          description: err.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleHostLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostEventId.trim() || !hostPassword.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter both Event ID and Password.",
        variant: "destructive",
      });
      return;
    }
    
    hostLogin.mutate({ eventId: hostEventId, password: hostPassword }, {
      onError: (err) => {
        toast({
          title: "Login Failed",
          description: err.message,
          variant: "destructive",
        });
      }
    });
  };

  // Show credentials screen if event was just created
  if (createdCredentials) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-6">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[100px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="text-center space-y-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Event Created!</h1>
              <p className="text-muted-foreground">Save these credentials to rejoin anytime</p>
            </div>

            {/* Event ID Card */}
            <div className="glass-panel rounded-2xl p-6 space-y-2">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">9-Digit Event ID</p>
              <div className="text-4xl font-bold text-primary tracking-widest">{createdCredentials.id}</div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(String(createdCredentials.id));
                  toast({ title: "Copied!", description: "Event ID copied to clipboard" });
                }}
                className="w-full text-xs text-muted-foreground hover:text-white transition-colors mt-3"
              >
                Click to copy
              </button>
            </div>

            {/* Password Card */}
            <div className="glass-panel rounded-2xl p-6 space-y-2">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">4-Digit Password PIN</p>
              <div className="text-4xl font-bold text-accent tracking-[0.5em]">{createdCredentials.password}</div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdCredentials.password);
                  toast({ title: "Copied!", description: "Password copied to clipboard" });
                }}
                className="w-full text-xs text-muted-foreground hover:text-white transition-colors mt-3"
              >
                Click to copy
              </button>
            </div>

            {/* Attendee PIN Card */}
            <div className="glass-panel rounded-2xl p-6 space-y-2 border border-green-500/30">
              <p className="text-sm text-green-400 uppercase tracking-wider">Attendee PIN</p>
              <div className="text-3xl font-bold text-green-400">{createdCredentials.pin}</div>
              <p className="text-xs text-muted-foreground mt-3">Share this PIN with attendees</p>
            </div>

            {/* Continue Button */}
            <div className="pt-4 space-y-2">
              <GlowButton
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => setLocation(`/host/${createdCredentials.hostId}`)}
              >
                Go to Dashboard
              </GlowButton>
              <p className="text-xs text-muted-foreground">Redirecting in 5 seconds...</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-6">
      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md space-y-12 relative z-10"
      >
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

        <div className="space-y-6">
          {/* Join Form */}
          <div className="glass-panel rounded-2xl p-1">
            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9A-Z]/g, '').slice(0, 9).toUpperCase())}
                placeholder="12345678A"
                className="flex-1 bg-transparent border-none text-center text-xl font-bold tracking-[0.3em] placeholder:tracking-normal placeholder:font-normal placeholder:text-muted-foreground/50 focus:ring-0 text-white h-14"
                maxLength={9}
                inputMode="text"
              />
              <button
                type="submit"
                disabled={joinEvent.isPending || pin.length !== 9}
                className="bg-white/10 hover:bg-white/20 text-white rounded-xl px-6 font-bold disabled:opacity-50 transition-colors"
              >
                {joinEvent.isPending ? "..." : <ArrowRight />}
              </button>
            </form>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {!showCreateForm && !showHostLogin ? (
            <div className="space-y-2">
              <GlowButton 
                variant="primary" 
                size="lg" 
                className="w-full"
                onClick={() => setShowCreateForm(true)}
                disabled={createEvent.isPending}
              >
                Host an Event
              </GlowButton>
              <button
                onClick={() => setShowHostLogin(true)}
                className="w-full bg-white/10 hover:bg-white/20 text-white rounded-xl px-6 py-3 font-bold transition-colors flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                Host Login
              </button>
            </div>
          ) : showHostLogin ? (
            <form onSubmit={handleHostLogin} className="space-y-3">
              <div className="glass-panel rounded-xl p-4">
                <input
                  type="text"
                  value={hostEventId}
                  onChange={(e) => setHostEventId(e.target.value)}
                  placeholder="Event ID (e.g., 123)"
                  maxLength={10}
                  className="w-full bg-transparent border-none text-white placeholder:text-muted-foreground focus:ring-0 outline-none"
                  autoFocus
                />
              </div>
              <div className="glass-panel rounded-xl p-4">
                <input
                  type="text"
                  value={hostPassword}
                  onChange={(e) => setHostPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Password (4 digits)"
                  maxLength={4}
                  inputMode="numeric"
                  className="w-full bg-transparent border-none text-white placeholder:text-muted-foreground focus:ring-0 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <GlowButton 
                  variant="primary" 
                  size="lg" 
                  className="flex-1"
                  type="submit"
                  disabled={hostLogin.isPending || !hostEventId.trim() || !hostPassword.trim()}
                >
                  {hostLogin.isPending ? "Logging in..." : "Login"}
                </GlowButton>
                <button
                  type="button"
                  onClick={() => {
                    setShowHostLogin(false);
                    setHostEventId("");
                    setHostPassword("");
                  }}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white rounded-xl px-6 font-bold disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="glass-panel rounded-xl p-4">
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Event name (e.g., New Year Party)"
                  maxLength={100}
                  className="w-full bg-transparent border-none text-white placeholder:text-muted-foreground focus:ring-0 outline-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <GlowButton 
                  variant="primary" 
                  size="lg" 
                  className="flex-1"
                  type="submit"
                  disabled={createEvent.isPending || !eventName.trim()}
                >
                  {createEvent.isPending ? "Creating..." : "Create"}
                </GlowButton>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEventName("");
                  }}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white rounded-xl px-6 font-bold disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 gap-4 pt-8">
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
