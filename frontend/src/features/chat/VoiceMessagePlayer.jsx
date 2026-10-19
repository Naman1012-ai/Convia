import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Play, Pause, AlertCircle } from 'lucide-react';
import { formatAudioTime } from './VoiceRecorderBar';

// Module-level reference to enforce single-audio playback policy across the entire workspace
let activeGlobalAudioInstance = null;

/**
 * VoiceMessagePlayer
 * WhatsApp-style interactive voice note bubble with dual-tone SVG waveform,
 * click-to-seek, time tracking, and 1x/1.5x/2x variable playback speeds.
 */
export function VoiceMessagePlayer({
  audioUrl,
  duration = 0,
  waveform = [],
  isOwnMessage = false,
  className = '',
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hasLoadedMetadata, setHasLoadedMetadata] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [detectedDuration, setDetectedDuration] = useState(0);

  const audioRef = useRef(null);
  const waveformContainerRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Normalize or default waveform bars
  const bars = useMemo(() => {
    if (Array.isArray(waveform) && waveform.length > 0) {
      return waveform;
    }
    // Natural fallback pattern if waveform was not saved
    return Array.from({ length: 32 }, (_, i) => 20 + Math.round(Math.sin(i * 0.5) * 15));
  }, [waveform]);

  // Robust duration calculation: strictly guards against Infinity and NaN
  const totalDuration = useMemo(() => {
    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      return duration;
    }
    if (detectedDuration > 0 && Number.isFinite(detectedDuration)) {
      return detectedDuration;
    }
    const d = audioRef.current?.duration;
    if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
      return d;
    }
    return 0;
  }, [duration, detectedDuration]);

  const progressRatio = totalDuration > 0
    ? Math.min(1, Math.max(0, currentTime / totalDuration))
    : 0;

  // When stopped at 0s, all bars are unplayed (no lone green dot)
  const activeBarIndex = isPlaying || currentTime > 0
    ? Math.floor(progressRatio * bars.length)
    : -1;

  // Synchronize audio element state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (!isDraggingRef.current && Number.isFinite(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
      }
    };

    const onLoadedMetadata = () => {
      setHasLoadedMetadata(true);
      setAudioError(false);

      if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
        setDetectedDuration(audio.duration);
      } else if (audio.duration === Infinity) {
        // Fix for Chromium WebM duration bug: seek to end to let browser calculate true duration
        audio.currentTime = 1e101;
        const fixHandler = () => {
          audio.removeEventListener('timeupdate', fixHandler);
          const trueDuration = Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : (Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
          audio.currentTime = 0;
          if (Number.isFinite(trueDuration) && trueDuration > 0) {
            setDetectedDuration(trueDuration);
          }
        };
        audio.addEventListener('timeupdate', fixHandler);
      }
    };

    const onDurationChange = () => {
      if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
        setDetectedDuration(audio.duration);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (activeGlobalAudioInstance === audio) {
        activeGlobalAudioInstance = null;
      }
    };

    const onError = (e) => {
      console.warn('[VoiceMessagePlayer] Audio load error:', e);
      setAudioError(true);
      setIsPlaying(false);
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onPlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      if (activeGlobalAudioInstance === audio) {
        activeGlobalAudioInstance = null;
      }
    };
  }, [audioUrl]);

  // Handle Play / Pause Toggle
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Single-Audio Policy: Pause any other playing voice message
      if (activeGlobalAudioInstance && activeGlobalAudioInstance !== audio) {
        activeGlobalAudioInstance.pause();
      }
      activeGlobalAudioInstance = audio;
      audio.play().catch((err) => {
        console.warn('[VoiceMessagePlayer] Play request prevented:', err);
        setIsPlaying(false);
      });
    }
  }, [isPlaying]);

  // Handle Speed Multiplier (1x ➔ 1.5x ➔ 2x ➔ 1x)
  const cyclePlaybackSpeed = useCallback((e) => {
    e.stopPropagation();
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  }, [playbackSpeed]);

  // Seek audio based on click / drag position along the waveform
  const seekFromPointer = useCallback((e) => {
    const container = waveformContainerRef.current;
    const audio = audioRef.current;
    if (!container || !audio) return;

    const rect = container.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const targetRatio = clickX / rect.width;
    const effectiveDuration = totalDuration || audio.duration || 0;
    const newTime = targetRatio * effectiveDuration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [totalDuration]);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    seekFromPointer(e);

    const onPointerMove = (moveEvent) => {
      if (isDraggingRef.current) {
        seekFromPointer(moveEvent);
      }
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  if (audioError) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-mono">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Voice note unavailable</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 sm:gap-3 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-2xl select-none transition-all shadow-2xs max-w-sm w-full overflow-hidden ${
        isOwnMessage
          ? 'bg-primary-50/70 border border-primary-200/80 text-slate-900'
          : 'bg-white border border-slate-200/90 text-slate-900'
      } ${className}`}
      role="region"
      aria-label="Voice Message Audio Player"
    >
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        playsInline
      />

      {/* WhatsApp Play / Pause Circular Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 focus:outline-none focus:ring-2 shadow-xs cursor-pointer ${
          isOwnMessage
            ? 'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-400'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-400'
        }`}
        title={isPlaying ? 'Pause' : 'Play voice message'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform & Time Column */}
      <div className="flex-1 flex flex-col justify-center gap-0.5 sm:gap-1 min-w-0 overflow-hidden">
        {/* Scrubbable SVG Waveform Bars */}
        <div
          ref={waveformContainerRef}
          onPointerDown={handlePointerDown}
          className="relative h-7 flex items-center gap-[1.5px] sm:gap-[2.5px] cursor-pointer group py-1 w-full overflow-hidden"
          title="Click or drag to seek"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={totalDuration}
          aria-valuenow={currentTime}
        >
          {bars.map((barPeak, idx) => {
            const isPlayed = idx <= activeBarIndex;
            const barHeight = Math.max(5, Math.round((barPeak / 100) * 22));

            return (
              <div
                key={idx}
                className="flex-1 min-w-0 max-w-[4px] rounded-full transition-colors duration-75"
                style={{
                  height: `${barHeight}px`,
                  backgroundColor: isPlayed
                    ? (isOwnMessage ? '#4f46e5' : '#059669') // primary-600 vs emerald-600
                    : '#cbd5e1', // slate-300
                }}
              />
            );
          })}
        </div>

        {/* Footer: Current / Total Time */}
        <div className="flex items-center justify-between text-[11px] font-mono font-medium text-slate-500 leading-none">
          <span>{formatAudioTime(isPlaying ? currentTime : totalDuration)}</span>
        </div>
      </div>

      {/* Speed Multiplier Pill (1x / 1.5x / 2x) */}
      <button
        type="button"
        onClick={cyclePlaybackSpeed}
        className="px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-300/80 text-[10px] sm:text-[11px] font-bold font-mono text-slate-700 transition-colors shrink-0 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
        title="Toggle playback speed (1x, 1.5x, 2x)"
        aria-label={`Playback speed ${playbackSpeed}x`}
      >
        {playbackSpeed}x
      </button>
    </div>
  );
}

VoiceMessagePlayer.propTypes = {
  audioUrl: PropTypes.string.isRequired,
  duration: PropTypes.number,
  waveform: PropTypes.arrayOf(PropTypes.number),
  isOwnMessage: PropTypes.bool,
  className: PropTypes.string,
};
