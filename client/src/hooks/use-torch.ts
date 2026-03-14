import { useState, useCallback, useRef, useEffect } from 'react';

export function useTorch() {
  const [hasPermission, setHasPermission] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isOn, setIsOn] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const requestPermission = useCallback(async () => {
    try {
      console.log('[Torch] Requesting camera permission...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      
      console.log('[Torch] Camera stream acquired');
      const track = stream.getVideoTracks()[0];
      
      if (!track) {
        console.error('[Torch] No video tracks found');
        setIsSupported(false);
        return false;
      }

      try {
        const capabilities = track.getCapabilities?.() || {};
        console.log('[Torch] Track capabilities:', capabilities);
        
        if (!('torch' in capabilities)) {
          console.warn('[Torch] Torch not in capabilities — using screen flash fallback');
          setIsSupported(false);
          track.stop();
          stream.getTracks().forEach(t => t.stop());
          // Still mark permission granted so attendee enters the show (screen flash will be used)
          setHasPermission(true);
          return true;
        }
      } catch (err) {
        console.log('[Torch] Could not check capabilities, assuming torch is available:', err);
      }

      // KEEP STREAM ALIVE - Don't let it get garbage collected
      streamRef.current = stream;
      trackRef.current = track;
      setHasPermission(true);
      console.log('[Torch] Permission granted');
      return true;
    } catch (err) {
      console.error('[Torch] Failed to access camera:', err);
      setIsSupported(false);
      return false;
    }
  }, []);

  const toggle = useCallback(async (forceState?: boolean) => {
    if (!trackRef.current) {
      console.warn('[Torch] No track available to toggle');
      return;
    }

    try {
      const nextState = forceState !== undefined ? forceState : !isOn;
      console.log('[Torch] Toggling torch to:', nextState);
      
      // Apply constraint with explicit torch setting
      await trackRef.current.applyConstraints({
        advanced: [{ torch: nextState }]
      } as any);
      
      console.log('[Torch] Constraint applied successfully');
      setIsOn(nextState);
      return true;
    } catch (err) {
      console.error('[Torch] Failed to apply constraint:', err);
      return false;
    }
  }, [isOn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trackRef.current) {
        console.log('[Torch] Stopping track');
        trackRef.current.stop();
      }
      if (streamRef.current) {
        console.log('[Torch] Stopping stream');
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isSupported,
    hasPermission,
    isOn,
    requestPermission,
    toggle
  };
}
