import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { EffectPayload, TimeSyncResponse } from '@shared/schema';

export interface ParticipantStats {
  activeNow: number;
  totalJoined: number;
}

export function useSocket(eventId?: number, role: 'host' | 'attendee' = 'attendee', pin?: string) {
  const socketRef = useRef<Socket | null>(null);
  const timeOffsetRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState(0);
  const [lastEffect, setLastEffect] = useState<EffectPayload | null>(null);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantStats>({ activeNow: 0, totalJoined: 0 });

  useEffect(() => {
    if (!eventId) return;

    const socket = io({
      query: { eventId: eventId.toString(), role },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected:', socket.id);
      if (eventId && pin) {
        socket.emit('join_event', { pin, eventId, role });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    socket.on('effect', (payload: EffectPayload) => {
      const now = Date.now() + timeOffsetRef.current;
      const delay = Math.max(0, payload.startAt - now);
      setTimeout(() => {
        setLastEffect({ ...payload });
      }, delay);
    });

    socket.on('now_playing', (data: { title: string | null }) => {
      setNowPlaying(data.title);
    });

    socket.on('participant_update', (stats: ParticipantStats) => {
      setParticipants(stats);
    });

    const syncInterval = setInterval(() => {
      const start = Date.now();
      socket.emit('time:sync', { clientSendTime: start }, (response: TimeSyncResponse) => {
        const end = Date.now();
        const rtt = end - start;
        const currentLatency = rtt / 2;
        const computedOffset = response.serverReceiveTime - (start + currentLatency);
        setLatency(currentLatency);
        timeOffsetRef.current = timeOffsetRef.current * 0.8 + computedOffset * 0.2;
      });
    }, 2000);

    return () => {
      clearInterval(syncInterval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [eventId, role, pin]);

  const emitEffect = useCallback((type: EffectPayload['type'], options: Partial<EffectPayload> = {}) => {
    if (!socketRef.current) return;
    const now = Date.now() + timeOffsetRef.current;
    const startAt = now + 150;
    const payload: EffectPayload = { type, startAt, ...options };
    setLastEffect({ ...payload });
    if (role === 'host' && socketRef.current) {
      socketRef.current.emit('host_effect', { eventId, effect: payload });
    }
  }, [eventId, role]);

  const emitNowPlaying = useCallback((title: string | null) => {
    if (!socketRef.current || role !== 'host') return;
    socketRef.current.emit('host_now_playing', { eventId, title });
    setNowPlaying(title);
  }, [eventId, role]);

  return { isConnected, latency, timeOffset: timeOffsetRef.current, lastEffect, nowPlaying, emitEffect, emitNowPlaying, participants };
}
