import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { EffectPayload, TimeSyncResponse } from '@shared/schema';

// Simple offset calculation: 
// We assume symmetrical latency.
// offset = serverTime - (clientTime + latency/2)
// correctedTime = Date.now() + offset

export interface ParticipantStats {
  activeNow: number;
  totalJoined: number;
}

export function useSocket(eventId?: number, role: 'host' | 'attendee' = 'attendee', pin?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState(0);
  const [timeOffset, setTimeOffset] = useState(0);
  const [lastEffect, setLastEffect] = useState<EffectPayload | null>(null);
  const [participants, setParticipants] = useState<ParticipantStats>({ activeNow: 0, totalJoined: 0 });

  useEffect(() => {
    if (!eventId) return;

    // Connect to namespace or default
    const socket = io({
      query: { eventId: eventId.toString(), role },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected:', socket.id);
      
      // Notify server that we're joining the event
      if (eventId && pin) {
        socket.emit('join_event', { pin, eventId, role });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    socket.on('effect', (payload: EffectPayload) => {
      // Calculate delay until start
      const now = Date.now() + timeOffset;
      const delay = Math.max(0, payload.startAt - now);
      
      // Schedule the effect update
      setTimeout(() => {
        setLastEffect(payload);
      }, delay);
    });

    socket.on('participant_update', (stats: ParticipantStats) => {
      setParticipants(stats);
    });

    // Time Sync Logic
    const syncInterval = setInterval(() => {
      const start = Date.now();
      socket.emit('time:sync', { clientSendTime: start }, (response: TimeSyncResponse) => {
        const end = Date.now();
        const rtt = end - start;
        const currentLatency = rtt / 2;
        
        // Calculate offset
        // Server Time = Client Time + Offset
        // Offset = Server Time - Client Time
        // We use the midpoint of the RTT as the "Server Time" instant matching "Client Send + Latency"
        const serverTimeAtReceive = response.serverReceiveTime;
        const computedOffset = serverTimeAtReceive - (start + currentLatency);
        
        setLatency(currentLatency);
        setTimeOffset(prev => (prev * 0.8) + (computedOffset * 0.2)); // Smooth it out
      });
    }, 2000);

    return () => {
      clearInterval(syncInterval);
      socket.disconnect();
    };
  }, [eventId, role, timeOffset, pin]);

  const emitEffect = (type: EffectPayload['type'], options: Partial<EffectPayload> = {}) => {
    if (!socketRef.current) return;
    
    // Future scheduling: 150ms in future to allow propagation
    const now = Date.now() + timeOffset;
    const startAt = now + 150; 

    const payload: EffectPayload = {
      type,
      startAt,
      ...options
    };
    
    // Immediate local effect (for both host and attendee)
    setLastEffect(payload); 
    
    // Broadcast to all participants if host
    if (role === 'host' && socketRef.current) {
      socketRef.current.emit('host_effect', { eventId, effect: payload });
    }
  };

  return { isConnected, latency, timeOffset, lastEffect, emitEffect, participants };
}
