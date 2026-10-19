import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Trash2, Pause, Play, Send, Loader2 } from 'lucide-react';
import { formatAudioTime } from '../../utils/audioHelpers';

export { formatAudioTime };

/**
 * VoiceRecorderBar
 * WhatsApp-style interactive recording interface with live waveform,
 * pause/resume, timer, and discard controls.
 */
export function VoiceRecorderBar({
  duration = 0,
  isPaused = false,
  liveVolume = 0,
  isUploading = false,
  uploadProgress = 0,
  onCancel,
  onPause,
  onResume,
  onSend,
}) {
  // Generate 20 reactive visualizer bars based on live volume
  const liveBars = useMemo(() => {
    const bars = [];
    const count = 24;
    for (let i = 0; i < count; i++) {
      // Natural oscillating variation around current live volume
      const wavePhase = Math.sin((i / count) * Math.PI) * 0.8 + 0.2;
      const height = isPaused
        ? 12
        : Math.max(8, Math.min(100, Math.round(liveVolume * wavePhase * (0.6 + (i % 3) * 0.2))));
      bars.push(height);
    }
    return bars;
  }, [liveVolume, isPaused]);

  return (
    <div
      className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-900 text-white rounded-2xl shadow-lg border border-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-200 select-none"
      role="region"
      aria-label="Voice Note Recorder"
    >
      {/* Left: Red Pulsing Recording Dot + Timer */}
      <div className="flex items-center gap-2.5 min-w-[90px] shrink-0">
        <div className="relative flex items-center justify-center">
          <span
            className={`h-3 w-3 rounded-full ${
              isPaused ? 'bg-amber-500' : 'bg-rose-500 animate-ping'
            } opacity-75`}
          />
          <span
            className={`absolute h-2.5 w-2.5 rounded-full ${
              isPaused ? 'bg-amber-400' : 'bg-rose-600'
            }`}
          />
        </div>

        <span className="font-mono text-sm font-bold tracking-wider text-slate-100">
          {formatAudioTime(duration)}
        </span>
      </div>

      {/* Center: Live Waveform Visualizer */}
      <div className="flex-1 flex items-center justify-center gap-[3px] h-9 px-2 overflow-hidden">
        {liveBars.map((barHeight, idx) => (
          <div
            key={idx}
            className={`w-1 rounded-full transition-all duration-75 ${
              isPaused ? 'bg-slate-600' : 'bg-primary-400'
            }`}
            style={{
              height: `${Math.max(6, barHeight * 0.32)}px`,
            }}
          />
        ))}
      </div>

      {/* Right: Controls (Discard, Pause/Resume, Send) */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Discard / Delete */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors disabled:opacity-40"
          title="Discard recording"
          aria-label="Discard recording"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        {/* Pause / Resume */}
        <button
          type="button"
          onClick={isPaused ? onResume : onPause}
          disabled={isUploading}
          className={`p-2 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-40 ${
            isPaused
              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title={isPaused ? 'Resume recording' : 'Pause recording'}
          aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
        >
          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>

        {/* Send / Upload Voice Note */}
        <button
          type="button"
          onClick={onSend}
          disabled={isUploading || duration < 0.5}
          className="inline-flex items-center justify-center h-9 px-3.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:bg-slate-700"
          title="Send voice note"
          aria-label="Send voice note"
        >
          {isUploading ? (
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploadProgress > 0 && <span className="font-mono text-[10px]">{uploadProgress}%</span>}
            </div>
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

VoiceRecorderBar.propTypes = {
  duration: PropTypes.number,
  isPaused: PropTypes.bool,
  liveVolume: PropTypes.number,
  isUploading: PropTypes.bool,
  uploadProgress: PropTypes.number,
  onCancel: PropTypes.func.isRequired,
  onPause: PropTypes.func.isRequired,
  onResume: PropTypes.func.isRequired,
  onSend: PropTypes.func.isRequired,
};
