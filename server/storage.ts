
import { db } from "./db";
import { events, sessions, type InsertEvent, type Event, type Session } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  createEvent(event: InsertEvent): Promise<Event>;
  getEventByPin(pin: string): Promise<Event | undefined>;
  getEvent(id: number): Promise<Event | undefined>;
  getEventByHostId(hostId: string): Promise<Event | undefined>;
  joinSession(sessionId: string, eventId: number, role: 'host' | 'attendee'): Promise<Session>;
  leaveSession(sessionId: string): Promise<void>;
  getActiveSessionCount(eventId: number): Promise<number>;
  getTotalSessionCount(eventId: number): Promise<number>;
  saveSong(song: InsertSong): Promise<Song>;
  getSongsByEvent(eventId: number): Promise<Song[]>;
}

export class DatabaseStorage implements IStorage {
  // ... existing methods ...
  async saveSong(insertSong: InsertSong): Promise<Song> {
    const [song] = await db.insert(songs).values(insertSong).returning();
    return song;
  }

  async getSongsByEvent(eventId: number): Promise<Song[]> {
    return await db.select().from(songs).where(eq(songs.eventId, eventId));
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    return event;
  }

  async getEventByPin(pin: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.pin, pin));
    return event;
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getEventByHostId(hostId: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.hostId, hostId));
    return event;
  }

  async joinSession(sessionId: string, eventId: number, role: 'host' | 'attendee'): Promise<Session> {
    try {
      const [session] = await db.insert(sessions).values({
        id: sessionId,
        eventId,
        role,
      }).returning();
      return session;
    } catch (err) {
      // Session already exists, update it
      const [session] = await db.update(sessions)
        .set({ isActive: true, lastHeartbeat: new Date() })
        .where(eq(sessions.id, sessionId))
        .returning();
      return session;
    }
  }

  async leaveSession(sessionId: string): Promise<void> {
    await db.update(sessions)
      .set({ isActive: false })
      .where(eq(sessions.id, sessionId))
      .execute();
  }

  async getActiveSessionCount(eventId: number): Promise<number> {
    const result = await db.select({ count: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.eventId, eventId), eq(sessions.isActive, true)));
    return result.length;
  }

  async getTotalSessionCount(eventId: number): Promise<number> {
    const result = await db.select({ count: sessions.id })
      .from(sessions)
      .where(eq(sessions.eventId, eventId));
    return result.length;
  }
}

export const storage = new DatabaseStorage();
