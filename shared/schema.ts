
import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  pin: text("pin").notNull().unique(), // 8 digits + 1 capital letter (9 chars total)
  password: text("password").notNull(), // Host password (4 digits)
  name: text("name").notNull(),
  hostId: text("host_id").notNull(), // Anonymous ID for host ownership
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // Session ID (socket ID or UUID)
  eventId: integer("event_id").notNull(),
  role: text("role").notNull(), // 'host' or 'attendee'
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
  lastHeartbeat: timestamp("last_heartbeat").defaultNow(),
});

// === SCHEMAS ===
export const insertEventSchema = createInsertSchema(events).omit({ 
  id: true, 
  createdAt: true,
  isActive: true,
  pin: true,  // PIN generated server-side
  password: true  // Password generated server-side
});

// === TYPES ===
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Session = typeof sessions.$inferSelect;

export const songs = pgTable("songs", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  title: text("title").notNull(),
  artist: text("artist"),
  url: text("url").notNull(),
  syncData: jsonb("sync_data").notNull(), // The "CSV" content stored as JSON timings
  duration: integer("duration").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSongSchema = createInsertSchema(songs).omit({
  id: true,
  createdAt: true,
});

export type Song = typeof songs.$inferSelect;
export type InsertSong = z.infer<typeof insertSongSchema>;

// === SOCKET TYPES ===
// Effect types
export type EffectType = 'TORCH_ON' | 'TORCH_OFF' | 'STROBE' | 'PULSE' | 'COLOR_WAVE';

export interface EffectPayload {
  type: EffectType;
  startAt: number;     // Server timestamp (ms) when effect should start
  duration?: number;   // Duration in ms
  frequency?: number;  // For strobe (Hz)
  color?: string;      // For screen flash (hex)
}

// Sync types
export interface TimeSyncRequest {
  clientSendTime: number;
}

export interface TimeSyncResponse {
  clientSendTime: number;
  serverReceiveTime: number;
  serverSendTime: number;
}
