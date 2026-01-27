
import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // === REST API ===
  
  app.post(api.events.create.path, async (req, res) => {
    try {
      const input = api.events.create.input.parse(req.body);
      
      // Generate a unique PIN for attendees (8 digits + 1 capital letter)
      let pin = "";
      let attempts = 0;
      let existingEvent = null;
      
      do {
        // Generate 8 random digits
        const digits = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
        // Generate 1 random capital letter
        const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        pin = digits + letter;
        existingEvent = await storage.getEventByPin(pin);
        attempts++;
      } while (existingEvent && attempts < 10);
      
      if (existingEvent) {
        return res.status(500).json({ message: "Failed to generate unique PIN" });
      }
      
      // Generate a unique 9-digit Event ID
      let eventId: number;
      let existingById = null;
      do {
        eventId = Math.floor(100000000 + Math.random() * 900000000);
        existingById = await storage.getEvent(eventId);
      } while (existingById);

      // Generate a host password (4 random digits)
      const password = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      
      const event = await storage.createEvent({
        ...input,
        id: eventId,
        pin,
        password,
      } as any);
      
      // Return both PIN and hostId so frontend can show both
      res.status(201).json({
        ...event,
        eventPin: pin,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get(api.events.join.path, async (req, res) => {
    const event = await storage.getEventByPin(req.params.pin);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  });

  app.get(api.events.get.path, async (req, res) => {
    const event = await storage.getEvent(Number(req.params.id));
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  });

  // Get event by host ID (for host rejoin)
  app.get("/api/events/host/:hostId", async (req, res) => {
    const event = await storage.getEventByHostId(req.params.hostId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  });

  // Host login by Event ID and Password
  app.get(api.events.hostLogin.path, async (req, res) => {
    const event = await storage.getEvent(Number(req.params.id));
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    if (event.password !== req.params.password) {
      return res.status(401).json({ message: 'Invalid Event ID or Password' });
    }
    
    res.json(event);
  });

  app.get(api.events.stats.path, async (req, res) => {
    // ... existing stats logic ...
  });

  // Music Sync Library
  app.get("/api/events/:id/songs", async (req, res) => {
    const songs = await storage.getSongsByEvent(Number(req.params.id));
    res.json(songs);
  });

  app.post("/api/events/:id/songs", async (req, res) => {
    const { title, artist, url, duration } = req.body;
    
    // Automatic Beat Analysis (Mocked for now - generating "CSV" timings)
    // In a real app, this would use an audio processing library
    const syncData = [];
    for (let i = 0; i < duration; i += 500) { // Every 500ms
      if (Math.random() > 0.7) { // 30% chance of a blink
        syncData.push({ time: i, effect: 'TORCH_ON', duration: 100 });
      }
    }

    const song = await storage.saveSong({
      eventId: Number(req.params.id),
      title,
      artist,
      url,
      syncData,
      duration
    });

    res.status(201).json(song);
  });

  // === WEBSOCKET ===

  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
  });

  const roomState = new Map<string, { lastEffect: any; hostSocketId: string | null }>();

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on("join_event", async (data: { eventId: number; role: 'host' | 'attendee' }) => {
      try {
        const event = await storage.getEvent(data.eventId);
        if (!event) {
          return socket.emit("error", { message: "Event not found" });
        }

        const eventRoom = `event-${event.id}`;
        socket.join(eventRoom);

        if (!roomState.has(eventRoom)) {
          roomState.set(eventRoom, { lastEffect: null, hostSocketId: null });
        }

        if (data.role === "host") {
          const state = roomState.get(eventRoom)!;
          state.hostSocketId = socket.id;
        }

        await storage.joinSession(socket.id, event.id, data.role);
        socket.emit("joined", { eventId: event.id });
        io.to(eventRoom).emit("participant_update", {
          active: await storage.getActiveSessionCount(event.id),
          total: await storage.getTotalSessionCount(event.id),
        });
      } catch (err) {
        console.error("[Socket] Error joining event:", err);
      }
    });

    socket.on("host_effect", (data: { eventId: number; effect: any }) => {
      const eventRoom = `event-${data.eventId}`;
      const roomState_data = roomState.get(eventRoom);
      if (roomState_data && roomState_data.hostSocketId === socket.id) {
        roomState_data.lastEffect = data.effect;
        io.to(eventRoom).emit("effect", data.effect);
      }
    });

    socket.on("disconnect", async () => {
      await storage.leaveSession(socket.id);
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return httpServer;
}
