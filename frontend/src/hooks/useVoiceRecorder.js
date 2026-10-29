import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Normalizes an array of raw amplitude levels down to a fixed number of bars (e.g. 35)
 * scaled between 5 and 100 for attractive WhatsApp-style waveform rendering.
 */
export function normalizeWaveform(rawPeaks = [], targetBarCount = 35) {
  if (!Array.isArray(rawPeaks) || rawPeaks.length === 0) {
    // Generate an aesthetically natural subtle default pattern if no peaks
    return Array.from({ length: targetBarCount }, (_, i) =>
      Math.max(8, Math.min(100, 20 + Math.round(Math.sin(i * 0.4) * 10)))
    );
  }

  const result = [];
  const chunkSize = rawPeaks.length / targetBarCount;

  for (let i = 0; i < targetBarCount; i++) {
    const start = Math.floor(i * chunkSize);
    const end = Math.floor((i + 1) * chunkSize);
    const chunk = rawPeaks.slice(start, Math.max(end, start + 1));
    const maxVal = chunk.length > 0 ? Math.max(...chunk) : 10;
    // Clamp between 8 (minimum visible bar height) and 100
    const normalized = Math.max(8, Math.min(100, Math.round(maxVal)));
    result.push(normalized);
  }

  return result;
}

/**
 * useVoiceRecorder Hook
 * WhatsApp-style voice note recording engine powered by native browser Web Audio API & MediaRecorder.
 */
export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0); // Elapsed seconds
  const [liveVolume, setLiveVolume] = useState(0); // 0 - 100 for live animation
  const [audioBlob, setAudioBlob] = useState(null);
  const [mimeType, setMimeType] = useState('audio/webm');
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const audioChunksRef = useRef([]);
  const rawPeaksRef = useRef([]);
  const startTimeRef = useRef(0);
  const pausedTimeRef = useRef(0);

  // Determine best supported MIME type on the user's browser
  const getSupportedMimeType = () => {
    if (typeof window === 'undefined' || !window.MediaRecorder) return 'audio/webm';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/aac',
    ];
    for (const t of types) {
      if (window.MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  };

  // Safely stop microphone hardware tracks to ensure privacy & turn off red recording dot
  const cleanupHardwareStream = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  // Teardown on unmount
  useEffect(() => {
    return () => {
      cleanupHardwareStream();
    };
  }, [cleanupHardwareStream]);

  // Start Voice Recording
  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setDuration(0);
    setLiveVolume(0);
    audioChunksRef.current = [];
    rawPeaksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio recording is not supported on this browser.');
      }

      // 1. Request microphone access with echo cancellation & noise suppression
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // 2. Set up Web Audio AnalyserNode for real-time waveform visualization
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      // 3. Set up MediaRecorder
      const selectedMime = getSupportedMimeType();
      setMimeType(selectedMime || 'audio/webm');
      const recorder = new window.MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      // Collect audio chunks every 250ms
      recorder.start(250);
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setIsPaused(false);

      // 4. Timer interval for duration
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 0.1);
      }, 100);

      // 5. Volume sampling loop (runs via requestAnimationFrame for 60fps smooth bars)
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let lastSampleTime = 0;

      const sampleLoop = (timestamp) => {
        if (analyserRef.current && recorder.state === 'recording') {
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate RMS / peak level
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((avg / 255) * 100));
          setLiveVolume(normalized);

          // Sample a permanent waveform bar peak every 120ms
          if (timestamp - lastSampleTime > 120) {
            rawPeaksRef.current.push(normalized);
            lastSampleTime = timestamp;
          }
        }
        animationFrameRef.current = requestAnimationFrame(sampleLoop);
      };

      animationFrameRef.current = requestAnimationFrame(sampleLoop);
      return true;
    } catch (err) {
      console.error('[useVoiceRecorder] Start error:', err);
      const msg = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
        ? 'Microphone permission denied. Please allow microphone access in your browser.'
        : (err.message || 'Failed to start voice recording.');
      setError(msg);
      cleanupHardwareStream();
      setIsRecording(false);
      return false;
    }
  }, [cleanupHardwareStream]);

  // Pause Recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      pausedTimeRef.current = Date.now();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setIsPaused(true);
      setLiveVolume(0);
    }
  }, []);

  // Resume Recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 0.1);
      }, 100);
      setIsPaused(false);
    }
  }, []);

  // Stop & Finalize Recording (returns finalized blob, duration, waveform, mimeType)
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanupHardwareStream();
        setIsRecording(false);
        setIsPaused(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const finalType = mimeType || recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalType });
        const finalWaveform = normalizeWaveform(rawPeaksRef.current, 35);
        const finalDuration = Math.max(0.5, Math.round(duration * 10) / 10);

        setAudioBlob(blob);
        cleanupHardwareStream();
        setIsRecording(false);
        setIsPaused(false);

        resolve({
          blob,
          duration: finalDuration,
          waveform: finalWaveform,
          mimeType: finalType,
          size: blob.size,
        });
      };

      recorder.stop();
    });
  }, [duration, mimeType, cleanupHardwareStream]);

  // Cancel & Discard Recording without saving
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];
    rawPeaksRef.current = [];
    cleanupHardwareStream();
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setLiveVolume(0);
    setAudioBlob(null);
  }, [cleanupHardwareStream]);

  return {
    isRecording,
    isPaused,
    duration,
    liveVolume,
    audioBlob,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  };
}
