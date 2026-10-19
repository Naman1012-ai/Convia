/**
 * Formats seconds into standard WhatsApp mm:ss display (e.g. 0:05, 1:23)
 * Strictly guards against Infinity, NaN, and negative inputs.
 */
export function formatAudioTime(seconds = 0) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const totalSecs = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
